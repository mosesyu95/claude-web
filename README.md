# Claude Web

Web wrapper for Claude CLI — run and manage Claude sessions from your browser.

## Features

### Core

- **Chat & Raw modes** — Chat-style conversation view with a Raw terminal tab for direct PTY access
- **Session management** — Detect all running Claude CLI processes system-wide, resume with one click
- **Session history** — Browse past sessions organized by project, view conversation transcripts
- **Git integration** — View branch status, staged/unstaged changes, commit history with GitHub-style diff viewer
- **File browser** — Navigate project directories, read file contents
- **Bash terminal** — Full system shell in the project directory via xterm.js
- **Auto-timeout** — Idle sessions are automatically closed after a configurable period
- **Light/Dark theme** — Follows system preference, manual toggle available

### New Session Experience

- **Search-based dialog** — Type to search project directories with 500ms debounce
- **History integration** — Search results show recent sessions from matching projects
- **Quick access** — Click a recent session to open in read-only mode, or start a new session

### Session Management

- **Grouped by project** — Sessions tab groups sessions by project (like History view)
- **Status indicators** — Green dot for active sessions, gray for inactive
- **Read-only mode** — View historical conversations without input field, with a large Resume button
- **Resume sessions** — One-click resume from read-only mode or active sessions list

### Design System

- **Warm amber theme** — Obsidian-style design with warm amber (#d4956b) accent color
- **Plus Jakarta Sans** — Modern UI font with 1.65 line height
- **4px grid spacing** — Consistent spacing system with 24px message gaps
- **Transcription-style chat** — Clean message layout without bubble borders
- **Code blocks** — Dark background with copy button and error highlighting
- **Thinking blocks** — Amber accent, collapsible with preview
- **Tool use blocks** — Step cards with timeline, status icons, and duration
- **Toast notifications** — API error feedback with auto-dismiss
- **Skeleton loading** — Animated placeholders for all panels
- **Connection status** — Top bar showing WebSocket connection state
- **Welcome page** — Brand logo with quick action cards and keyboard shortcuts
- **Sidebar indicators** — Amber left border on hover for session items

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
| `ALLOWED_DIRS` | Home directory | Comma-separated list of allowed root directories for new sessions |

## Architecture

```
server.js            Express + WebSocket server entry point
src/
  pty-manager.js     Claude CLI PTY session management
  bash-manager.js    System shell PTY session
  session-api.js     REST API for sessions, projects, conversation, search
  git-api.js         REST API for git status, log, diff
  file-api.js        REST API for file browsing
frontend/src/
  App.jsx            Root layout with sidebar + main area
  api.js             API client (REST + WebSocket)
  helpers.js         Utility functions
  index.css          Design tokens and global styles
  hooks/
    useSession.js    Session lifecycle management
    useChat.js       Message state and polling
    useKeyboard.js   Global shortcuts
    useReplay.js     Replay state management
    useDebounce.js   Generic debounce hook
    useTheme.js      Theme management
    useWebSocket.js  WebSocket connection
  components/
    Sidebar/
      Sidebar.jsx           Collapsible sidebar with tabs
      ActiveSessions.jsx    Sessions grouped by project
      History.jsx           Project history with sessions
    Chat/
      ChatPanel.jsx         Chat view with read-only mode
      ChatBubble.jsx        Message rendering (text, thinking, tool use)
      ChatInput.jsx         Message input
      TypingIndicator.jsx   Animated typing dots
    Git/
      GitPanel.jsx          Git status and commits
      DiffViewer.jsx        Unified diff display
    Files/
      FilesPanel.jsx        File browser with preview
    Modals/
      NewSessionDialog.jsx  Search-based session creation
      ReplayOverlay.jsx     Full-screen conversation replay
    Terminal/
      RawTerminal.jsx       Claude PTY terminal
      BashTerminal.jsx      System shell terminal
    common/
      Toast.jsx             Toast notification system
      Skeleton.jsx          Skeleton loading components
      ConnectionBar.jsx     WebSocket status indicator
  helpers/
    terminal-theme.js       Shared terminal theme config
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
- `GET /api/sessions/directories/search?q=` — Search directories by name/path
- `GET /api/sessions/projects` — All projects with session history
- `GET /api/sessions/active/list` — Currently running Claude processes (with PID validation)
- `GET /api/sessions/:id/conversation` — Parsed conversation turns
- `GET /api/git/status?dir=` — Git status
- `GET /api/git/log?dir=` — Commit log
- `GET /api/git/diff?dir=` — Structured diff (supports `?file=` and `?commit=`)
- `GET /api/files/list?dir=` — Directory listing
- `GET /api/files/read?path=` — File content

## Keyboard Shortcuts

- `Ctrl+B` — Toggle sidebar collapse
- `Ctrl+1` through `Ctrl+5` — Switch tabs (Chat, Raw, Git, Files, Bash)
- `Ctrl+Shift+N` — New session dialog
- `Enter` — Send message (Shift+Enter for newline)
- `Escape` — Close dialogs

## Requirements

- Node.js >= 18
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`~/.local/bin/claude`)
- macOS or Linux

## License

MIT
