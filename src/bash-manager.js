const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const os = require('os');

function createBashSession(ws, cwd) {
  const shell = process.env.SHELL || '/bin/zsh';
  const safeCwd = (cwd && cwd.trim()) ? cwd.trim() : os.homedir();
  const fs = require('fs');
  const effectiveCwd = fs.existsSync(safeCwd) ? safeCwd : os.homedir();

  const ptyProcess = pty.spawn(shell, [], {
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

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'pty-data', data }));
    }
  });

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
    ptyProcess.kill();
  });

  ptyProcess.onExit(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'pty-exit' }));
    }
  });
}

module.exports = { createBashSession };
