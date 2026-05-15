(function () {
  'use strict';

  // ---- State ----
  let currentWs = null;
  let rawTerm = null;
  let rawFitAddon = null;
  let currentSessionId = null;
  let activeSessions = new Map();

  let currentReplaySessionId = null;
  let currentReplayProjectDir = null;
  let currentReplayCwd = null;
  let currentReplayTitle = null;

  let workingDir = null;

  // Chat polling state
  let chatClaudeSessionId = null; // The real Claude session ID from JSONL
  let chatProjectDir = null;      // The project dirName for API calls
  let chatPollTimer = null;
  let chatRenderedCount = 0;
  let chatSessionStartMs = 0;
  let chatWaitingResponse = false;

  // ---- DOM ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const welcomeEl = $('#welcome');
  const chatContainer = $('#chat-container');
  const chatMessages = $('#chat-messages');
  const chatInput = $('#chat-input');
  const chatSendBtn = $('#chat-send-btn');
  const projectsList = $('#projects-list');
  const activeSessionsList = $('#active-sessions-list');
  const newSessionDialog = $('#new-session-dialog');
  const sessionCwdSelect = $('#session-cwd');
  const replayContainer = $('#replay-container');
  const gitContent = $('#git-content');
  const filesContent = $('#files-content');

  // ============ Theme ============
  function initTheme() {
    const saved = localStorage.getItem('cw-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    updateThemeIcon();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('cw-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        updateThemeIcon();
      }
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cw-theme', next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('#theme-toggle-btn').textContent = isDark ? '🌙' : '☀️';
  }

  $('#theme-toggle-btn').addEventListener('click', toggleTheme);
  initTheme();

  // ============ Sidebar tabs ============
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'history' && projectsList.querySelector('.loading')) loadProjects();
    });
  });

  function switchSidebarTab(tab) {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $(`.tab[data-tab="${tab}"]`).classList.add('active');
    $(`#tab-${tab}`).classList.add('active');
  }

  // ============ Main panel tabs ============
  $$('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchMainTab(tab.dataset.panel);
    });
  });

  function switchMainTab(panel) {
    $$('.main-tab').forEach(t => t.classList.remove('active'));
    $$('.main-panel').forEach(p => p.classList.remove('active'));
    $(`.main-tab[data-panel="${panel}"]`).classList.add('active');
    $(`#panel-${panel}`).classList.add('active');
    if (panel === 'raw-terminal' && rawTerm) setTimeout(() => rawFitAddon && rawFitAddon.fit(), 50);
    if (panel === 'git') loadGit();
    if (panel === 'files') loadFiles();
  }

  // ============ New session dialog ============
  $('#new-session-btn').addEventListener('click', openNewSessionDialog);
  $('#welcome-new-btn').addEventListener('click', openNewSessionDialog);
  $('#welcome-history-btn').addEventListener('click', () => {
    switchSidebarTab('history'); loadProjects();
  });
  $('#dialog-cancel').addEventListener('click', () => newSessionDialog.classList.add('hidden'));
  $('#dialog-start').addEventListener('click', () => {
    newSessionDialog.classList.add('hidden');
    startNewSession(sessionCwdSelect.value);
  });
  sessionCwdSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { newSessionDialog.classList.add('hidden'); startNewSession(sessionCwdSelect.value); }
  });

  async function openNewSessionDialog() {
    sessionCwdSelect.innerHTML = '<option value="">Loading...</option>';
    newSessionDialog.classList.remove('hidden');
    try {
      const data = await (await fetch('/api/sessions/directories')).json();
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

  // ============ PTY Session ============
  function startNewSession(cwd) {
    workingDir = cwd;
    chatSessionStartMs = Date.now();
    chatClaudeSessionId = null;
    chatRenderedCount = 0;
    chatWaitingResponse = false;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}?action=new&cwd=${encodeURIComponent(cwd || '')}`);
    ws.onopen = () => setupRawTerminal(ws);
    ws.onmessage = handlePtyWsMessage;
    ws.onclose = () => { if (rawTerm) rawTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n'); };
    currentWs = ws;

    showChat();
    chatMessages.innerHTML = '';
    addChatTyping();
    discoverSession();
  }

  function resumeSession(sessionId, cwd) {
    workingDir = cwd;
    chatSessionStartMs = Date.now();

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}?action=resume&sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(cwd || '')}`);
    ws.onopen = () => setupRawTerminal(ws);
    ws.onmessage = handlePtyWsMessage;
    ws.onclose = () => { if (rawTerm) rawTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n'); };
    currentWs = ws;

    showChat();
    chatMessages.innerHTML = '';
    addChatTyping();
    switchSidebarTab('sessions');
    replayContainer.classList.add('hidden');

    // For resume, we already know the Claude session ID
    chatClaudeSessionId = sessionId;
    chatProjectDir = cwd ? cwd.replace(/\//g, '-') : null;
    chatRenderedCount = 0;
    startChatPoll();
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
        $('#chat-title').textContent = title;
      } else if (msg.type === 'pty-data') {
        if (rawTerm) rawTerm.write(msg.data);
      } else if (msg.type === 'pty-exit') {
        if (rawTerm) rawTerm.write('\r\n\x1b[33m[Session exited]\x1b[0m\r\n');
        stopChatPoll();
      }
    } catch (e) {
      if (rawTerm) rawTerm.write(event.data);
    }
  }

  function setupRawTerminal(ws) {
    if (rawTerm) rawTerm.dispose();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const term = new Terminal({
      cursorBlink: true, fontSize: 14,
      fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      theme: isDark ? {
        background: '#1a1a2e', foreground: '#e0e0e0', cursor: '#7c3aed', cursorAccent: '#1a1a2e',
        selectionBackground: '#7c3aed44',
        black: '#1a1a2e', red: '#ef4444', green: '#10b981', yellow: '#f59e0b',
        blue: '#3b82f6', magenta: '#7c3aed', cyan: '#06b6d4', white: '#e0e0e0',
        brightBlack: '#6b7280', brightRed: '#f87171', brightGreen: '#34d399',
        brightYellow: '#fbbf24', brightBlue: '#60a5fa', brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee', brightWhite: '#f3f4f6',
      } : {
        background: '#ffffff', foreground: '#1a1a1a', cursor: '#7c3aed', cursorAccent: '#ffffff',
        selectionBackground: '#7c3aed33',
        black: '#1a1a1a', red: '#ef4444', green: '#059669', yellow: '#d97706',
        blue: '#2563eb', magenta: '#7c3aed', cyan: '#0891b2', white: '#f5f5f5',
        brightBlack: '#6b7280', brightRed: '#f87171', brightGreen: '#34d399',
        brightYellow: '#fbbf24', brightBlue: '#60a5fa', brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee', brightWhite: '#1a1a1a',
      },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open($('#raw-terminal'));
    fitAddon.fit();

    term.onData((data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pty-input', data })); });
    term.onResize(({ cols, rows }) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows })); });

    const ro = new ResizeObserver(() => { if (fitAddon) fitAddon.fit(); });
    ro.observe($('#raw-terminal'));

    rawTerm = term; rawFitAddon = fitAddon;
  }

  // ============ Chat UI ============
  function showChat() {
    welcomeEl.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    switchMainTab('chat');
  }

  // Send message
  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentWs || currentWs.readyState !== WebSocket.OPEN) return;

    // Send to PTY
    currentWs.send(JSON.stringify({ type: 'pty-input', data: text + '\n' }));

    // Show user bubble immediately
    removeChatTyping();
    addChatBubble('user', text);
    addChatTyping();
    chatWaitingResponse = true;

    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  function addChatBubble(role, content) {
    const turn = document.createElement('div');
    turn.className = `chat-turn ${role}`;

    const roleLabel = document.createElement('div');
    roleLabel.className = 'chat-role';
    roleLabel.textContent = role === 'user' ? 'You' : 'Claude';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const textEl = document.createElement('div');
    textEl.className = 'chat-part-text';
    textEl.textContent = content;
    bubble.appendChild(textEl);

    if (role === 'user') {
      turn.appendChild(roleLabel);
      turn.appendChild(bubble);
    } else {
      turn.appendChild(roleLabel);
      turn.appendChild(bubble);
    }

    chatMessages.appendChild(turn);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return turn;
  }

  function addChatTyping() {
    removeChatTyping();
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chat-typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeChatTyping() {
    const el = $('#chat-typing-indicator');
    if (el) el.remove();
  }

  // Chat header actions
  $('#chat-detach-btn').addEventListener('click', () => {
    if (currentWs) { currentWs.close(); currentWs = null; }
    stopChatPoll();
    welcomeEl.classList.remove('hidden');
    chatContainer.classList.add('hidden');
  });
  $('#chat-kill-btn').addEventListener('click', () => {
    if (currentWs) {
      currentWs.send(JSON.stringify({ type: 'pty-input', data: '\x03' }));
      setTimeout(() => { if (currentWs) { currentWs.close(); currentWs = null; } }, 500);
    }
    stopChatPoll();
    welcomeEl.classList.remove('hidden');
    chatContainer.classList.add('hidden');
  });

  // ============ Session Discovery + Polling ============
  async function discoverSession() {
    if (!workingDir) return;
    // Wait for Claude CLI to create the session file
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      try {
        const res = await fetch(`/api/sessions/find-recent?dir=${encodeURIComponent(workingDir)}&afterMs=${chatSessionStartMs}`);
        const data = await res.json();
        if (data.found) {
          chatClaudeSessionId = data.sessionId;
          chatProjectDir = data.dirName;
          startChatPoll();
          return;
        }
      } catch (e) {}
    }
  }

  function startChatPoll() {
    stopChatPoll();
    chatPollTimer = setInterval(pollChatMessages, 3000);
    pollChatMessages();
  }

  function stopChatPoll() {
    if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
  }

  async function pollChatMessages() {
    if (!chatClaudeSessionId) return;
    try {
      const res = await fetch(`/api/sessions/${chatClaudeSessionId}/conversation?project=${encodeURIComponent(chatProjectDir || '')}`);
      const data = await res.json();
      if (!data.turns) return;

      const newTurns = data.turns.slice(chatRenderedCount);
      if (newTurns.length > 0) {
        removeChatTyping();
        for (const turn of newTurns) {
          renderChatTurn(turn);
        }
        chatRenderedCount = data.turns.length;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // If last turn is assistant, we got a response
        const lastTurn = data.turns[data.turns.length - 1];
        if (lastTurn && lastTurn.role === 'assistant') {
          chatWaitingResponse = false;
          // Check if Claude might still be typing (has tool_use without result)
          const hasToolUse = lastTurn.parts.some(p => p.type === 'tool_use');
          if (hasToolUse) addChatTyping();
        }
        if (lastTurn && lastTurn.role === 'user') {
          addChatTyping();
        }
      }
    } catch (e) {}
  }

  function renderChatTurn(turn) {
    const div = document.createElement('div');
    div.className = `chat-turn ${turn.role}`;

    const roleLabel = document.createElement('div');
    roleLabel.className = 'chat-role';
    roleLabel.textContent = turn.role === 'user' ? 'You' : turn.role === 'assistant' ? 'Claude' : 'System';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    for (const part of turn.parts) {
      if (part.type === 'text' && part.text) {
        const el = document.createElement('div');
        el.className = 'chat-part-text';
        el.textContent = part.text;
        bubble.appendChild(el);
      } else if (part.type === 'thinking' && part.text) {
        const el = document.createElement('div');
        el.className = 'chat-part-thinking';
        el.textContent = part.text;
        el.addEventListener('click', () => el.classList.toggle('expanded'));
        bubble.appendChild(el);
      } else if (part.type === 'tool_use') {
        bubble.appendChild(createChatToolUse(part));
      }
    }

    if (turn.role === 'user') {
      div.appendChild(roleLabel);
      div.appendChild(bubble);
    } else {
      div.appendChild(roleLabel);
      div.appendChild(bubble);
    }

    chatMessages.appendChild(div);
  }

  function createChatToolUse(part) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-part-tool';
    const header = document.createElement('div');
    header.className = 'chat-tool-header';
    header.innerHTML = `<span>${getToolIcon(part.name)}</span><span class="chat-tool-name">${escapeHtml(part.name)}</span><span class="chat-tool-toggle">▼</span>`;
    const body = document.createElement('div');
    body.className = 'chat-tool-body';
    let html = escapeHtml(truncate(JSON.stringify(part.input, null, 2), 1500));
    if (part.result) html += '\n---\n' + escapeHtml(truncate(part.result, 1000));
    body.innerHTML = html;
    header.addEventListener('click', () => {
      body.classList.toggle('expanded');
      header.querySelector('.chat-tool-toggle').textContent = body.classList.contains('expanded') ? '▲' : '▼';
    });
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return wrapper;
  }

  // ============ Active Sessions ============
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
      const groupEl = document.createElement('div'); groupEl.className = 'project-group';
      const header = document.createElement('div'); header.className = 'project-header';
      header.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(project)} <span style="margin-left:auto;font-weight:400">(${sessions.length})</span>`;
      const listEl = document.createElement('div'); listEl.className = 'project-sessions';
      header.addEventListener('click', () => { header.classList.toggle('collapsed'); listEl.classList.toggle('collapsed'); });
      for (const s of sessions) {
        const item = document.createElement('div');
        item.className = 'session-item' + (s.sessionId === currentSessionId ? ' active' : '');
        item.innerHTML = `<div class="session-title">${escapeHtml(s.title || 'Untitled')}</div><div class="session-meta">Active</div>`;
        item.addEventListener('click', () => { setWorkingDir(s.cwd); switchMainTab('chat'); });
        listEl.appendChild(item);
      }
      groupEl.appendChild(header); groupEl.appendChild(listEl);
      activeSessionsList.appendChild(groupEl);
    }
  }

  // ============ History ============
  async function loadProjects() {
    try {
      const data = await (await fetch('/api/sessions/projects')).json();
      if (!data.projects.length) { projectsList.innerHTML = '<div class="empty-state">No session history.</div>'; return; }
      projectsList.innerHTML = '';
      for (const project of data.projects) {
        const group = document.createElement('div'); group.className = 'project-group';
        const header = document.createElement('div'); header.className = 'project-header';
        header.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(shortProject(project.projectPath))} <span style="margin-left:auto;font-weight:400">(${project.sessionCount})</span>`;
        const sessionsDiv = document.createElement('div'); sessionsDiv.className = 'project-sessions';
        header.addEventListener('click', () => { header.classList.toggle('collapsed'); sessionsDiv.classList.toggle('collapsed'); });
        for (const session of project.sessions) {
          const title = session.title || 'Untitled';
          const time = session.lastModified ? new Date(session.lastModified).toLocaleString() : '';
          const item = document.createElement('div'); item.className = 'session-item';
          item.innerHTML = `<div class="session-title">${escapeHtml(title)}</div><div class="session-meta">${time}</div>`;
          item.addEventListener('click', () => openConversation(session.sessionId, project.dirName, project.projectPath, title));
          sessionsDiv.appendChild(item);
        }
        group.appendChild(header); group.appendChild(sessionsDiv);
        projectsList.appendChild(group);
      }
    } catch (err) { projectsList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  // ============ Replay ============
  async function openConversation(sessionId, projectDir, projectPath, title) {
    currentReplaySessionId = sessionId; currentReplayProjectDir = projectDir;
    currentReplayCwd = projectPath; currentReplayTitle = title;
    const messagesDiv = $('#replay-messages');
    messagesDiv.innerHTML = '<div class="loading">Loading...</div>';
    $('#replay-title').textContent = title || 'Untitled';
    replayContainer.classList.remove('hidden');
    try {
      const data = await (await fetch(`/api/sessions/${sessionId}/conversation?project=${encodeURIComponent(projectDir || '')}`)).json();
      messagesDiv.innerHTML = '';
      if (!data.turns.length) { messagesDiv.innerHTML = '<div class="empty-state">No messages.</div>'; return; }
      for (const turn of data.turns) renderTurn(turn, messagesDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (err) { messagesDiv.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  function renderTurn(turn, container) {
    const div = document.createElement('div'); div.className = `turn turn-${turn.role}`;
    const roleLabel = document.createElement('div'); roleLabel.className = 'turn-role';
    roleLabel.textContent = turn.role === 'user' ? 'You' : turn.role === 'assistant' ? 'Claude' : 'System';
    const timeLabel = document.createElement('div'); timeLabel.className = 'turn-time';
    timeLabel.textContent = turn.timestamp ? new Date(turn.timestamp).toLocaleString() : '';
    const bubble = document.createElement('div'); bubble.className = 'turn-bubble';
    for (const part of turn.parts) {
      if (part.type === 'text' && part.text) { const el = document.createElement('div'); el.className = 'part-text'; el.textContent = part.text; bubble.appendChild(el); }
      else if (part.type === 'thinking' && part.text) { const el = document.createElement('div'); el.className = 'part-thinking'; el.textContent = part.text; el.addEventListener('click', () => el.classList.toggle('expanded')); bubble.appendChild(el); }
      else if (part.type === 'tool_use') { bubble.appendChild(createToolUseElement(part)); }
    }
    if (turn.role === 'user') { div.appendChild(roleLabel); div.appendChild(timeLabel); div.appendChild(bubble); }
    else if (turn.role === 'assistant') { div.appendChild(roleLabel); div.appendChild(bubble); div.appendChild(timeLabel); }
    else { div.appendChild(bubble); }
    container.appendChild(div);
  }

  function createToolUseElement(part) {
    const wrapper = document.createElement('div'); wrapper.className = 'part-tool-use';
    const header = document.createElement('div'); header.className = 'tool-use-header';
    header.innerHTML = `<span class="tool-use-icon">${getToolIcon(part.name)}</span><span class="tool-use-name">${escapeHtml(part.name)}</span><span class="tool-use-toggle">▼</span>`;
    const body = document.createElement('div'); body.className = 'tool-use-body';
    let html = `<div class="tool-use-input">${escapeHtml(truncate(JSON.stringify(part.input, null, 2), 2000))}</div>`;
    if (part.result) html += `<div class="tool-use-result">${escapeHtml(truncate(part.result, 1500))}</div>`;
    body.innerHTML = html;
    header.addEventListener('click', () => { body.classList.toggle('expanded'); header.querySelector('.tool-use-toggle').textContent = body.classList.contains('expanded') ? '▲' : '▼'; });
    wrapper.appendChild(header); wrapper.appendChild(body);
    return wrapper;
  }

  $('#replay-close-btn').addEventListener('click', () => replayContainer.classList.add('hidden'));
  $('#resume-btn').addEventListener('click', () => { if (currentReplaySessionId) resumeSession(currentReplaySessionId, currentReplayCwd || ''); });

  // ============ Git ============
  let gitDir = null;

  async function loadGit() {
    if (!workingDir) { gitContent.innerHTML = '<div class="empty-state">Start a session first.</div>'; return; }
    gitDir = workingDir;
    gitContent.innerHTML = '<div class="loading">Loading Git...</div>';
    try {
      const [status, log] = await Promise.all([
        (await fetch(`/api/git/status?dir=${encodeURIComponent(gitDir)}`)).json(),
        (await fetch(`/api/git/log?dir=${encodeURIComponent(gitDir)}`)).json(),
      ]);
      if (status.error) { gitContent.innerHTML = `<div class="empty-state">Not a Git repo.</div>`; return; }
      let html = '<div class="git-branch-bar">';
      html += `<span class="branch-name">${escapeHtml(status.branch.name || '?')}</span>`;
      if (status.branch.ahead) html += `<span class="ahead-behind ahead">↑${status.branch.ahead}</span>`;
      if (status.branch.behind) html += `<span class="ahead-behind behind">↓${status.branch.behind}</span>`;
      html += '</div>';
      if (status.staged.length) { html += '<div class="git-section"><div class="git-section-title">Staged</div>'; for (const f of status.staged) html += `<div class="git-file-item" data-file="${escapeAttr(f.path)}" data-staged="1"><span class="git-file-status ${f.status}">${f.status}</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`; html += '</div>'; }
      if (status.unstaged.length) { html += '<div class="git-section"><div class="git-section-title">Unstaged</div>'; for (const f of status.unstaged) html += `<div class="git-file-item" data-file="${escapeAttr(f.path)}" data-staged="0"><span class="git-file-status ${f.status}">${f.status}</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`; html += '</div>'; }
      if (status.untracked.length) { html += '<div class="git-section"><div class="git-section-title">Untracked</div>'; for (const f of status.untracked) html += `<div class="git-file-item"><span class="git-file-status ?">?</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`; html += '</div>'; }
      if (log.commits?.length) { html += '<div class="git-section"><div class="git-section-title">Commits</div>'; for (const c of log.commits) html += `<div class="git-commit" data-hash="${c.hash}"><div class="git-commit-header"><span class="git-commit-hash">${c.shortHash}</span><span class="git-commit-msg">${escapeHtml(c.message)}</span></div><div class="git-commit-meta">${escapeHtml(c.author)} · ${timeAgo(c.date)}</div></div>`; html += '</div>'; }
      gitContent.innerHTML = html;
      gitContent.querySelectorAll('.git-file-item[data-file]').forEach(el => el.addEventListener('click', () => showGitDiff(el.dataset.file, el.dataset.staged === '1')));
    } catch (err) { gitContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  async function showGitDiff(file, staged) {
    const existing = gitContent.querySelector('.git-diff'); if (existing) existing.remove();
    const data = await (await fetch(`/api/git/diff?dir=${encodeURIComponent(gitDir)}&file=${encodeURIComponent(file)}&staged=${staged ? 1 : 0}`)).json();
    if (data.error) return;
    const div = document.createElement('div'); div.className = 'git-diff'; div.textContent = data.diff || '(no changes)';
    gitContent.appendChild(div);
  }

  // ============ Files ============
  let filesDir = null;

  async function loadFiles(dir) {
    filesDir = dir || workingDir || null;
    if (!filesDir) { filesContent.innerHTML = '<div class="empty-state">Start a session first.</div>'; return; }
    filesContent.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const data = await (await fetch(`/api/files/list?dir=${encodeURIComponent(filesDir)}`)).json();
      if (data.error) { filesContent.innerHTML = `<div class="empty-state">${data.error}</div>`; return; }
      filesDir = data.path;
      let html = '<div class="files-toolbar"><div class="files-breadcrumb">';
      const parts = filesDir.split('/').filter(Boolean);
      const homeParts = (window._homeDir || '').split('/').filter(Boolean);
      let buildPath = '';
      for (let i = 0; i < parts.length; i++) {
        buildPath += '/' + parts[i];
        const isLast = i === parts.length - 1;
        const label = (i < homeParts.length && parts[i] === homeParts[i]) ? (i === homeParts.length - 1 ? '~' : null) : parts[i];
        if (label === null) continue;
        if (i > 0) html += '<span class="sep">/</span>';
        html += `<span class="${isLast ? 'current' : ''}" data-dir="${escapeAttr(buildPath)}">${escapeHtml(label)}</span>`;
      }
      html += '</div></div><div class="file-list">';
      if (data.parent && data.parent !== filesDir) html += `<div class="file-item" data-dir="${escapeAttr(data.parent)}"><span class="file-icon">📁</span><span class="file-name">..</span></div>`;
      for (const item of data.items) {
        const icon = item.type === 'dir' ? '📁' : fileIcon(item.name);
        const size = item.type === 'file' ? formatSize(item.size) : '';
        const mod = item.modified ? new Date(item.modified).toLocaleDateString() : '';
        const attr = item.type === 'dir' ? `data-dir="${escapeAttr(item.path)}"` : `data-file="${escapeAttr(item.path)}"`;
        html += `<div class="file-item" ${attr}><span class="file-icon">${icon}</span><span class="file-name">${escapeHtml(item.name)}</span><span class="file-size">${size}</span><span class="file-modified">${mod}</span></div>`;
      }
      html += '</div>';
      filesContent.innerHTML = html;
      filesContent.querySelectorAll('.file-item[data-dir]').forEach(el => el.addEventListener('click', () => loadFiles(el.dataset.dir)));
      filesContent.querySelectorAll('.file-item[data-file]').forEach(el => el.addEventListener('click', () => readFile(el.dataset.file)));
      filesContent.querySelectorAll('.files-breadcrumb span[data-dir]').forEach(el => el.addEventListener('click', () => { if (!el.classList.contains('current')) loadFiles(el.dataset.dir); }));
    } catch (err) { filesContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  async function readFile(filePath) {
    const existing = filesContent.querySelector('.file-viewer'); if (existing) existing.remove();
    try {
      const data = await (await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)).json();
      if (data.error) return;
      const div = document.createElement('div'); div.className = 'file-viewer';
      if (data.truncated) {
        div.innerHTML = `<div class="file-viewer-header"><span class="file-viewer-path">${escapeHtml(data.path)}</span><button class="file-viewer-close">Close</button></div><div>File too large (${formatSize(data.size)})</div>`;
      } else {
        div.innerHTML = `<div class="file-viewer-header"><span class="file-viewer-path">${escapeHtml(data.path)}</span><button class="file-viewer-close">Close</button></div><div>${escapeHtml(data.content)}</div>`;
      }
      div.querySelector('.file-viewer-close').addEventListener('click', () => div.remove());
      filesContent.appendChild(div);
      div.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {}
  }

  // ============ Helpers ============
  function setWorkingDir(d) { workingDir = d; }
  function shortProject(cwd) { if (!cwd) return '~'; return cwd.replace(/\/+$/, '').split('/').filter(Boolean).slice(-2).join('/'); }
  function getToolIcon(name) { return { Bash: '⌘', Read: '📄', Write: '✏️', Edit: '✏️', Grep: '🔍', Agent: '🤖', WebSearch: '🌐', WebFetch: '📡' }[name] || '🔧'; }
  function fileIcon(name) { const ext = name.split('.').pop().toLowerCase(); return { js: '🟨', ts: '🔷', json: '📋', md: '📝', css: '🎨', html: '🌐', py: '🐍', go: '🐹', rs: '🦀', sh: '⚙️', yaml: '⚙️', yml: '⚙️', toml: '⚙️', sql: '🗃️' }[ext] || '📄'; }
  function formatSize(b) { if (!b) return ''; if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'K'; return (b / 1048576).toFixed(1) + 'M'; }
  function timeAgo(d) { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 2592000) return Math.floor(s / 86400) + 'd ago'; return new Date(d).toLocaleDateString(); }
  function truncate(s, m) { return (!s) ? '' : (s.length > m ? s.slice(0, m) + '...' : s); }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escapeAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); openNewSessionDialog(); } });

  // Init
  fetch('/api/sessions/directories').then(r => r.json()).then(d => { window._homeDir = d.directories.find(dir => dir.startsWith('/Users/')); }).catch(() => {});
})();
