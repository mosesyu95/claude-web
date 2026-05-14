const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { createPtySession } = require('./src/pty-manager');
const { createSessionRouter } = require('./src/session-api');
const { createFileApiRouter } = require('./src/file-api');
const { createGitApiRouter } = require('./src/git-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
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
});
