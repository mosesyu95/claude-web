require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { createPtySession } = require('./src/pty-manager');
const { createBashSession } = require('./src/bash-manager');
const { createSessionRouter } = require('./src/session-api');
const { createFileApiRouter } = require('./src/file-api');
const { createGitApiRouter } = require('./src/git-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS) || 1800000;

app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
app.use('/api/sessions', createSessionRouter());
app.use('/api/files', createFileApiRouter());
app.use('/api/git', createGitApiRouter());

const activeSessions = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  if (action === 'new') {
    const cwd = url.searchParams.get('cwd') || process.env.HOME;
    const sessionId = createPtySession(ws, cwd, activeSessions);
    ws.send(JSON.stringify({ type: 'session-started', sessionId }));

  } else if (action === 'resume') {
    const resumeId = url.searchParams.get('sessionId');
    const cwd = url.searchParams.get('cwd') || process.env.HOME;
    if (!resumeId) {
      ws.send(JSON.stringify({ type: 'error', message: 'sessionId required for resume' }));
      ws.close();
      return;
    }
    const sessionId = createPtySession(ws, cwd, activeSessions, { resumeSessionId: resumeId });
    ws.send(JSON.stringify({ type: 'session-started', sessionId, resumedFrom: resumeId }));

  } else if (action === 'attach') {
    const sessionId = url.searchParams.get('sessionId');
    const session = activeSessions.get(sessionId);
    if (session) {
      session.ws = ws;
      for (const chunk of session.history) {
        ws.send(chunk);
      }
      session.pty.onData((data) => {
        const msg = JSON.stringify({ type: 'pty-data', data });
        session.history.push(msg);
        if (ws.readyState === ws.OPEN) {
          ws.send(msg);
        }
      });
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
      ws.close();
    }
  } else if (action === 'bash') {
    const cwd = url.searchParams.get('cwd') || process.env.HOME;
    createBashSession(ws, cwd);

  } else if (action === 'replay') {
    const sessionId = url.searchParams.get('sessionId');
    const projectPath = url.searchParams.get('project');
    handleReplay(ws, sessionId, projectPath);
  }
});

async function handleReplay(ws, sessionId, projectPath) {
  const fs = require('fs');
  const os = require('os');
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');

  let sessionFile = null;
  if (projectPath) {
    const candidate = path.join(claudeDir, projectPath, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) sessionFile = candidate;
  }

  if (!sessionFile) {
    const dirs = fs.readdirSync(claudeDir);
    for (const dir of dirs) {
      const candidate = path.join(claudeDir, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) {
        sessionFile = candidate;
        break;
      }
    }
  }

  if (!sessionFile) {
    ws.send(JSON.stringify({ type: 'error', message: 'Session file not found' }));
    ws.close();
    return;
  }

  const content = fs.readFileSync(sessionFile, 'utf-8');
  const lines = content.trim().split('\n');

  ws.send(JSON.stringify({ type: 'replay-start', totalMessages: lines.length, sessionId }));

  for (let i = 0; i < lines.length; i++) {
    if (ws.readyState !== ws.OPEN) break;
    try {
      const record = JSON.parse(lines[i]);
      ws.send(JSON.stringify({ type: 'replay-message', index: i, record }));
    } catch (e) {}
  }

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: 'replay-end' }));
    ws.close();
  }
}

server.listen(PORT, () => {
  console.log(`Claude Web running at http://localhost:${PORT}`);
  console.log(`Session timeout: ${SESSION_TIMEOUT_MS / 60000} minutes`);
});

// ========== Session Timeout Checker ==========
// Kill claude-web-started sessions that have had no user input for SESSION_TIMEOUT_MS
// Only kills sessions where Claude is idle (not actively working)
function checkSessionTimeouts() {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions) {
    const idleMs = now - (session.lastInputTime || 0);
    if (idleMs < SESSION_TIMEOUT_MS) continue;

    // Check if the Claude process is still idle (not busy)
    // Read the session file from ~/.claude/sessions/{PID}.json
    if (session.pid) {
      try {
        const fs = require('fs');
        const os = require('os');
        const sessionFile = path.join(os.homedir(), '.claude', 'sessions', `${session.pid}.json`);
        if (fs.existsSync(sessionFile)) {
          const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
          if (data.status === 'busy') continue; // Don't kill busy sessions
        }
      } catch (e) {}
    }

    console.log(`[timeout] Session ${sessionId} idle for ${Math.round(idleMs / 60000)}min, killing...`);
    killSession(sessionId, session);
  }
}

function killSession(sessionId, session) {
  const pty = session.pty;
  if (!pty) {
    activeSessions.delete(sessionId);
    return;
  }

  // Send first SIGINT (Ctrl+C)
  try { pty.write('\x03'); } catch (e) {}

  // Send second SIGINT after 1 second
  setTimeout(() => {
    try { pty.write('\x03'); } catch (e) {}
  }, 1000);

  // Force kill after 5 seconds if still alive
  setTimeout(() => {
    try {
      if (pty.pid) process.kill(pty.pid, 'SIGKILL');
    } catch (e) {}
    activeSessions.delete(sessionId);
  }, 5000);

  // Notify WebSocket client
  const ws = session.ws;
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: 'pty-data', data: '\r\n\x1b[33m[Session auto-closed: idle timeout]\x1b[0m\r\n' }));
    ws.send(JSON.stringify({ type: 'session-timeout', sessionId }));
  }
}

// Run check every 60 seconds
setInterval(checkSessionTimeouts, 60000);
