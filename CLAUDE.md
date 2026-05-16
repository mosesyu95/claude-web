# CLAUDE.md

## Project Overview

Claude Web is a Node.js web application that wraps Claude CLI and provides a browser-based interface. Express + WebSocket on the backend, React + Vite on the frontend.

## Tech Stack

- **Backend**: Node.js, Express 4, ws (WebSocket), @homebridge/node-pty-prebuilt-multiarch (PTY), dotenv
- **Frontend**: React 19, Vite 8, Tailwind CSS v4, xterm.js (@xterm/xterm), lucide-react icons
- **No TypeScript**

## Key Files

### Backend
- `server.js` — Entry point. Express + WebSocket server, session timeout checker
- `src/pty-manager.js` — Spawns Claude CLI via PTY, tracks `lastInputTime` for timeout
- `src/bash-manager.js` — Spawns system shell via PTY (zsh/bash)
- `src/session-api.js` — REST routes: projects, active sessions, conversation parsing, title editing/deletion, session deletion
- `src/git-api.js` — REST routes: status, log, diff with structured parser
- `src/file-api.js` — REST routes: directory listing, file reading

### Frontend (`frontend/src/`)
- `main.jsx` — React entry point
- `App.jsx` — Root layout: sidebar + main area with tab panels, keyboard shortcuts
- `api.js` — API client (REST + WebSocket helpers)
- `helpers.js` — Utility functions (shortProject, timeAgo, fileIcon, etc.)
- `index.css` — Design tokens (Ant Design style), global styles, scrollbar, animations
- `hooks/useTheme.js` — Theme management (auto/dark/light, localStorage)
- `hooks/useWebSocket.js` — WebSocket connection management
- `components/Sidebar/Sidebar.jsx` — Collapsible sidebar (272px / 56px icon mode)
- `components/Sidebar/ActiveSessions.jsx` — Active session list with inline edit/delete
- `components/Sidebar/History.jsx` — Project history with expandable session list
- `components/Chat/ChatPanel.jsx` — Chat view with messages, header metadata, input
- `components/Chat/ChatBubble.jsx` — Message rendering (user/assistant/system, thinking, tool use)
- `components/Chat/ChatInput.jsx` — Message input with auto-resize textarea
- `components/Chat/TypingIndicator.jsx` — Animated dots during Claude processing
- `components/Git/GitPanel.jsx` — Git status, branches, commits, file diffs
- `components/Git/DiffViewer.jsx` — Unified diff display with add/delete highlighting
- `components/Files/FilesPanel.jsx` — File browser with breadcrumbs, directory listing, file viewer
- `components/Modals/NewSessionDialog.jsx` — Directory selector for new sessions
- `components/Modals/ReplayOverlay.jsx` — Full-screen conversation replay
- `components/Terminal/RawTerminal.jsx` — xterm.js for Claude PTY (forwardRef with connectWs)
- `components/Terminal/BashTerminal.jsx` — xterm.js for system shell via WebSocket

## Architecture Decisions

- **React SPA**: Vite-bundled React app, component-based architecture
- **CSS custom properties** for theming: Ant Design token system (`--primary`, `--bg-base`, `--text-primary`, etc.). Light/dark themes via `.dark` class
- **Session files**: Claude CLI stores sessions in `~/.claude/sessions/{PID}.json` (process metadata) and `~/.claude/projects/{encoded-cwd}/{sessionId}.jsonl` (transcript)
- **Active session detection**: Read `~/.claude/sessions/*.json`, validate PID with `process.kill(pid, 0)`, resolve `/clear` session ID overrides
- **Custom titles**: Stored in `.titles.json` per project directory, with AI-generated titles from JSONL
- **xterm.js**: Two instances via React forwardRef — RawTerminal (Claude PTY), BashTerminal (shell PTY). Visibility-based tab switching (not display:none) to maintain container dimensions
- **Route ordering matters** in session-api.js: static routes (`/directories`, `/projects`, `/active/list`, `/find-recent`) must come BEFORE `/:sessionId`
- **Session deduplication**: Backend `GET /active/list` deduplicates by sessionId (subprocess merging)

## Keyboard Shortcuts

- `Ctrl+B` — Toggle sidebar collapse
- `Ctrl+1` through `Ctrl+5` — Switch tabs (Chat, Raw, Git, Files, Bash)
- `Ctrl+Shift+N` — New session dialog
- `Enter` — Send message (Shift+Enter for newline)
- `Escape` — Close dialogs

## Conventions

- **No comments** unless explaining non-obvious WHY
- **No emojis** unless user explicitly requests
- **Chinese** for user-facing discussion, **English** for code and commit messages
- Commit messages: imperative mood, concise, focus on why not what
- All styling via CSS custom properties from index.css, no hardcoded colors
- Inline style objects for component-specific styling, Tailwind for layout utilities

## Session Timeout Logic

- Configured via `.env` `SESSION_TIMEOUT_MS` (default 30 min)
- Only applies to sessions started from claude-web (not externally-detected Claude processes)
- Skip killing if Claude status is `busy` (read from `~/.claude/sessions/{PID}.json`)
- Kill sequence: SIGINT x2 (1s apart), then SIGKILL after 5s
- Check runs every 60 seconds via `setInterval`

## Common Gotchas

- xterm.js cannot initialize in a hidden container — dimensions will be 0. Use visibility-based switching (absolute + visibility:hidden), not display:none
- The `decodeProjectDir` function uses a reverse map from `history.jsonl` because simple `dirName.replace(/-/g, '/')` is ambiguous (dashes in dir names)
- `@homebridge/node-pty-prebuilt-multiarch` is used instead of `node-pty` because the latter requires native compilation that fails on some systems
- Frontend build: `cd frontend && npx vite build` — outputs to `frontend/dist/`
