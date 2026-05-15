const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

function createSessionRouter() {
  const router = express.Router();

  // List available directories (from projects that have sessions + HOME subdirs)
  router.get('/directories', (req, res) => {
    try {
      const dirs = new Set();

      // 1. From existing Claude project sessions
      if (fs.existsSync(PROJECTS_DIR)) {
        const entries = fs.readdirSync(PROJECTS_DIR);
        for (const entry of entries) {
          const fullPath = path.join(PROJECTS_DIR, entry);
          if (!fs.statSync(fullPath).isDirectory()) continue;
          // Decode: -Users-yuchangfu-code-aiproxy -> /Users/yuchangfu/code/aiproxy
          const projectPath = decodeProjectDir(entry);
          if (projectPath) dirs.add(projectPath);
        }
      }

      // 2. From history.jsonl (records project paths)
      const historyFile = path.join(CLAUDE_DIR, 'history.jsonl');
      if (fs.existsSync(historyFile)) {
        const lines = fs.readFileSync(historyFile, 'utf-8').trim().split('\n');
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            if (record.project) dirs.add(record.project);
          } catch (e) {}
        }
      }

      // 3. Add common directories under HOME
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

      const sorted = Array.from(dirs).sort();
      res.json({ directories: sorted });
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

        const sessions = sessionFiles.map(f => {
          const sessionId = f.replace('.jsonl', '');
          const filePath = path.join(fullPath, f);
          const fileStat = fs.statSync(filePath);
          let title = null;
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const line of content.trim().split('\n')) {
              try {
                const r = JSON.parse(line);
                if (r.type === 'ai-title' && r.aiTitle) { title = r.aiTitle; break; }
              } catch (e) {}
            }
          } catch (e) {}
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

      const sessions = sessionFiles.map(f => {
        const sessionId = f.replace('.jsonl', '');
        const filePath = path.join(projectDir, f);
        const fileStat = fs.statSync(filePath);

        let title = null;
        let firstTimestamp = null;
        let messageCount = 0;

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          messageCount = lines.length;

          for (const line of lines) {
            try {
              const record = JSON.parse(line);
              if (record.type === 'ai-title' && record.aiTitle) {
                title = record.aiTitle;
              }
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

  // Get currently running sessions
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
          sessions.push(data);
        } catch (e) {}
      }

      res.json({ sessions });
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
      currentTurn.parts.push({ type: 'text', text: record.content || '' });
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

module.exports = { createSessionRouter };
