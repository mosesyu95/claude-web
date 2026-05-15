# CLAUDE.md

## Project Overview

Claude Web is a Node.js web application that wraps Claude CLI and provides a browser-based interface. It uses Express + WebSocket on the backend and vanilla HTML/CSS/JS on the frontend. No build step required.

## Tech Stack

- **Backend**: Node.js, Express 4, ws (WebSocket), @homebridge/node-pty-prebuilt-multiarch (PTY), dotenv
- **Frontend**: Vanilla HTML + CSS + JS, xterm.js (vendored in public/vendor/)
- **No TypeScript, no bundler, no framework**

## Key Files

- `server.js` — Entry point. Express + WebSocket server, session timeout checker
- `src/pty-manager.js` — Spawns Claude CLI via PTY, tracks `lastInputTime` for timeout
- `src/bash-manager.js` — Spawns system shell via PTY (zsh/bash)
- `src/session-api.js` — REST routes: projects, active sessions, conversation parsing, title extraction
- `src/git-api.js` — REST routes: status, log, diff with structured parser
- `src/file-api.js` — REST routes: directory listing, file reading
- `public/js/main.js` — All frontend logic in a single IIFE
- `public/css/main.css` — Theme variables with `[data-theme="dark|light"]` selector
- `public/index.html` — Main HTML with sidebar (Sessions/History) + main tabs (Chat/Raw/Git/Files/Bash)

## Architecture Decisions

- **No SPA framework**: Vanilla JS with `$()` selector helper, DOM manipulation directly
- **Single IIFE** in main.js — all code wrapped in `(function() { ... })()`
- **CSS custom properties** for theming — `var(--bg)`, `var(--accent)`, etc. Toggle via `data-theme` attribute
- **Session files**: Claude CLI stores sessions in `~/.claude/sessions/{PID}.json` (process metadata) and `~/.claude/projects/{encoded-cwd}/{sessionId}.jsonl` (transcript)
- **Active session detection**: Read `~/.claude/sessions/*.json`, validate PID with `process.kill(pid, 0)`, resolve `/clear` session ID overrides by finding the most recently modified .jsonl in the project dir
- **xterm.js**: Vendored (not npm), loaded via script tags. Two instances: one for Raw tab (Claude PTY), one for Bash tab (shell PTY)
- **Route ordering matters** in session-api.js: static routes (`/directories`, `/projects`, `/active/list`, `/find-recent`) must come BEFORE `/:sessionId` to avoid Express treating them as sessionId params

## Conventions

- **No comments** unless explaining non-obvious WHY
- **No emojis** unless user explicitly requests
- **Short variable names** in frontend are fine (`$`, `$$`, DOM element refs like `chatMessages`, `gitContent`)
- **Chinese** for user-facing discussion, **English** for code and commit messages
- Commit messages: imperative mood, concise, focus on why not what

## Session Timeout Logic

- Configured via `.env` `SESSION_TIMEOUT_MS` (default 30 min)
- Only applies to sessions started from claude-web (not externally-detected Claude processes)
- Skip killing if Claude status is `busy` (read from `~/.claude/sessions/{PID}.json`)
- Kill sequence: SIGINT x2 (1s apart), then SIGKILL after 5s
- Check runs every 60 seconds via `setInterval`

## Common Gotchas

- xterm.js cannot initialize in a `display: none` container — dimensions will be 0. Always ensure the container is visible before calling `open()` + `fit()`, or temporarily make it visible
- The `decodeProjectDir` function uses a reverse map from `history.jsonl` because simple `dirName.replace(/-/g, '/')` is ambiguous (dashes in dir names)
- `@homebridge/node-pty-prebuilt-multiarch` is used instead of `node-pty` because the latter requires native compilation that fails on some systems
