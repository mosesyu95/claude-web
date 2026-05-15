# Claude Web

Web wrapper for Claude CLI — run and manage Claude sessions from your browser.

## Features

- **Chat & Raw modes** — Chat-style conversation view with a Raw terminal tab for direct PTY access
- **Session management** — Detect all running Claude CLI processes system-wide, resume with one click
- **Session history** — Browse past sessions organized by project, view conversation transcripts
- **Git integration** — View branch status, staged/unstaged changes, commit history with GitHub-style diff viewer
- **File browser** — Navigate project directories, read file contents
- **Bash terminal** — Full system shell in the project directory via xterm.js
- **Auto-timeout** — Idle sessions are automatically closed after a configurable period
- **Light/Dark theme** — Follows system preference, manual toggle available

## Quick Start

```bash
git clone https://github.com/mosesyu95/claude-web.git
cd claude-web
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Configuration

Copy `.env.example` to `.env` and customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SESSION_TIMEOUT_MS` | `1800000` | Auto-close idle sessions after this many ms (30 min) |

## Architecture

```
server.js            Express + WebSocket server entry point
src/
  pty-manager.js     Claude CLI PTY session management
  bash-manager.js    System shell PTY session
  session-api.js     REST API for sessions, projects, conversation
  git-api.js         REST API for git status, log, diff
  file-api.js        REST API for file browsing
public/
  index.html         Main HTML
  css/main.css       Theme-aware styles (dark/light)
  js/main.js         Frontend logic
  vendor/            xterm.js + FitAddon (vendored)
  favicon.svg        App icon
```

### WebSocket Actions

| Action | Description |
|--------|-------------|
| `new` | Start a new Claude CLI session |
| `resume` | Resume an existing session (`--resume`) |
| `attach` | Attach to a running session |
| `bash` | Open a system shell terminal |
| `replay` | Replay a historical session from JSONL |

### REST API

- `GET /api/sessions/directories` — Available working directories
- `GET /api/sessions/projects` — All projects with session history
- `GET /api/sessions/active/list` — Currently running Claude processes (with PID validation)
- `GET /api/sessions/:id/conversation` — Parsed conversation turns
- `GET /api/git/status?dir=` — Git status
- `GET /api/git/log?dir=` — Commit log
- `GET /api/git/diff?dir=` — Structured diff (supports `?file=` and `?commit=`)
- `GET /api/files/list?dir=` — Directory listing
- `GET /api/files/read?path=` — File content

## Requirements

- Node.js >= 18
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`~/.local/bin/claude`)
- macOS or Linux

## License

MIT
