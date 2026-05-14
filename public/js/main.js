(function () {
  'use strict';

  // --- State ---
  let currentWs = null;
  let currentTerm = null;
  let currentFitAddon = null;
  let currentSessionId = null;
  let activeSessions = new Map(); // sessionId -> { ws, title, cwd }

  let currentReplaySessionId = null;
  let currentReplayProjectDir = null;
  let currentReplayCwd = null;
  let currentReplayTitle = null;

  // Working directory for Git/Files panels
  let workingDir = null;

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const welcomeEl = $('#welcome');
  const terminalContainer = $('#terminal-container');
  const replayContainer = $('#replay-container');
  const projectsList = $('#projects-list');
  const activeSessionsList = $('#active-sessions-list');
  const terminalEl = $('#terminal');
  const newSessionDialog = $('#new-session-dialog');
  const sessionCwdSelect = $('#session-cwd');
  const gitContent = $('#git-content');
  const filesContent = $('#files-content');

  // ---- Sidebar tab switching ----
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'history' && projectsList.querySelector('.loading')) {
        loadProjects();
      }
    });
  });

  // ---- Main panel tab switching ----
  $$('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.main-tab').forEach(t => t.classList.remove('active'));
      $$('.main-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`#panel-${tab.dataset.panel}`).classList.add('active');

      // Trigger data load on first visit
      if (tab.dataset.panel === 'git') loadGit();
      if (tab.dataset.panel === 'files') loadFiles();
      if (tab.dataset.panel === 'terminal' && currentTerm) {
        setTimeout(() => currentFitAddon && currentFitAddon.fit(), 50);
      }
    });
  });

  // ---- New session ----
  $('#new-session-btn').addEventListener('click', openNewSessionDialog);
  $('#welcome-new-btn').addEventListener('click', openNewSessionDialog);

  $('#welcome-history-btn').addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $('[data-tab="history"]').classList.add('active');
    $('#tab-history').classList.add('active');
    loadProjects();
  });

  $('#dialog-cancel').addEventListener('click', () => newSessionDialog.classList.add('hidden'));
  $('#dialog-start').addEventListener('click', () => {
    newSessionDialog.classList.add('hidden');
    startNewSession(sessionCwdSelect.value);
  });
  sessionCwdSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      newSessionDialog.classList.add('hidden');
      startNewSession(sessionCwdSelect.value);
    }
  });

  // ---- Terminal actions ----
  $('#detach-btn').addEventListener('click', () => {
    if (currentWs) { currentWs.close(); currentWs = null; }
    showWelcome();
  });
  $('#kill-btn').addEventListener('click', () => {
    if (currentWs) {
      currentWs.send(JSON.stringify({ type: 'pty-input', data: '\x03' }));
      setTimeout(() => { if (currentWs) { currentWs.close(); currentWs = null; } }, 500);
    }
    showWelcome();
  });

  // ---- Replay ----
  $('#replay-close-btn').addEventListener('click', () => { replayContainer.classList.add('hidden'); });
  $('#resume-btn').addEventListener('click', () => {
    if (!currentReplaySessionId) return;
    resumeSession(currentReplaySessionId, currentReplayCwd || '');
  });

  // ---- View helpers ----
  function showWelcome() {
    welcomeEl.classList.remove('hidden');
    terminalContainer.classList.add('hidden');
    currentTerm = null; currentWs = null; currentSessionId = null;
  }

  function setWorkingDir(dir) {
    workingDir = dir;
  }

  // ---- New session dialog ----
  async function openNewSessionDialog() {
    sessionCwdSelect.innerHTML = '<option value="">Loading...</option>';
    newSessionDialog.classList.remove('hidden');
    try {
      const res = await fetch('/api/sessions/directories');
      const data = await res.json();
      sessionCwdSelect.innerHTML = '';
      const home = data.directories.find(d => d.startsWith('/Users/')) || data.directories[0];
      for (const dir of data.directories) {
        const opt = document.createElement('option');
        opt.value = dir;
        opt.textContent = dir.replace(window._homeDir || '', '~');
        if (dir === home) opt.selected = true;
        sessionCwdSelect.appendChild(opt);
      }
    } catch (err) {
      sessionCwdSelect.innerHTML = `<option value="">Error: ${err.message}</option>`;
    }
  }

  // ---- PTY Session ----
  function startNewSession(cwd) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}?action=new&cwd=${encodeURIComponent(cwd || '')}`);
    ws.onopen = () => setupTerminal(ws);
    ws.onmessage = handlePtyWsMessage;
    ws.onclose = () => { if (currentTerm && currentTerm.element) currentTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n'); };
    currentWs = ws;
    setWorkingDir(cwd);
  }

  function resumeSession(sessionId, cwd) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}?action=resume&sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(cwd || '')}`);
    ws.onopen = () => setupTerminal(ws);
    ws.onmessage = handlePtyWsMessage;
    ws.onclose = () => { if (currentTerm && currentTerm.element) currentTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n'); };
    currentWs = ws;
    setWorkingDir(cwd);
    // Switch to terminal tab + sidebar Sessions tab
    switchMainTab('terminal');
    switchSidebarTab('sessions');
    replayContainer.classList.add('hidden');
  }

  function handlePtyWsMessage(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'session-started') {
        currentSessionId = msg.sessionId;
        const cwd = sessionCwdSelect.value || currentReplayCwd || '';
        const title = msg.resumedFrom
          ? currentReplayTitle || 'Resumed Session'
          : cwd ? cwd.replace(window._homeDir || '', '~') : 'New Session';
        addActiveSession(msg.sessionId, currentWs, title, cwd);
        $('#terminal-title').textContent = title;
      } else if (msg.type === 'pty-data') {
        if (currentTerm) currentTerm.write(msg.data);
      } else if (msg.type === 'pty-exit') {
        if (currentTerm) currentTerm.write('\r\n\x1b[33m[Session exited]\x1b[0m\r\n');
      }
    } catch (e) {
      if (currentTerm) currentTerm.write(event.data);
    }
  }

  function setupTerminal(ws) {
    if (currentTerm) currentTerm.dispose();
    const term = new Terminal({
      cursorBlink: true, fontSize: 14,
      fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      theme: {
        background: '#1a1a2e', foreground: '#e0e0e0', cursor: '#7c3aed', cursorAccent: '#1a1a2e',
        selectionBackground: '#7c3aed44',
        black: '#1a1a2e', red: '#ef4444', green: '#10b981', yellow: '#f59e0b',
        blue: '#3b82f6', magenta: '#7c3aed', cyan: '#06b6d4', white: '#e0e0e0',
        brightBlack: '#6b7280', brightRed: '#f87171', brightGreen: '#34d399',
        brightYellow: '#fbbf24', brightBlue: '#60a5fa', brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee', brightWhite: '#f3f4f6',
      },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalEl);
    fitAddon.fit();

    term.onData((data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pty-input', data })); });
    term.onResize(({ cols, rows }) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows })); });

    const ro = new ResizeObserver(() => { if (fitAddon) fitAddon.fit(); });
    ro.observe(terminalEl);

    currentTerm = term; currentFitAddon = fitAddon;
    welcomeEl.classList.add('hidden');
    terminalContainer.classList.remove('hidden');
    term.focus();
  }

  function switchMainTab(panel) {
    $$('.main-tab').forEach(t => t.classList.remove('active'));
    $$('.main-panel').forEach(p => p.classList.remove('active'));
    $(`.main-tab[data-panel="${panel}"]`).classList.add('active');
    $(`#panel-${panel}`).classList.add('active');
    if (panel === 'terminal' && currentTerm) setTimeout(() => currentFitAddon && currentFitAddon.fit(), 50);
  }

  function switchSidebarTab(tab) {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $(`.tab[data-tab="${tab}"]`).classList.add('active');
    $(`#tab-${tab}`).classList.add('active');
  }

  // ---- Active sessions ----
  function addActiveSession(sessionId, ws, title, cwd) {
    activeSessions.set(sessionId, { ws, title, cwd });
    renderActiveSessions();
  }

  function renderActiveSessions() {
    if (activeSessions.size === 0) {
      activeSessionsList.innerHTML = '<div class="empty-state">No active sessions.<br>Click + to start.</div>';
      return;
    }
    const groups = new Map();
    for (const [sessionId, data] of activeSessions) {
      const project = shortProject(data.cwd || '');
      if (!groups.has(project)) groups.set(project, []);
      groups.get(project).push({ sessionId, ...data });
    }

    activeSessionsList.innerHTML = '';
    for (const [project, sessions] of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'project-group';

      const header = document.createElement('div');
      header.className = 'project-header';
      header.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(project)} <span style="margin-left:auto;font-weight:400">(${sessions.length})</span>`;

      const listEl = document.createElement('div');
      listEl.className = 'project-sessions';

      header.addEventListener('click', () => { header.classList.toggle('collapsed'); listEl.classList.toggle('collapsed'); });

      for (const s of sessions) {
        const item = document.createElement('div');
        item.className = 'session-item' + (s.sessionId === currentSessionId ? ' active' : '');
        item.innerHTML = `<div class="session-title">${escapeHtml(s.title || 'Untitled')}</div><div class="session-meta">Active</div>`;
        item.addEventListener('click', () => {
          setWorkingDir(s.cwd);
          switchMainTab('terminal');
          if (currentTerm) currentTerm.focus();
        });
        listEl.appendChild(item);
      }

      groupEl.appendChild(header);
      groupEl.appendChild(listEl);
      activeSessionsList.appendChild(groupEl);
    }
  }

  // ---- History ----
  async function loadProjects() {
    try {
      const res = await fetch('/api/sessions/projects');
      const data = await res.json();
      if (data.projects.length === 0) {
        projectsList.innerHTML = '<div class="empty-state">No session history found.</div>';
        return;
      }
      projectsList.innerHTML = '';
      for (const project of data.projects) {
        const group = document.createElement('div');
        group.className = 'project-group';

        const header = document.createElement('div');
        header.className = 'project-header';
        const displayPath = shortProject(project.projectPath);
        header.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(displayPath)} <span style="margin-left:auto;font-weight:400">(${project.sessionCount})</span>`;

        const sessionsDiv = document.createElement('div');
        sessionsDiv.className = 'project-sessions';

        header.addEventListener('click', () => { header.classList.toggle('collapsed'); sessionsDiv.classList.toggle('collapsed'); });

        for (const session of project.sessions) {
          const title = session.title || 'Untitled';
          const time = session.lastModified ? new Date(session.lastModified).toLocaleString() : '';
          const item = document.createElement('div');
          item.className = 'session-item';
          item.innerHTML = `<div class="session-title">${escapeHtml(title)}</div><div class="session-meta">${time}</div>`;
          item.addEventListener('click', () => openConversation(session.sessionId, project.dirName, project.projectPath, title));
          sessionsDiv.appendChild(item);
        }

        group.appendChild(header);
        group.appendChild(sessionsDiv);
        projectsList.appendChild(group);
      }
    } catch (err) {
      projectsList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  // ---- Replay ----
  async function openConversation(sessionId, projectDir, projectPath, title) {
    currentReplaySessionId = sessionId;
    currentReplayProjectDir = projectDir;
    currentReplayCwd = projectPath;
    currentReplayTitle = title;

    const messagesDiv = $('#replay-messages');
    messagesDiv.innerHTML = '<div class="loading">Loading conversation...</div>';
    $('#replay-title').textContent = title || 'Untitled';
    replayContainer.classList.remove('hidden');

    try {
      const res = await fetch(`/api/sessions/${sessionId}/conversation?project=${encodeURIComponent(projectDir || '')}`);
      const data = await res.json();
      messagesDiv.innerHTML = '';
      if (data.turns.length === 0) { messagesDiv.innerHTML = '<div class="empty-state">No messages.</div>'; return; }
      for (const turn of data.turns) renderTurn(turn, messagesDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (err) {
      messagesDiv.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  function renderTurn(turn, container) {
    const div = document.createElement('div');
    div.className = `turn turn-${turn.role}`;

    const roleLabel = document.createElement('div');
    roleLabel.className = 'turn-role';
    roleLabel.textContent = turn.role === 'user' ? 'You' : turn.role === 'assistant' ? 'Claude' : 'System';

    const timeLabel = document.createElement('div');
    timeLabel.className = 'turn-time';
    timeLabel.textContent = turn.timestamp ? new Date(turn.timestamp).toLocaleString() : '';

    const bubble = document.createElement('div');
    bubble.className = 'turn-bubble';

    for (const part of turn.parts) {
      if (part.type === 'text' && part.text) {
        const el = document.createElement('div');
        el.className = 'part-text';
        el.textContent = part.text;
        bubble.appendChild(el);
      } else if (part.type === 'thinking' && part.text) {
        const el = document.createElement('div');
        el.className = 'part-thinking';
        el.textContent = part.text;
        el.addEventListener('click', () => el.classList.toggle('expanded'));
        bubble.appendChild(el);
      } else if (part.type === 'tool_use') {
        bubble.appendChild(createToolUseElement(part));
      }
    }

    if (turn.role === 'user') { div.appendChild(roleLabel); div.appendChild(timeLabel); div.appendChild(bubble); }
    else if (turn.role === 'assistant') { div.appendChild(roleLabel); div.appendChild(bubble); div.appendChild(timeLabel); }
    else { div.appendChild(bubble); }

    container.appendChild(div);
  }

  function createToolUseElement(part) {
    const wrapper = document.createElement('div');
    wrapper.className = 'part-tool-use';
    const header = document.createElement('div');
    header.className = 'tool-use-header';
    header.innerHTML = `<span class="tool-use-icon">${getToolIcon(part.name)}</span><span class="tool-use-name">${escapeHtml(part.name)}</span><span class="tool-use-toggle">▼</span>`;
    const body = document.createElement('div');
    body.className = 'tool-use-body';
    let html = `<div class="tool-use-input">${escapeHtml(truncate(JSON.stringify(part.input, null, 2), 2000))}</div>`;
    if (part.result) html += `<div class="tool-use-result">${escapeHtml(truncate(part.result, 1500))}</div>`;
    body.innerHTML = html;
    header.addEventListener('click', () => {
      body.classList.toggle('expanded');
      header.querySelector('.tool-use-toggle').textContent = body.classList.contains('expanded') ? '▲' : '▼';
    });
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return wrapper;
  }

  // ============================================================
  //  Git Panel
  // ============================================================
  let gitDir = null;

  async function loadGit() {
    if (!workingDir) {
      gitContent.innerHTML = '<div class="empty-state">Start a session first to view Git info.</div>';
      return;
    }
    gitDir = workingDir;

    gitContent.innerHTML = '<div class="loading">Loading Git...</div>';
    try {
      const [statusRes, logRes] = await Promise.all([
        fetch(`/api/git/status?dir=${encodeURIComponent(gitDir)}`),
        fetch(`/api/git/log?dir=${encodeURIComponent(gitDir)}`),
      ]);
      const status = await statusRes.json();
      const log = await logRes.json();

      if (status.error) { gitContent.innerHTML = `<div class="empty-state">Not a Git repo: ${status.error}</div>`; return; }

      let html = '';

      // Branch bar
      html += '<div class="git-branch-bar">';
      html += `<span class="branch-name">${escapeHtml(status.branch.name || 'unknown')}</span>`;
      if (status.branch.ahead) html += `<span class="ahead-behind ahead">↑${status.branch.ahead}</span>`;
      if (status.branch.behind) html += `<span class="ahead-behind behind">↓${status.branch.behind}</span>`;
      html += '</div>';

      // Staged
      if (status.staged.length) {
        html += '<div class="git-section"><div class="git-section-title">Staged Changes</div>';
        for (const f of status.staged) html += `<div class="git-file-item" data-file="${escapeAttr(f.path)}" data-staged="1"><span class="git-file-status ${f.status}">${f.status}</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`;
        html += '</div>';
      }

      // Unstaged
      if (status.unstaged.length) {
        html += '<div class="git-section"><div class="git-section-title">Unstaged Changes</div>';
        for (const f of status.unstaged) html += `<div class="git-file-item" data-file="${escapeAttr(f.path)}" data-staged="0"><span class="git-file-status ${f.status}">${f.status}</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`;
        html += '</div>';
      }

      // Untracked
      if (status.untracked.length) {
        html += '<div class="git-section"><div class="git-section-title">Untracked Files</div>';
        for (const f of status.untracked) html += `<div class="git-file-item"><span class="git-file-status ?">?</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`;
        html += '</div>';
      }

      // Log
      if (log.commits && log.commits.length) {
        html += '<div class="git-section"><div class="git-section-title">Recent Commits</div>';
        for (const c of log.commits) {
          html += `<div class="git-commit" data-hash="${c.hash}"><div class="git-commit-header"><span class="git-commit-hash">${c.shortHash}</span><span class="git-commit-msg">${escapeHtml(c.message)}</span></div><div class="git-commit-meta">${escapeHtml(c.author)} · ${timeAgo(c.date)}</div></div>`;
        }
        html += '</div>';
      }

      gitContent.innerHTML = html;

      // Bind click on file items -> show diff
      gitContent.querySelectorAll('.git-file-item[data-file]').forEach(el => {
        el.addEventListener('click', () => showGitDiff(el.dataset.file, el.dataset.staged === '1'));
      });
    } catch (err) {
      gitContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  async function showGitDiff(file, staged) {
    const existing = gitContent.querySelector('.git-diff');
    if (existing) existing.remove();

    const diffRes = await fetch(`/api/git/diff?dir=${encodeURIComponent(gitDir)}&file=${encodeURIComponent(file)}&staged=${staged ? 1 : 0}`);
    const data = await diffRes.json();
    if (data.error) return;

    const div = document.createElement('div');
    div.className = 'git-diff';
    div.textContent = data.diff || '(no changes)';
    gitContent.appendChild(div);
  }

  // ============================================================
  //  Files Panel
  // ============================================================
  let filesDir = null;

  async function loadFiles(dir) {
    filesDir = dir || workingDir || null;
    if (!filesDir) {
      filesContent.innerHTML = '<div class="empty-state">Start a session first to browse files.</div>';
      return;
    }

    filesContent.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const res = await fetch(`/api/files/list?dir=${encodeURIComponent(filesDir)}`);
      const data = await res.json();
      if (data.error) { filesContent.innerHTML = `<div class="empty-state">${data.error}</div>`; return; }

      filesDir = data.path;
      let html = '';

      // Breadcrumb
      html += '<div class="files-toolbar"><div class="files-breadcrumb">';
      const parts = filesDir.split('/').filter(Boolean);
      const homeParts = (window._homeDir || '').split('/').filter(Boolean);
      let buildPath = '';
      for (let i = 0; i < parts.length; i++) {
        buildPath += '/' + parts[i];
        const isLast = i === parts.length - 1;
        const label = (i < homeParts.length && parts[i] === homeParts[i]) ? (i === homeParts.length - 1 ? '~' : '') : parts[i];
        if (!label) { buildPath += '/' + parts[i]; continue; }
        if (i > 0 && parts[i - 1] === homeParts[i - 1] && i < homeParts.length) { /* skip middle home dirs */ }
        if (i > 0) html += '<span class="sep">/</span>';
        html += `<span class="${isLast ? 'current' : ''}" data-dir="${escapeAttr(buildPath)}">${escapeHtml(label)}</span>`;
      }
      html += '</div></div>';

      // File list
      html += '<div class="file-list">';
      // Parent dir
      if (data.parent && data.parent !== filesDir) {
        html += `<div class="file-item" data-dir="${escapeAttr(data.parent)}"><span class="file-icon">📁</span><span class="file-name">..</span><span class="file-size"></span><span class="file-modified"></span></div>`;
      }
      for (const item of data.items) {
        const icon = item.type === 'dir' ? '📁' : fileIcon(item.name);
        const size = item.type === 'file' ? formatSize(item.size) : '';
        const mod = item.modified ? new Date(item.modified).toLocaleDateString() : '';
        if (item.type === 'dir') {
          html += `<div class="file-item" data-dir="${escapeAttr(item.path)}"><span class="file-icon">${icon}</span><span class="file-name">${escapeHtml(item.name)}</span><span class="file-size"></span><span class="file-modified">${mod}</span></div>`;
        } else {
          html += `<div class="file-item" data-file="${escapeAttr(item.path)}"><span class="file-icon">${icon}</span><span class="file-name">${escapeHtml(item.name)}</span><span class="file-size">${size}</span><span class="file-modified">${mod}</span></div>`;
        }
      }
      html += '</div>';

      filesContent.innerHTML = html;

      // Bind clicks
      filesContent.querySelectorAll('.file-item[data-dir]').forEach(el => {
        el.addEventListener('click', () => loadFiles(el.dataset.dir));
      });
      filesContent.querySelectorAll('.file-item[data-file]').forEach(el => {
        el.addEventListener('click', () => readFile(el.dataset.file));
      });
      filesContent.querySelectorAll('.files-breadcrumb span[data-dir]').forEach(el => {
        el.addEventListener('click', () => { if (!el.classList.contains('current')) loadFiles(el.dataset.dir); });
      });
    } catch (err) {
      filesContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  async function readFile(filePath) {
    // Remove existing viewer
    const existing = filesContent.querySelector('.file-viewer');
    if (existing) existing.remove();

    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.error) return;
      if (data.truncated) {
        const div = document.createElement('div');
        div.className = 'file-viewer';
        div.innerHTML = `<div class="file-viewer-header"><span class="file-viewer-path">${escapeHtml(data.path)} (${formatSize(data.size)})</span><button class="file-viewer-close">Close</button></div><div>File too large to display (${formatSize(data.size)})</div>`;
        div.querySelector('.file-viewer-close').addEventListener('click', () => div.remove());
        filesContent.appendChild(div);
        return;
      }

      const div = document.createElement('div');
      div.className = 'file-viewer';
      div.innerHTML = `<div class="file-viewer-header"><span class="file-viewer-path">${escapeHtml(data.path)}</span><button class="file-viewer-close">Close</button></div><div>${escapeHtml(data.content)}</div>`;
      div.querySelector('.file-viewer-close').addEventListener('click', () => div.remove());
      filesContent.appendChild(div);
      div.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {}
  }

  // ============================================================
  //  Helpers
  // ============================================================
  function shortProject(cwd) {
    if (!cwd) return '~';
    const parts = cwd.replace(/\/+$/, '').split('/').filter(Boolean);
    return parts.slice(-2).join('/');
  }

  function getToolIcon(name) {
    return { Bash: '⌘', Read: '📄', Write: '✏️', Edit: '✏️', Grep: '🔍', Agent: '🤖', WebSearch: '🌐', WebFetch: '📡' }[name] || '🔧';
  }

  function fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    return { js: '🟨', ts: '🔷', json: '📋', md: '📝', css: '🎨', html: '🌐', py: '🐍', go: '🐹', rs: '🦀', sh: '⚙️', yaml: '⚙️', yml: '⚙️', toml: '⚙️', sql: '🗃️' }[ext] || '📄';
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'K';
    return (bytes / 1024 / 1024).toFixed(1) + 'M';
  }

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '...' : str;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Keyboard shortcuts ----
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); openNewSessionDialog(); }
  });

  // ---- Init ----
  fetch('/api/sessions/directories')
    .then(r => r.json())
    .then(d => { window._homeDir = d.directories.find(dir => dir.startsWith('/Users/')); })
    .catch(() => {});

  showWelcome();
})();
