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
  };

  activeSessions.set(sessionId, session);

  // PTY output -> WebSocket
  ptyProcess.onData((data) => {
    const msg = JSON.stringify({ type: 'pty-data', data });
    session.history.push(msg);
    if (session.history.length > 5000) {
      session.history = session.history.slice(-3000);
    }
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  });

  // WebSocket input -> PTY
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'pty-input') {
        ptyProcess.write(msg.data);
      } else if (msg.type === 'resize') {
        ptyProcess.resize(msg.cols || 120, msg.rows || 36);
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    session.ws = null;
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'pty-exit', exitCode }));
    }
    activeSessions.delete(sessionId);
  });

  return sessionId;
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

module.exports = { createPtySession };
