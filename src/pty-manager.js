const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Create a new PTY session running Claude CLI
 * @param {WebSocket} ws
 * @param {string} cwd - working directory
 * @param {Map} activeSessions
 * @param {object} [options]
 * @param {string} [options.resumeSessionId] - resume a historical session
 */
function createPtySession(ws, cwd, activeSessions, options = {}) {
  const sessionId = options.resumeSessionId || crypto.randomUUID();
  const claudeBin = findClaudeBin();
  const safeCwd = (cwd && cwd.trim()) ? cwd.trim() : os.homedir();

  // Validate cwd exists
  const fs = require('fs');
  const effectiveCwd = fs.existsSync(safeCwd) ? safeCwd : os.homedir();

  const args = options.resumeSessionId
    ? ['--resume', options.resumeSessionId]
    : [];

  console.log(`[pty] spawning: ${claudeBin} ${args.join(' ')}, cwd=${effectiveCwd}`);

  const ptyProcess = pty.spawn(claudeBin, args, {
    name: 'xterm-256color',
    cols: 120,
    rows: 36,
    cwd: effectiveCwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  const session = {
    pty: ptyProcess,
    ws: ws,
    history: [],
    cwd: cwd || os.homedir(),
    resumedFrom: options.resumeSessionId || null,
    lastInputTime: Date.now(),
    pid: ptyProcess.pid,
    onDataDisposable: null,
    wsMsgHandler: null,
    wsCloseHandler: null,
  };

  activeSessions.set(sessionId, session);
  wireSession(session, ws, sessionId, activeSessions);

  return sessionId;
}

function wireSession(session, ws, sessionId, activeSessions) {
  const ptyProcess = session.pty;

  // Dispose old onData listener if any
  if (session.onDataDisposable) {
    try { session.onDataDisposable.dispose(); } catch (e) {}
  }

  // PTY output -> WebSocket
  session.onDataDisposable = ptyProcess.onData((data) => {
    const msg = JSON.stringify({ type: 'pty-data', data });
    session.history.push(msg);
    if (session.history.length > 5000) {
      session.history = session.history.slice(-3000);
    }
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  });

  // Remove old WebSocket handlers if any
  if (session.wsMsgHandler) ws.removeListener('message', session.wsMsgHandler);
  if (session.wsCloseHandler) ws.removeListener('close', session.wsCloseHandler);

  // WebSocket input -> PTY
  session.wsMsgHandler = (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'pty-input') {
        ptyProcess.write(msg.data);
        session.lastInputTime = Date.now();
      } else if (msg.type === 'resize') {
        ptyProcess.resize(msg.cols || 120, msg.rows || 36);
      }
    } catch (e) {}
  };
  ws.on('message', session.wsMsgHandler);

  session.wsCloseHandler = () => { session.ws = null; };
  ws.on('close', session.wsCloseHandler);

  // Re-register onExit (idempotent — old handler is harmless since ws reference is updated)
  ptyProcess.onExit(({ exitCode }) => {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'pty-exit', exitCode }));
    }
    activeSessions.delete(sessionId);
  });
}

/**
 * Reattach a new WebSocket to an existing PTY session.
 * Returns true if successful, false if the PTY is dead.
 */
function reattachSession(ws, sessionId, activeSessions) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.pty) return false;

  try { process.kill(session.pty.pid, 0); } catch { return false; }

  // Close old WebSocket
  if (session.ws && session.ws !== ws && session.ws.readyState === 1) {
    try { session.ws.close(); } catch (e) {}
  }

  session.ws = ws;
  session.lastInputTime = Date.now();

  // Wire new WebSocket to existing PTY
  wireSession(session, ws, sessionId, activeSessions);

  // Replay history to new client
  for (const chunk of session.history) {
    if (ws.readyState === 1) ws.send(chunk);
  }

  console.log(`[pty] reattached session ${sessionId} (pid ${session.pty.pid})`);
  return true;
}

function findClaudeBin() {
  const home = os.homedir();
  const fs = require('fs');
  const candidates = [
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.claude', 'local', 'claude'),
    path.join(home, '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`[pty] found claude at: ${candidate}`);
      return candidate;
    }
  }

  // Try resolving from PATH
  try {
    const { execSync } = require('child_process');
    const resolved = execSync('which claude', { encoding: 'utf-8' }).trim();
    if (resolved && fs.existsSync(resolved)) {
      console.log(`[pty] resolved claude via PATH: ${resolved}`);
      return resolved;
    }
  } catch (e) {}

  console.error('[pty] WARNING: claude binary not found');
  return 'claude';
}

module.exports = { createPtySession, reattachSession };
