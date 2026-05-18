const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// ALLOWED_DIRS: comma-separated list of root directories. Default: home directory.
const ALLOWED_DIRS = (() => {
  const raw = process.env.ALLOWED_DIRS;
  if (!raw) return [os.homedir()];
  return raw.split(',').map(d => d.trim()).filter(Boolean).map(d => path.resolve(d));
})();

function isDirAllowed(dir) {
  const resolved = path.resolve(dir);
  return ALLOWED_DIRS.some(allowed => resolved === allowed || resolved.startsWith(allowed + '/'));
}

function loadTitles(dirName) {
  try {
    const file = path.join(PROJECTS_DIR, dirName, '.titles.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch { return {}; }
}

function saveTitle(dirName, sessionId, title) {
  const dir = path.join(PROJECTS_DIR, dirName);
  if (!fs.existsSync(dir)) return;
  const file = path.join(dir, '.titles.json');
  const titles = loadTitles(dirName);
  titles[sessionId] = title;
  fs.writeFileSync(file, JSON.stringify(titles, null, 2));
}

function deleteTitleEntry(dirName, sessionId) {
  const file = path.join(PROJECTS_DIR, dirName, '.titles.json');
  const titles = loadTitles(dirName);
  if (titles[sessionId] !== undefined) {
    delete titles[sessionId];
    fs.writeFileSync(file, JSON.stringify(titles, null, 2));
  }
}

function readAiTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.trim().split('\n')) {
      try {
        const r = JSON.parse(line);
        if (r.type === 'ai-title' && r.aiTitle) return r.aiTitle;
      } catch {}
    }
  } catch {}
  return null;
}

function createSessionRouter() {
  const router = express.Router();
  router.use(express.json());

  // List available directories for new sessions.
  // Controlled by ALLOWED_DIRS env var. When set, only those directories are shown.
  // When not set, shows home directory + subdirs + project/history dirs.
  router.get('/directories', (req, res) => {
    try {
      const explicitDirs = process.env.ALLOWED_DIRS;

      if (explicitDirs) {
        // Explicit mode: only return the specified directories + project dirs under them
        const dirs = new Set(ALLOWED_DIRS);

        // Add project dirs that fall under allowed roots
        if (fs.existsSync(PROJECTS_DIR)) {
          for (const entry of fs.readdirSync(PROJECTS_DIR)) {
            const fullPath = path.join(PROJECTS_DIR, entry);
            if (!fs.statSync(fullPath).isDirectory()) continue;
            const projectPath = decodeProjectDir(entry);
            if (projectPath && projectPath.startsWith('/') && isDirAllowed(projectPath)) dirs.add(projectPath);
          }
        }

        const historyFile = path.join(CLAUDE_DIR, 'history.jsonl');
        if (fs.existsSync(historyFile)) {
          for (const line of fs.readFileSync(historyFile, 'utf-8').trim().split('\n')) {
            try {
              const record = JSON.parse(line);
              if (record.project && record.project.startsWith('/') && isDirAllowed(record.project)) dirs.add(record.project);
            } catch (e) {}
          }
        }

        return res.json({ directories: Array.from(dirs).sort() });
      }

      // Default mode: home directory + subdirs + project/history dirs
      const dirs = new Set();

      if (fs.existsSync(PROJECTS_DIR)) {
        for (const entry of fs.readdirSync(PROJECTS_DIR)) {
          const fullPath = path.join(PROJECTS_DIR, entry);
          if (!fs.statSync(fullPath).isDirectory()) continue;
          const projectPath = decodeProjectDir(entry);
          if (projectPath && projectPath.startsWith('/')) dirs.add(projectPath);
        }
      }

      const historyFile = path.join(CLAUDE_DIR, 'history.jsonl');
      if (fs.existsSync(historyFile)) {
        for (const line of fs.readFileSync(historyFile, 'utf-8').trim().split('\n')) {
          try {
            const record = JSON.parse(line);
            if (record.project && record.project.startsWith('/')) dirs.add(record.project);
          } catch (e) {}
        }
      }

      const home = os.homedir();
      dirs.add(home);
      try {
        for (const entry of fs.readdirSync(home)) {
          const full = path.join(home, entry);
          try {
            if (fs.statSync(full).isDirectory()) dirs.add(full);
          } catch (e) {}
        }
      } catch (e) {}

      res.json({ directories: Array.from(dirs).sort() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List immediate subdirectories of a given path (for directory browser drill-down)
  router.get('/directories/ls', (req, res) => {
    try {
      const dir = req.query.path;
      if (!dir) return res.status(400).json({ error: 'path required' });
      const resolved = path.resolve(dir);
      if (!isDirAllowed(resolved)) return res.status(403).json({ error: 'Directory not allowed' });
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        return res.json({ path: resolved, entries: [] });
      }
      const entries = fs.readdirSync(resolved)
        .filter(name => {
          if (name.startsWith('.')) return false;
          try { return fs.statSync(path.join(resolved, name)).isDirectory(); } catch { return false; }
        })
        .sort();
      res.json({ path: resolved, entries });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new directory
  router.post('/directories/mkdir', (req, res) => {
    try {
      const { dir } = req.body || {};
      if (!dir || typeof dir !== 'string') return res.status(400).json({ error: 'dir required' });
      const resolved = path.resolve(dir);
      if (!isDirAllowed(resolved)) return res.status(403).json({ error: 'Directory not allowed' });
      fs.mkdirSync(resolved, { recursive: true });
      res.json({ created: true, path: resolved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Search directories by query string
  router.get('/directories/search', (req, res) => {
    try {
      const q = (req.query.q || '').trim().toLowerCase();
      if (!q) return res.json({ results: [] });

      const results = [];
      const seen = new Set();

      // Build a map of project dirName -> { projectPath, sessions }
      const projectMap = new Map();
      if (fs.existsSync(PROJECTS_DIR)) {
        for (const entry of fs.readdirSync(PROJECTS_DIR)) {
          const fullPath = path.join(PROJECTS_DIR, entry);
          if (!fs.statSync(fullPath).isDirectory()) continue;
          const projectPath = decodeProjectDir(entry);
          const sessionFiles = fs.readdirSync(fullPath)
            .filter(f => f.endsWith('.jsonl') && !f.startsWith('.'))
            .map(f => {
              const fp = path.join(fullPath, f);
              const stat = fs.statSync(fp);
              const sessionId = f.replace('.jsonl', '');
              const customTitles = loadTitles(entry);
              const aiTitle = readAiTitle(fp);
              return {
                sessionId,
                title: customTitles[sessionId] || aiTitle,
                lastModified: stat.mtime.toISOString(),
              };
            })
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

          projectMap.set(entry, { projectPath, dirName: entry, sessions: sessionFiles });
        }
      }

      // Search ALLOWED_DIRS and their subdirectories
      for (const allowed of ALLOWED_DIRS) {
        // Match the root itself
        const rootName = path.basename(allowed);
        if (allowed.toLowerCase().includes(q) || rootName.toLowerCase().includes(q)) {
          if (!seen.has(allowed) && isDirAllowed(allowed)) {
            seen.add(allowed);
            const proj = projectMap.get(allowed.replace(/\//g, '-'));
            results.push({
              path: allowed,
              name: rootName,
              displayPath: allowed,
              hasHistory: !!proj,
              recentSessions: proj ? proj.sessions.slice(0, 3) : [],
            });
          }
        }

        // Search immediate subdirectories of allowed dirs
        try {
          for (const entry of fs.readdirSync(allowed)) {
            const fullPath = path.join(allowed, entry);
            try {
              if (!fs.statSync(fullPath).isDirectory()) continue;
            } catch { continue; }
            if (seen.has(fullPath)) continue;
            if (entry.toLowerCase().includes(q) || fullPath.toLowerCase().includes(q)) {
              seen.add(fullPath);
              const proj = projectMap.get(fullPath.replace(/\//g, '-'));
              results.push({
                path: fullPath,
                name: entry,
                displayPath: fullPath,
                hasHistory: !!proj,
                recentSessions: proj ? proj.sessions.slice(0, 3) : [],
              });
            }
          }
        } catch {}
      }

      // Search project dirs that may be outside ALLOWED_DIRS
      for (const [dirName, proj] of projectMap) {
        const pp = proj.projectPath;
        if (!pp || seen.has(pp)) continue;
        if (!isDirAllowed(pp)) continue;
        if (pp.toLowerCase().includes(q) || path.basename(pp).toLowerCase().includes(q)) {
          seen.add(pp);
          results.push({
            path: pp,
            name: path.basename(pp),
            displayPath: pp,
            hasHistory: true,
            recentSessions: proj.sessions.slice(0, 3),
          });
        }
      }

      // Sort: projects with history first, then alphabetically
      results.sort((a, b) => {
        if (a.hasHistory !== b.hasHistory) return b.hasHistory - a.hasHistory;
        return a.path.localeCompare(b.path);
      });

      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all projects that have sessions
  router.get('/projects', (req, res) => {
    try {
      if (!fs.existsSync(PROJECTS_DIR)) {
        return res.json({ projects: [] });
      }

      const entries = fs.readdirSync(PROJECTS_DIR);
      const projects = [];

      for (const entry of entries) {
        const fullPath = path.join(PROJECTS_DIR, entry);
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;

        const projectPath = decodeProjectDir(entry);
        const files = fs.readdirSync(fullPath);
        const sessionFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('.'));
        const customTitles = loadTitles(entry);

        const sessions = sessionFiles.map(f => {
          const sessionId = f.replace('.jsonl', '');
          const filePath = path.join(fullPath, f);
          const fileStat = fs.statSync(filePath);
          const aiTitle = readAiTitle(filePath);
          const title = customTitles[sessionId] || aiTitle;
          return {
            sessionId,
            title,
            projectPath,
            lastModified: fileStat.mtime.toISOString(),
            size: fileStat.size,
          };
        }).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        projects.push({
          dirName: entry,
          projectPath,
          sessionCount: sessions.length,
          sessions,
        });
      }

      projects.sort((a, b) => {
        const aTime = a.sessions[0]?.lastModified || '';
        const bTime = b.sessions[0]?.lastModified || '';
        return bTime.localeCompare(aTime);
      });

      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List sessions for a specific project
  router.get('/projects/:dirName', (req, res) => {
    try {
      const projectDir = path.join(PROJECTS_DIR, req.params.dirName);
      if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const files = fs.readdirSync(projectDir);
      const sessionFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('.'));
      const customTitles = loadTitles(req.params.dirName);

      const sessions = sessionFiles.map(f => {
        const sessionId = f.replace('.jsonl', '');
        const filePath = path.join(projectDir, f);
        const fileStat = fs.statSync(filePath);

        const aiTitle = readAiTitle(filePath);
        const title = customTitles[sessionId] || aiTitle;
        let firstTimestamp = null;
        let messageCount = 0;

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          messageCount = lines.length;

          for (const line of lines) {
            try {
              const record = JSON.parse(line);
              if (record.timestamp && !firstTimestamp) {
                firstTimestamp = record.timestamp;
              }
            } catch (e) {}
          }
        } catch (e) {}

        return {
          sessionId,
          title,
          firstTimestamp,
          lastModified: fileStat.mtime.toISOString(),
          size: fileStat.size,
          messageCount,
        };
      }).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      const projectPath = decodeProjectDir(req.params.dirName);

      res.json({
        dirName: req.params.dirName,
        projectPath,
        sessions,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Find the most recent session in a project directory (for chat polling)
  router.get('/find-recent', (req, res) => {
    try {
      const dir = req.query.dir;
      const afterMs = parseInt(req.query.afterMs) || 0;
      if (!dir) return res.status(400).json({ error: 'dir required' });

      const dirName = dir.replace(/\//g, '-');
      const projectDir = path.join(PROJECTS_DIR, dirName);
      if (!fs.existsSync(projectDir)) {
        return res.json({ found: false });
      }

      const files = fs.readdirSync(projectDir);
      const sessionFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('.'));

      let best = null;
      let bestTime = 0;
      for (const f of sessionFiles) {
        const filePath = path.join(projectDir, f);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs > afterMs && stat.mtimeMs > bestTime) {
          best = f.replace('.jsonl', '');
          bestTime = stat.mtimeMs;
        }
      }

      if (best) {
        res.json({ found: true, sessionId: best, dirName });
      } else {
        res.json({ found: false });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get currently active Claude CLI sessions (from ~/.claude/sessions/)
  // Validates PIDs are still running, resolves session titles
  router.get('/active/list', (req, res) => {
    try {
      const sessionsDir = path.join(CLAUDE_DIR, 'sessions');
      if (!fs.existsSync(sessionsDir)) {
        return res.json({ sessions: [] });
      }

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      const sessions = [];

      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf-8'));
          const pid = data.pid;
          // Check if the process is still running
          if (!isProcessRunning(pid)) continue;

          // Resolve the real sessionId (handle /clear which creates a new one)
          const realSessionId = resolveActiveSessionId(data);
          const title = getSessionTitle(realSessionId, data.cwd);

          sessions.push({
            pid,
            sessionId: realSessionId,
            originalSessionId: data.sessionId,
            cwd: data.cwd,
            startedAt: data.startedAt,
            status: data.status || 'unknown',
            version: data.version || '',
            title,
          });
        } catch (e) {}
      }

      // Deduplicate by sessionId — subprocesses share the same sessionId as their parent
      const bySession = new Map();
      for (const s of sessions) {
        const existing = bySession.get(s.sessionId);
        if (!existing) {
          bySession.set(s.sessionId, s);
        } else {
          // Prefer the entry that's busy, or the one with the earliest startedAt
          if (s.status === 'busy' && existing.status !== 'busy') {
            bySession.set(s.sessionId, s);
          } else if (s.status === existing.status && (s.startedAt || 0) < (existing.startedAt || 0)) {
            bySession.set(s.sessionId, s);
          }
        }
      }

      const deduped = Array.from(bySession.values());
      deduped.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      res.json({ sessions: deduped });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Rename a session
  router.put('/:sessionId/title', (req, res) => {
    try {
      const { sessionId } = req.params;
      const { title } = req.body || {};
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title required' });
      }

      const sessionFile = findSessionFile(sessionId, req.query.project);
      if (!sessionFile) return res.status(404).json({ error: 'Session not found' });

      const dirName = path.basename(path.dirname(sessionFile));
      saveTitle(dirName, sessionId, title.trim());
      res.json({ sessionId, title: title.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a session
  router.delete('/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const sessionFile = findSessionFile(sessionId, req.query.project);
      if (!sessionFile) return res.status(404).json({ error: 'Session not found' });

      const dirName = path.basename(path.dirname(sessionFile));
      try { fs.unlinkSync(sessionFile); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      deleteTitleEntry(dirName, sessionId);
      res.json({ deleted: true, sessionId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get a specific session as conversation turns
  router.get('/:sessionId/conversation', (req, res) => {
    try {
      const { sessionId } = req.params;
      const { project: projectDir } = req.query;

      const sessionFile = findSessionFile(sessionId, projectDir);
      if (!sessionFile) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const content = fs.readFileSync(sessionFile, 'utf-8');
      const lines = content.trim().split('\n');

      const records = [];
      for (const line of lines) {
        try {
          records.push(JSON.parse(line));
        } catch (e) {}
      }

      // Parse into conversation turns
      const turns = parseConversationTurns(records);

      res.json({ sessionId, turns, totalRecords: lines.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get a specific session's raw messages (kept for compatibility)
  router.get('/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const { project: projectDir } = req.query;

      const sessionFile = findSessionFile(sessionId, projectDir);
      if (!sessionFile) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const content = fs.readFileSync(sessionFile, 'utf-8');
      const lines = content.trim().split('\n');

      const messages = [];
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (['user', 'assistant', 'system'].includes(record.type)) {
            messages.push(record);
          }
        } catch (e) {}
      }

      res.json({ sessionId, messages, totalRecords: lines.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

/**
 * Parse JSONL records into conversation turns.
 * Each turn = { role, timestamp, parts[] }
 *   parts: [{ type: 'text'|'thinking'|'tool_use'|'tool_result', ... }]
 *
 * Tool calls are grouped: assistant tool_use followed by user tool_result
 * are merged into a single tool step within the assistant turn.
 */
function parseConversationTurns(records) {
  const turns = [];
  let currentTurn = null;

  // Build a map of tool_use_id -> tool_result for linking
  const toolResults = new Map();
  for (const record of records) {
    if (record.type === 'user' && record.message?.role === 'user') {
      const content = Array.isArray(record.message.content) ? record.message.content : [];
      for (const block of content) {
        if (block.type === 'tool_result') {
          toolResults.set(block.tool_use_id, block);
        }
      }
    }
  }

  for (const record of records) {
    // Skip metadata-only records
    if (!['user', 'assistant', 'system'].includes(record.type)) continue;
    // Skip tool_result user messages — they'll be embedded in assistant turns
    if (record.type === 'user' && isToolResultOnly(record)) continue;

    const role = record.type;

    // Start a new turn when role changes
    if (!currentTurn || currentTurn.role !== role) {
      currentTurn = {
        role,
        timestamp: record.timestamp || null,
        parts: [],
      };
      turns.push(currentTurn);
    }

    if (record.type === 'user') {
      const content = record.message?.content;
      if (typeof content === 'string') {
        currentTurn.parts.push({ type: 'text', text: content });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            currentTurn.parts.push({ type: 'text', text: block.text });
          }
          // tool_result blocks are skipped here; shown in assistant turn
        }
      }
    } else if (record.type === 'assistant') {
      const content = record.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            currentTurn.parts.push({ type: 'text', text: block.text });
          } else if (block.type === 'thinking') {
            currentTurn.parts.push({ type: 'thinking', text: block.thinking });
          } else if (block.type === 'tool_use') {
            const result = toolResults.get(block.id);
            currentTurn.parts.push({
              type: 'tool_use',
              name: block.name,
              input: block.input,
              tool_use_id: block.id,
              result: result ? (typeof result.content === 'string' ? result.content : truncateToolResult(result.content)) : null,
            });
          }
        }
      } else if (typeof content === 'string') {
        currentTurn.parts.push({ type: 'text', text: content });
      }
    } else if (record.type === 'system') {
      const c = record.content || '';
      if (c.includes('<command-name>') || c.includes('<local-command')) continue;
      currentTurn.parts.push({ type: 'text', text: c });
    }
  }

  return turns;
}

function isToolResultOnly(record) {
  const content = record.message?.content;
  if (!Array.isArray(content)) return false;
  return content.length > 0 && content.every(b => b.type === 'tool_result');
}

function truncateToolResult(content, maxLen = 500) {
  if (!content) return null;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

function decodeProjectDir(dirName) {
  // Best-effort decode: build a reverse map from history.jsonl for accuracy
  if (!_projectDirMap) {
    _projectDirMap = new Map();
    const historyFile = path.join(CLAUDE_DIR, 'history.jsonl');
    if (fs.existsSync(historyFile)) {
      const lines = fs.readFileSync(historyFile, 'utf-8').trim().split('\n');
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.project) {
            // Derive the dirName key the same way Claude CLI does
            const key = record.project.replace(/\//g, '-');
            _projectDirMap.set(key, record.project);
          }
        } catch (e) {}
      }
    }
  }
  return _projectDirMap.get(dirName) || dirName;
}
let _projectDirMap = null;

function findSessionFile(sessionId, projectDir) {
  if (projectDir) {
    const candidate = path.join(PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }

  if (!fs.existsSync(PROJECTS_DIR)) return null;

  const dirs = fs.readdirSync(PROJECTS_DIR);
  for (const dir of dirs) {
    const candidate = path.join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function resolveActiveSessionId(sessionData) {
  const cwd = sessionData.cwd;
  if (!cwd) return sessionData.sessionId;

  const dirName = cwd.replace(/\//g, '-');
  const projectDir = path.join(PROJECTS_DIR, dirName);

  if (!fs.existsSync(projectDir)) return sessionData.sessionId;

  try {
    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl') && !f.startsWith('.'));
    let bestFile = null;
    let bestMtime = 0;

    for (const f of files) {
      const stat = fs.statSync(path.join(projectDir, f));
      if (stat.mtimeMs >= (sessionData.startedAt || 0) && stat.mtimeMs > bestMtime) {
        bestFile = f;
        bestMtime = stat.mtimeMs;
      }
    }

    if (bestFile) return bestFile.replace('.jsonl', '');
  } catch (e) {}

  return sessionData.sessionId;
}

function getSessionTitle(sessionId, cwd) {
  const dirName = cwd ? cwd.replace(/\//g, '-') : null;
  const sessionFile = findSessionFile(sessionId, dirName);
  if (!sessionFile) return null;

  const dir = path.basename(path.dirname(sessionFile));
  const custom = loadTitles(dir);
  if (custom[sessionId]) return custom[sessionId];

  return readAiTitle(sessionFile);
}

module.exports = { createSessionRouter, isDirAllowed };
