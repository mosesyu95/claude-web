(function () {
  'use strict';

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
  let chatClaudeSessionId = null;
  let chatProjectDir = null;
  let chatPollTimer = null;
  let chatRenderedCount = 0;
  let chatSessionStartMs = 0;
  let bashTerm = null;
  let bashFitAddon = null;
  let bashWs = null;
  let gitDir = null;
  let filesDir = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // DOM element references
  const newSessionDialog = $('#new-session-dialog');
  const sessionCwdSelect = $('#session-cwd');
  const activeSessionsList = $('#active-sessions-list');
  const projectsList = $('#projects-list');
  const welcomeEl = $('#welcome');
  const chatContainer = $('#chat-container');
  const chatMessages = $('#chat-messages');
  const chatInput = $('#chat-input');
  const chatSendBtn = $('#chat-send-btn');
  const replayContainer = $('#replay-container');
  const gitContent = $('#git-content');
  const filesContent = $('#files-content');

  // ========== Theme ==========
  function initTheme() {
    const saved = localStorage.getItem('cw-theme');
    if (saved) { document.documentElement.setAttribute('data-theme', saved); }
    else { document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
    updateThemeIcon();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('cw-theme')) { document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light'); updateThemeIcon(); }
    });
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cw-theme', next);
    updateThemeIcon();
  }
  function updateThemeIcon() { $('#theme-toggle-btn').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️'; }
  $('#theme-toggle-btn').addEventListener('click', toggleTheme);
  initTheme();

  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  // ========== Sidebar tabs ==========
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $(`#tab-${t.dataset.tab}`).classList.add('active');
    if (t.dataset.tab === 'history' && projectsList.querySelector('.loading')) loadProjects();
  }));

  function switchSidebarTab(tab) {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $(`.tab[data-tab="${tab}"]`).classList.add('active');
    $(`#tab-${tab}`).classList.add('active');
  }

  // ========== Main tabs ==========
  $$('.main-tab').forEach(t => t.addEventListener('click', () => switchMainTab(t.dataset.panel)));

  function switchMainTab(panel) {
    $$('.main-tab').forEach(t => t.classList.remove('active'));
    $$('.main-panel').forEach(p => p.classList.remove('active'));
    $(`.main-tab[data-panel="${panel}"]`).classList.add('active');
    $(`#panel-${panel}`).classList.add('active');
    if (panel === 'raw' && rawTerm) setTimeout(() => { rawFitAddon?.fit(); rawTerm.focus(); }, 50);
    if (panel === 'bash' && bashTerm) setTimeout(() => bashFitAddon?.fit(), 50);
    if (panel === 'git') loadGit();
    if (panel === 'files') loadFiles();
  }

  // ========== New session dialog ==========
  $('#new-session-btn').addEventListener('click', openNewSessionDialog);
  $('#welcome-new-btn').addEventListener('click', openNewSessionDialog);
  $('#welcome-history-btn').addEventListener('click', () => { switchSidebarTab('history'); loadProjects(); });
  $('#dialog-cancel').addEventListener('click', () => newSessionDialog.classList.add('hidden'));
  $('#dialog-start').addEventListener('click', () => { newSessionDialog.classList.add('hidden'); startNewSession(sessionCwdSelect.value); });
  sessionCwdSelect.addEventListener('keydown', e => { if (e.key === 'Enter') { newSessionDialog.classList.add('hidden'); startNewSession(sessionCwdSelect.value); } });

  async function openNewSessionDialog() {
    sessionCwdSelect.innerHTML = '<option value="">Loading...</option>';
    newSessionDialog.classList.remove('hidden');
    try {
      const data = await (await fetch('/api/sessions/directories')).json();
      sessionCwdSelect.innerHTML = '';
      const home = data.directories.find(d => d.startsWith('/Users/')) || data.directories[0];
      for (const dir of data.directories) {
        const opt = document.createElement('option');
        opt.value = dir; opt.textContent = dir.replace(window._homeDir || '', '~');
        if (dir === home) opt.selected = true;
        sessionCwdSelect.appendChild(opt);
      }
    } catch (err) { sessionCwdSelect.innerHTML = `<option value="">Error: ${err.message}</option>`; }
  }

  // ========== PTY Session ==========
  function startNewSession(cwd) {
    workingDir = cwd; chatSessionStartMs = Date.now();
    chatClaudeSessionId = null; chatRenderedCount = 0;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}?action=new&cwd=${encodeURIComponent(cwd || '')}`);
    ws.onopen = () => setupRawTerminal(ws);
    ws.onmessage = handlePtyWsMessage;
    ws.onclose = () => { if (rawTerm) rawTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n'); };
    currentWs = ws;
    showChat(); chatMessages.innerHTML = ''; addChatTyping();
    discoverSession();
  }

  let pendingResumeTitle = null;

  function resumeSession(sessionId, cwd, title) {
    workingDir = cwd; chatSessionStartMs = Date.now();
    chatClaudeSessionId = sessionId;
    chatProjectDir = cwd ? cwd.replace(/\//g, '-') : null;
    chatRenderedCount = 0;
    pendingResumeTitle = title || null;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}?action=resume&sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(cwd || '')}`);
    ws.onopen = () => setupRawTerminal(ws);
    ws.onmessage = handlePtyWsMessage;
    ws.onclose = () => { if (rawTerm) rawTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n'); };
    currentWs = ws;
    showChat(); chatMessages.innerHTML = ''; addChatTyping();
    switchSidebarTab('sessions'); replayContainer.classList.add('hidden');
    startChatPoll();
  }

  function handlePtyWsMessage(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'session-started') {
        currentSessionId = msg.sessionId;
        const cwd = sessionCwdSelect.value || currentReplayCwd || workingDir || '';
        const title = pendingResumeTitle || currentReplayTitle || (cwd ? cwd.replace(window._homeDir || '', '~') : 'New Session');
        pendingResumeTitle = null;
        addActiveSession(msg.sessionId, currentWs, title, cwd);
        $('#chat-title').textContent = title;
      } else if (msg.type === 'pty-data' && rawTerm) { rawTerm.write(msg.data); }
      else if (msg.type === 'session-timeout') {
        stopChatPoll();
        if (currentWs) { currentWs.close(); currentWs = null; }
        welcomeEl.classList.remove('hidden'); chatContainer.classList.add('hidden');
        activeSessions.delete(msg.sessionId); renderActiveSessions();
      }
      else if (msg.type === 'pty-exit' && rawTerm) { rawTerm.write('\r\n\x1b[33m[Session exited]\x1b[0m\r\n'); stopChatPoll(); }
    } catch (e) { if (rawTerm) rawTerm.write(event.data); }
  }

  function setupRawTerminal(ws) {
    if (rawTerm) rawTerm.dispose();
    const container = $('#raw-terminal');
    const t = new Terminal({
      cursorBlink: true, fontSize: 14,
      fontFamily: '"SF Mono","Fira Code","Cascadia Code",Menlo,monospace',
      theme: isDark() ? darkTheme() : lightTheme(), allowProposedApi: true,
    });
    const fa = new FitAddon.FitAddon(); t.loadAddon(fa); t.open(container);
    // fit will be called when the raw tab becomes active
    if ($('#panel-raw').classList.contains('active')) fa.fit();
    t.onData(d => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pty-input', data: d })); });
    t.onResize(({ cols, rows }) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows })); });
    new ResizeObserver(() => { if ($('#panel-raw').classList.contains('active')) fa?.fit(); }).observe(container);
    rawTerm = t; rawFitAddon = fa;
  }

  function darkTheme() { return { background:'#1a1a2e',foreground:'#e0e0e0',cursor:'#7c3aed',cursorAccent:'#1a1a2e',selectionBackground:'#7c3aed44',black:'#1a1a2e',red:'#ef4444',green:'#10b981',yellow:'#f59e0b',blue:'#3b82f6',magenta:'#7c3aed',cyan:'#06b6d4',white:'#e0e0e0',brightBlack:'#6b7280',brightRed:'#f87171',brightGreen:'#34d399',brightYellow:'#fbbf24',brightBlue:'#60a5fa',brightMagenta:'#a78bfa',brightCyan:'#22d3ee',brightWhite:'#f3f4f6' }; }
  function lightTheme() { return { background:'#ffffff',foreground:'#1a1a1a',cursor:'#7c3aed',cursorAccent:'#fff',selectionBackground:'#7c3aed33',black:'#1a1a1a',red:'#ef4444',green:'#059669',yellow:'#d97706',blue:'#2563eb',magenta:'#7c3aed',cyan:'#0891b2',white:'#f5f5f5',brightBlack:'#6b7280',brightRed:'#f87171',brightGreen:'#34d399',brightYellow:'#fbbf24',brightBlue:'#60a5fa',brightMagenta:'#a78bfa',brightCyan:'#22d3ee',brightWhite:'#1a1a1a' }; }

  // ========== Chat UI ==========
  function showChat() { welcomeEl.classList.add('hidden'); chatContainer.classList.remove('hidden'); switchMainTab('chat'); }

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
  chatInput.addEventListener('input', () => { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'; });

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentWs || currentWs.readyState !== WebSocket.OPEN) return;
    currentWs.send(JSON.stringify({ type: 'pty-input', data: text + '\n' }));
    removeChatTyping(); addChatBubble('user', text); addChatTyping();
    chatInput.value = ''; chatInput.style.height = 'auto';
  }

  function addChatBubble(role, content) {
    const t = document.createElement('div'); t.className = `chat-turn ${role}`;
    const r = document.createElement('div'); r.className = 'chat-role'; r.textContent = role === 'user' ? 'You' : 'Claude';
    const b = document.createElement('div'); b.className = 'chat-bubble';
    const p = document.createElement('div'); p.className = 'chat-part-text'; p.textContent = content;
    b.appendChild(p); t.appendChild(r); t.appendChild(b);
    chatMessages.appendChild(t); chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addChatTyping() { removeChatTyping(); const t = document.createElement('div'); t.className = 'chat-typing'; t.id = 'chat-typing-indicator'; t.innerHTML = '<span></span><span></span><span></span>'; chatMessages.appendChild(t); chatMessages.scrollTop = chatMessages.scrollHeight; }
  function removeChatTyping() { const e = $('#chat-typing-indicator'); if (e) e.remove(); }

  $('#chat-detach-btn').addEventListener('click', () => { if (currentWs) { currentWs.close(); currentWs = null; } stopChatPoll(); welcomeEl.classList.remove('hidden'); chatContainer.classList.add('hidden'); });
  $('#chat-kill-btn').addEventListener('click', () => { if (currentWs) { currentWs.send(JSON.stringify({ type: 'pty-input', data: '\x03' })); setTimeout(() => { if (currentWs) { currentWs.close(); currentWs = null; } }, 500); } stopChatPoll(); welcomeEl.classList.remove('hidden'); chatContainer.classList.add('hidden'); });

  // ========== Session Discovery + Poll ==========
  async function discoverSession() {
    if (!workingDir) return;
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      try {
        const data = await (await fetch(`/api/sessions/find-recent?dir=${encodeURIComponent(workingDir)}&afterMs=${chatSessionStartMs}`)).json();
        if (data.found) { chatClaudeSessionId = data.sessionId; chatProjectDir = data.dirName; startChatPoll(); return; }
      } catch (e) {}
    }
  }

  function startChatPoll() { stopChatPoll(); chatPollTimer = setInterval(pollChatMessages, 3000); pollChatMessages(); }
  function stopChatPoll() { if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; } }

  async function pollChatMessages() {
    if (!chatClaudeSessionId) return;
    try {
      const data = await (await fetch(`/api/sessions/${chatClaudeSessionId}/conversation?project=${encodeURIComponent(chatProjectDir || '')}`)).json();
      if (!data.turns) return;
      const newTurns = data.turns.slice(chatRenderedCount);
      if (newTurns.length > 0) {
        removeChatTyping();
        for (const turn of newTurns) renderChatTurn(turn);
        chatRenderedCount = data.turns.length;
        chatMessages.scrollTop = chatMessages.scrollHeight;
        const last = data.turns[data.turns.length - 1];
        if (last?.role === 'assistant' && last.parts?.some(p => p.type === 'tool_use')) addChatTyping();
        else if (last?.role === 'user') addChatTyping();
      }
    } catch (e) {}
  }

  function renderChatTurn(turn) {
    const div = document.createElement('div'); div.className = `chat-turn ${turn.role}`;
    const r = document.createElement('div'); r.className = 'chat-role'; r.textContent = turn.role === 'user' ? 'You' : turn.role === 'assistant' ? 'Claude' : 'System';
    const b = document.createElement('div'); b.className = 'chat-bubble';
    for (const part of turn.parts) {
      if (part.type === 'text' && part.text) { const e = document.createElement('div'); e.className = 'chat-part-text'; e.textContent = part.text; b.appendChild(e); }
      else if (part.type === 'thinking' && part.text) { const e = document.createElement('div'); e.className = 'chat-part-thinking'; e.textContent = part.text; e.addEventListener('click', () => e.classList.toggle('expanded')); b.appendChild(e); }
      else if (part.type === 'tool_use') { b.appendChild(createChatToolUse(part)); }
    }
    div.appendChild(r); div.appendChild(b); chatMessages.appendChild(div);
  }

  function createChatToolUse(part) {
    const w = document.createElement('div'); w.className = 'chat-part-tool';
    const h = document.createElement('div'); h.className = 'chat-tool-header';
    h.innerHTML = `<span>${getToolIcon(part.name)}</span><span class="chat-tool-name">${escapeHtml(part.name)}</span><span class="chat-tool-toggle">▼</span>`;
    const b = document.createElement('div'); b.className = 'chat-tool-body';
    let html = escapeHtml(truncate(JSON.stringify(part.input, null, 2), 1500));
    if (part.result) html += '\n---\n' + escapeHtml(truncate(part.result, 1000));
    b.innerHTML = html;
    h.addEventListener('click', () => { b.classList.toggle('expanded'); h.querySelector('.chat-tool-toggle').textContent = b.classList.contains('expanded') ? '▲' : '▼'; });
    w.appendChild(h); w.appendChild(b); return w;
  }

  // ========== Active Sessions ==========
  function addActiveSession(id, ws, title, cwd) { activeSessions.set(id, { ws, title, cwd }); renderActiveSessions(); }

  let activePollTimer = null;

  async function loadActiveClaudeSessions() {
    try {
      const data = await (await fetch('/api/sessions/active/list')).json();
      return data.sessions || [];
    } catch (e) { return []; }
  }

  async function renderActiveSessions() {
    const claudeSessions = await loadActiveClaudeSessions();
    // Merge: local sessions (started from this web UI) + system-detected sessions
    const allItems = [];

    // Local sessions from claude-web
    for (const [id, d] of activeSessions) {
      allItems.push({ sessionId: id, title: d.title || 'Untitled', cwd: d.cwd, source: 'local', status: 'active' });
    }

    // System-detected sessions (deduplicate by sessionId)
    const localIds = new Set(allItems.map(s => s.sessionId));
    for (const s of claudeSessions) {
      if (!localIds.has(s.sessionId)) {
        allItems.push({ sessionId: s.sessionId, title: s.title || 'Untitled', cwd: s.cwd, source: 'system', status: s.status, pid: s.pid });
      } else {
        // Update status for local sessions that also appear in system
        const item = allItems.find(i => i.sessionId === s.sessionId);
        if (item) item.status = s.status;
      }
    }

    if (!allItems.length) { activeSessionsList.innerHTML = '<div class="empty-state">No active sessions.<br>Click + to start.</div>'; return; }

    const groups = new Map();
    for (const s of allItems) { const p = shortProject(s.cwd || ''); if (!groups.has(p)) groups.set(p, []); groups.get(p).push(s); }

    activeSessionsList.innerHTML = '';
    for (const [project, sessions] of groups) {
      const g = document.createElement('div'); g.className = 'project-group';
      const h = document.createElement('div'); h.className = 'project-header';
      h.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(project)} <span style="margin-left:auto;font-weight:400">(${sessions.length})</span>`;
      const l = document.createElement('div'); l.className = 'project-sessions';
      h.addEventListener('click', () => { h.classList.toggle('collapsed'); l.classList.toggle('collapsed'); });
      for (const s of sessions) {
        const i = document.createElement('div'); i.className = 'session-item' + (s.sessionId === currentSessionId ? ' active' : '');
        const statusLabel = s.status === 'busy' ? '● Busy' : s.status === 'idle' ? '○ Idle' : s.source === 'local' ? '● Active' : '○ Active';
        const statusClass = s.status === 'busy' ? 'status-busy' : 'status-idle';
        i.innerHTML = `<div class="session-title">${escapeHtml(s.title)}</div><div class="session-meta"><span class="${statusClass}">${statusLabel}</span>${s.pid ? ` · PID ${s.pid}` : ''}</div>`;
        i.addEventListener('click', () => {
          if (s.source === 'local') {
            workingDir = s.cwd; switchMainTab('chat');
          } else {
            // System-detected session: resume directly
            resumeSession(s.sessionId, s.cwd || '', s.title);
          }
        });
        l.appendChild(i);
      }
      g.appendChild(h); g.appendChild(l); activeSessionsList.appendChild(g);
    }
  }

  // Poll active sessions every 5s
  function startActivePoll() { stopActivePoll(); renderActiveSessions(); activePollTimer = setInterval(renderActiveSessions, 5000); }
  function stopActivePoll() { if (activePollTimer) { clearInterval(activePollTimer); activePollTimer = null; } }
  startActivePoll();

  // ========== History ==========
  async function loadProjects() {
    try {
      const data = await (await fetch('/api/sessions/projects')).json();
      if (!data.projects.length) { projectsList.innerHTML = '<div class="empty-state">No history.</div>'; return; }
      projectsList.innerHTML = '';
      for (const project of data.projects) {
        const g = document.createElement('div'); g.className = 'project-group';
        const h = document.createElement('div'); h.className = 'project-header';
        h.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(shortProject(project.projectPath))} <span style="margin-left:auto;font-weight:400">(${project.sessionCount})</span>`;
        const s = document.createElement('div'); s.className = 'project-sessions';
        h.addEventListener('click', () => { h.classList.toggle('collapsed'); s.classList.toggle('collapsed'); });
        for (const session of project.sessions) {
          const title = session.title || 'Untitled';
          const time = session.lastModified ? new Date(session.lastModified).toLocaleString() : '';
          const i = document.createElement('div'); i.className = 'session-item';
          i.innerHTML = `<div class="session-title">${escapeHtml(title)}</div><div class="session-meta">${time}</div>`;
          i.addEventListener('click', () => openConversation(session.sessionId, project.dirName, project.projectPath, title));
          s.appendChild(i);
        }
        g.appendChild(h); g.appendChild(s); projectsList.appendChild(g);
      }
    } catch (err) { projectsList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  // ========== Replay ==========
  async function openConversation(sessionId, projectDir, projectPath, title) {
    currentReplaySessionId = sessionId; currentReplayProjectDir = projectDir; currentReplayCwd = projectPath; currentReplayTitle = title;
    const m = $('#replay-messages'); m.innerHTML = '<div class="loading">Loading...</div>';
    $('#replay-title').textContent = title || 'Untitled'; replayContainer.classList.remove('hidden');
    try {
      const data = await (await fetch(`/api/sessions/${sessionId}/conversation?project=${encodeURIComponent(projectDir || '')}`)).json();
      m.innerHTML = ''; if (!data.turns.length) { m.innerHTML = '<div class="empty-state">No messages.</div>'; return; }
      for (const turn of data.turns) renderTurn(turn, m);
      m.scrollTop = m.scrollHeight;
    } catch (err) { m.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  function renderTurn(turn, container) {
    const d = document.createElement('div'); d.className = `turn turn-${turn.role}`;
    const r = document.createElement('div'); r.className = 'turn-role'; r.textContent = turn.role === 'user' ? 'You' : turn.role === 'assistant' ? 'Claude' : 'System';
    const t = document.createElement('div'); t.className = 'turn-time'; t.textContent = turn.timestamp ? new Date(turn.timestamp).toLocaleString() : '';
    const b = document.createElement('div'); b.className = 'turn-bubble';
    for (const part of turn.parts) {
      if (part.type === 'text' && part.text) { const e = document.createElement('div'); e.className = 'part-text'; e.textContent = part.text; b.appendChild(e); }
      else if (part.type === 'thinking' && part.text) { const e = document.createElement('div'); e.className = 'part-thinking'; e.textContent = part.text; e.addEventListener('click', () => e.classList.toggle('expanded')); b.appendChild(e); }
      else if (part.type === 'tool_use') { b.appendChild(createToolUseElement(part)); }
    }
    if (turn.role === 'user') { d.appendChild(r); d.appendChild(t); d.appendChild(b); }
    else if (turn.role === 'assistant') { d.appendChild(r); d.appendChild(b); d.appendChild(t); }
    else { d.appendChild(b); }
    container.appendChild(d);
  }

  function createToolUseElement(part) {
    const w = document.createElement('div'); w.className = 'part-tool-use';
    const h = document.createElement('div'); h.className = 'tool-use-header';
    h.innerHTML = `<span class="tool-use-icon">${getToolIcon(part.name)}</span><span class="tool-use-name">${escapeHtml(part.name)}</span><span class="tool-use-toggle">▼</span>`;
    const b = document.createElement('div'); b.className = 'tool-use-body';
    let html = escapeHtml(truncate(JSON.stringify(part.input, null, 2), 2000));
    if (part.result) html += `<div class="tool-use-result">${escapeHtml(truncate(part.result, 1500))}</div>`;
    b.innerHTML = html;
    h.addEventListener('click', () => { b.classList.toggle('expanded'); h.querySelector('.tool-use-toggle').textContent = b.classList.contains('expanded') ? '▲' : '▼'; });
    w.appendChild(h); w.appendChild(b); return w;
  }

  $('#replay-close-btn').addEventListener('click', () => replayContainer.classList.add('hidden'));
  $('#resume-btn').addEventListener('click', () => { if (currentReplaySessionId) resumeSession(currentReplaySessionId, currentReplayCwd || '', currentReplayTitle); });

  // ========== Git ==========
  async function loadGit() {
    if (!workingDir) { gitContent.innerHTML = '<div class="empty-state">Start a session first.</div>'; return; }
    gitDir = workingDir;
    gitContent.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const [status, log] = await Promise.all([
        (await fetch(`/api/git/status?dir=${encodeURIComponent(gitDir)}`)).json(),
        (await fetch(`/api/git/log?dir=${encodeURIComponent(gitDir)}`)).json(),
      ]);
      if (status.error) { gitContent.innerHTML = '<div class="empty-state">Not a Git repo.</div>'; return; }
      renderGitOverview(status, log);
    } catch (err) { gitContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  function renderGitOverview(status, log) {
    let html = '<div class="git-branch-bar">';
    html += `<span class="branch-name">${escapeHtml(status.branch.name || '?')}</span>`;
    if (status.branch.ahead) html += `<span class="ahead-behind ahead">↑${status.branch.ahead}</span>`;
    if (status.branch.behind) html += `<span class="ahead-behind behind">↓${status.branch.behind}</span>`;
    html += '</div>';

    if (status.staged.length) {
      html += '<div class="git-section"><div class="git-section-title">Staged Changes</div>';
      for (const f of status.staged) html += `<div class="git-file-item" data-file="${escapeAttr(f.path)}" data-staged="1"><span class="git-file-status ${f.status}">${f.status}</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`;
      html += '</div>';
    }
    if (status.unstaged.length) {
      html += '<div class="git-section"><div class="git-section-title">Unstaged Changes</div>';
      for (const f of status.unstaged) html += `<div class="git-file-item" data-file="${escapeAttr(f.path)}" data-staged="0"><span class="git-file-status ${f.status}">${f.status}</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`;
      html += '</div>';
    }
    if (status.untracked.length) {
      html += '<div class="git-section"><div class="git-section-title">Untracked</div>';
      for (const f of status.untracked) html += `<div class="git-file-item"><span class="git-file-status ?">?</span><span class="git-file-name">${escapeHtml(f.path)}</span></div>`;
      html += '</div>';
    }
    if (log.commits?.length) {
      html += '<div class="git-section"><div class="git-section-title">Commits</div>';
      for (const c of log.commits) html += `<div class="git-commit" data-hash="${c.hash}"><div class="git-commit-header"><span class="git-commit-hash">${c.shortHash}</span><span class="git-commit-msg">${escapeHtml(c.message)}</span></div><div class="git-commit-meta">${escapeHtml(c.author)} · ${timeAgo(c.date)}</div></div>`;
      html += '</div>';
    }
    gitContent.innerHTML = html;

    // Bind click: file -> show diff
    gitContent.querySelectorAll('.git-file-item[data-file]').forEach(el => {
      el.addEventListener('click', () => showGitDiff(el.dataset.file, el.dataset.staged === '1'));
    });
    // Bind click: commit -> show diff
    gitContent.querySelectorAll('.git-commit[data-hash]').forEach(el => {
      el.addEventListener('click', () => showGitCommitDiff(el.dataset.hash));
    });
  }

  async function showGitDiff(file, staged) {
    gitContent.innerHTML = '<div class="loading">Loading diff...</div>';
    try {
      const data = await (await fetch(`/api/git/diff?dir=${encodeURIComponent(gitDir)}&file=${encodeURIComponent(file)}&staged=${staged ? 1 : 0}`)).json();
      renderDiffView(file, data, staged ? 'Staged' : 'Unstaged');
    } catch (err) { gitContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  async function showGitCommitDiff(hash) {
    gitContent.innerHTML = '<div class="loading">Loading diff...</div>';
    try {
      const data = await (await fetch(`/api/git/diff?dir=${encodeURIComponent(gitDir)}&commit=${encodeURIComponent(hash)}`)).json();
      renderDiffView(`Commit ${hash.slice(0, 8)}`, data, 'Commit');
    } catch (err) { gitContent.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
  }

  function renderDiffView(title, data, backLabel) {
    let html = `<button class="diff-back-btn" id="git-back-btn">← Back to ${backLabel}</button>`;
    html += '<div class="diff-viewer">';
    if (!data.files?.length) { html += '<div class="empty-state">No changes.</div>'; }
    for (const file of data.files) {
      html += `<div class="diff-file-header"><span class="diff-file-path">${escapeHtml(file.path)}</span><span class="diff-file-stats"><span class="additions">+${file.additions}</span><span class="deletions">-${file.deletions}</span></span></div>`;
      html += '<div class="diff-hunks">';
      for (const hunk of file.hunks) {
        html += `<div class="diff-hunk-header">${escapeHtml(hunk.header)}</div>`;
        let lineNum = 0;
        for (const line of hunk.lines) {
          const cls = line.type === 'add' ? 'add' : line.type === 'del' ? 'del' : 'ctx';
          const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
          if (line.type !== 'add') lineNum++;
          html += `<div class="diff-line ${cls}"><span class="diff-line-num">${lineNum}</span><span class="diff-line-content">${prefix}${escapeHtml(line.content)}</span></div>`;
          if (line.type === 'add') lineNum++;
        }
      }
      html += '</div>';
    }
    html += '</div>';
    gitContent.innerHTML = html;
    $('#git-back-btn').addEventListener('click', loadGit);
  }

  // ========== Files ==========
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
      const hp = (window._homeDir || '').split('/').filter(Boolean);
      let bp = '';
      for (let i = 0; i < parts.length; i++) {
        bp += '/' + parts[i]; const isLast = i === parts.length - 1;
        const label = (i < hp.length && parts[i] === hp[i]) ? (i === hp.length - 1 ? '~' : null) : parts[i];
        if (label === null) continue;
        if (i > 0) html += '<span class="sep">/</span>';
        html += `<span class="${isLast ? 'current' : ''}" data-dir="${escapeAttr(bp)}">${escapeHtml(label)}</span>`;
      }
      html += '</div></div><div class="file-list">';
      if (data.parent && data.parent !== filesDir) html += `<div class="file-item" data-dir="${escapeAttr(data.parent)}"><span class="file-icon">📁</span><span class="file-name">..</span></div>`;
      for (const item of data.items) {
        const icon = item.type === 'dir' ? '📁' : fileIcon(item.name);
        const sz = item.type === 'file' ? formatSize(item.size) : '';
        const mod = item.modified ? new Date(item.modified).toLocaleDateString() : '';
        const attr = item.type === 'dir' ? `data-dir="${escapeAttr(item.path)}"` : `data-file="${escapeAttr(item.path)}"`;
        html += `<div class="file-item" ${attr}><span class="file-icon">${icon}</span><span class="file-name">${escapeHtml(item.name)}</span><span class="file-size">${sz}</span><span class="file-modified">${mod}</span></div>`;
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
      const d = document.createElement('div'); d.className = 'file-viewer';
      if (data.truncated) d.innerHTML = `<div class="file-viewer-header"><span class="file-viewer-path">${escapeHtml(data.path)}</span><button class="file-viewer-close">Close</button></div><div>File too large (${formatSize(data.size)})</div>`;
      else d.innerHTML = `<div class="file-viewer-header"><span class="file-viewer-path">${escapeHtml(data.path)}</span><button class="file-viewer-close">Close</button></div><div>${escapeHtml(data.content)}</div>`;
      d.querySelector('.file-viewer-close').addEventListener('click', () => d.remove());
      filesContent.appendChild(d); d.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {}
  }

  // ========== Bash Terminal ==========
  let bashInitialized = false;

  function initBashTerminal() {
    if (bashInitialized) return;
    if (!workingDir) return;
    bashInitialized = true;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    bashWs = new WebSocket(`${protocol}//${location.host}?action=bash&cwd=${encodeURIComponent(workingDir)}`);

    bashWs.onopen = () => {
      if (bashTerm) bashTerm.dispose();
      bashTerm = new Terminal({
        cursorBlink: true, fontSize: 14,
        fontFamily: '"SF Mono","Fira Code","Cascadia Code",Menlo,monospace',
        theme: isDark() ? darkTheme() : lightTheme(), allowProposedApi: true,
      });
      bashFitAddon = new FitAddon.FitAddon();
      bashTerm.loadAddon(bashFitAddon);
      bashTerm.open($('#bash-terminal'));
      bashFitAddon.fit();

      bashTerm.onData(d => { if (bashWs.readyState === WebSocket.OPEN) bashWs.send(JSON.stringify({ type: 'pty-input', data: d })); });
      bashTerm.onResize(({ cols, rows }) => { if (bashWs.readyState === WebSocket.OPEN) bashWs.send(JSON.stringify({ type: 'resize', cols, rows })); });
      new ResizeObserver(() => bashFitAddon?.fit()).observe($('#bash-terminal'));
      bashTerm.focus();
    };

    bashWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pty-data' && bashTerm) bashTerm.write(msg.data);
        else if (msg.type === 'pty-exit' && bashTerm) bashTerm.write('\r\n\x1b[33m[Process exited]\x1b[0m\r\n');
      } catch (e) { if (bashTerm) bashTerm.write(event.data); }
    };

    bashWs.onclose = () => {
      if (bashTerm) bashTerm.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n');
      bashInitialized = false;
    };
  }

  // Watch for bash tab activation
  const bashTabObserver = new MutationObserver(() => {
    if ($('#panel-bash').classList.contains('active') && !bashInitialized) initBashTerminal();
    if ($('#panel-bash').classList.contains('active') && bashTerm) setTimeout(() => bashFitAddon?.fit(), 50);
  });
  bashTabObserver.observe($('#panel-bash'), { attributes: true, attributeFilter: ['class'] });

  // ========== Helpers ==========
  function shortProject(cwd) { if (!cwd) return '~'; return cwd.replace(/\/+$/, '').split('/').filter(Boolean).slice(-2).join('/'); }
  function getToolIcon(n) { return {Bash:'⌘',Read:'📄',Write:'✏️',Edit:'✏️',Grep:'🔍',Agent:'🤖',WebSearch:'🌐',WebFetch:'📡'}[n]||'🔧'; }
  function fileIcon(n) { const e=n.split('.').pop().toLowerCase(); return {js:'🟨',ts:'🔷',json:'📋',md:'📝',css:'🎨',html:'🌐',py:'🐍',go:'🐹',rs:'🦀',sh:'⚙️',yaml:'⚙️',yml:'⚙️',toml:'⚙️',sql:'🗃️'}[e]||'📄'; }
  function formatSize(b) { if(!b)return''; if(b<1024)return b+'B'; if(b<1048576)return(b/1024).toFixed(1)+'K'; return(b/1048576).toFixed(1)+'M'; }
  function timeAgo(d) { const s=(Date.now()-new Date(d))/1000; if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; if(s<2592000)return Math.floor(s/86400)+'d ago'; return new Date(d).toLocaleDateString(); }
  function truncate(s,m) { return(!s)?'':(s.length>m?s.slice(0,m)+'...':s); }
  function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function escapeAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

  document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); openNewSessionDialog(); } });
  fetch('/api/sessions/directories').then(r=>r.json()).then(d=>{window._homeDir=d.directories.find(x=>x.startsWith('/Users/'));}).catch(()=>{});
})();
