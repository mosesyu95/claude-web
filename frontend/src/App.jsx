import { useState, useCallback, useEffect, useRef } from 'react'
import { useTheme } from './hooks/useTheme'
import { useWebSocket } from './hooks/useWebSocket'
import { sessions as sessionsApi } from './api'
import Sidebar from './components/Sidebar/Sidebar'
import ChatPanel from './components/Chat/ChatPanel'
import RawTerminal from './components/Terminal/RawTerminal'
import BashTerminal from './components/Terminal/BashTerminal'
import GitPanel from './components/Git/GitPanel'
import FilesPanel from './components/Files/FilesPanel'
import NewSessionDialog from './components/Modals/NewSessionDialog'
import ReplayOverlay from './components/Modals/ReplayOverlay'
import { MessageSquare, Terminal, GitBranch, FolderOpen, SquareTerminal } from 'lucide-react'

const MAIN_TABS = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'raw', label: 'Raw', icon: Terminal },
  { key: 'git', label: 'Git', icon: GitBranch },
  { key: 'files', label: 'Files', icon: FolderOpen },
  { key: 'bash', label: 'Bash', icon: SquareTerminal },
]

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const wsHook = useWebSocket()

  // Main state
  const [activeMainTab, setActiveMainTab] = useState('chat')
  const [showNewSession, setShowNewSession] = useState(false)
  const [activeSessions, setActiveSessions] = useState(new Map())

  // Chat state
  const [chatSession, setChatSession] = useState(null) // { sessionId, cwd, title, ws }
  const [chatMessages, setChatMessages] = useState([])
  const [chatStatus, setChatStatus] = useState('idle') // idle | busy
  const chatPollRef = useRef(null)
  const chatRenderedRef = useRef(0)

  // Replay state
  const [replay, setReplay] = useState(null) // { sessionId, projectDir, cwd, title, turns }

  // Terminal refs
  const rawTermRef = useRef(null)

  // Session management
  const addLocalSession = useCallback((id, data) => {
    setActiveSessions(prev => {
      const next = new Map(prev)
      next.set(id, { ...data, local: true })
      return next
    })
  }, [])

  const removeLocalSession = useCallback((id) => {
    setActiveSessions(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Start new PTY session
  const startNewSession = useCallback((cwd) => {
    setChatMessages([])
    chatRenderedRef.current = 0
    setChatStatus('idle')

    const ws = wsHook.connect(
      { action: 'new', cwd },
      {
        onMessage: (msg) => {
          if (msg.type === 'session-started') {
            const info = { sessionId: msg.sessionId, cwd, title: 'New Session' }
            setChatSession(info)
            addLocalSession(msg.sessionId, info)
            discoverSession(cwd, msg.sessionId)
          } else if (msg.type === 'session-timeout') {
            setChatStatus('idle')
          } else if (msg.type === 'pty-exit') {
            setChatStatus('idle')
            if (chatPollRef.current) clearInterval(chatPollRef.current)
          }
        },
        onOpen: () => {
          rawTermRef.current?.connectWs(ws)
        },
      }
    )
    setShowNewSession(false)
    setActiveMainTab('chat')
  }, [wsHook, addLocalSession])

  // Resume existing session
  const resumeSession = useCallback((sessionId, cwd, title) => {
    setChatMessages([])
    chatRenderedRef.current = 0
    setChatStatus('idle')

    const ws = wsHook.connect(
      { action: 'resume', sessionId, cwd },
      {
        onMessage: (msg) => {
          if (msg.type === 'session-started') {
            setChatSession({ sessionId, cwd, title: title || 'Resumed Session' })
            addLocalSession(sessionId, { sessionId, cwd, title })
            startChatPoll(sessionId)
          } else if (msg.type === 'session-timeout') {
            setChatStatus('idle')
          } else if (msg.type === 'pty-exit') {
            setChatStatus('idle')
            if (chatPollRef.current) clearInterval(chatPollRef.current)
          }
        },
        onOpen: () => {
          rawTermRef.current?.connectWs(ws)
        },
      }
    )
    setReplay(null)
    setActiveMainTab('chat')
  }, [wsHook, addLocalSession])

  // Discover session file
  const discoverSession = useCallback((cwd, sessionId) => {
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      if (attempts > 10) { clearInterval(timer); return }
      try {
        const data = await sessionsApi.findRecent(cwd, Date.now() - 30000)
        if (data?.sessionId) {
          clearInterval(timer)
          setChatSession(prev => prev ? { ...prev, sessionId: data.sessionId } : prev)
          startChatPoll(data.sessionId)
        }
      } catch {}
    }, 2000)
  }, [])

  // Poll chat messages
  const startChatPoll = useCallback((sessionId) => {
    if (chatPollRef.current) clearInterval(chatPollRef.current)
    chatPollRef.current = setInterval(async () => {
      try {
        const data = await sessionsApi.conversation(sessionId)
        if (data?.turns && data.turns.length > chatRenderedRef.current) {
          setChatMessages(data.turns)
          chatRenderedRef.current = data.turns.length
        }
      } catch {}
    }, 3000)
  }, [])

  // Send chat message
  const sendChatMessage = useCallback((text) => {
    if (!text.trim()) return
    wsHook.send({ type: 'pty-input', data: text + '\n' })
    setChatStatus('busy')
    setChatMessages(prev => [...prev, { role: 'user', parts: [{ type: 'text', text }] }])
  }, [wsHook])

  // Detach session
  const detachSession = useCallback(() => {
    wsHook.close()
    setChatSession(null)
    setChatMessages([])
    chatRenderedRef.current = 0
    if (chatPollRef.current) clearInterval(chatPollRef.current)
    rawTermRef.current?.disconnect()
  }, [wsHook])

  // Kill session
  const killSession = useCallback(() => {
    wsHook.send({ type: 'pty-input', data: '\x03' })
    setTimeout(() => wsHook.send({ type: 'pty-input', data: '\x03' }), 1000)
    setTimeout(() => {
      wsHook.close()
      setChatSession(null)
      setChatMessages([])
      chatRenderedRef.current = 0
      if (chatPollRef.current) clearInterval(chatPollRef.current)
      rawTermRef.current?.disconnect()
    }, 2000)
  }, [wsHook])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        setShowNewSession(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Cleanup poll on unmount
  useEffect(() => () => {
    if (chatPollRef.current) clearInterval(chatPollRef.current)
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        theme={theme}
        toggleTheme={toggleTheme}
        onNewSession={() => setShowNewSession(true)}
        activeSessions={activeSessions}
        onResumeSession={resumeSession}
        currentSessionId={chatSession?.sessionId}
        onOpenConversation={(sessionId, projectDir, cwd, title) => {
          sessionsApi.conversation(sessionId).then(data => {
            setReplay({ sessionId, projectDir, cwd, title, turns: data?.turns || [] })
          })
        }}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Main tabs */}
        <div className="flex items-center border-b border-[var(--cr-gray-8)] bg-[var(--cr-gray-10)] dark:bg-[var(--cr-gray-11)] px-1 shrink-0">
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeMainTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveMainTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[var(--cr-brand-6)] text-[var(--cr-brand-5)]'
                    : 'border-transparent text-[var(--cr-gray-5)] hover:text-[var(--cr-gray-3)]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab panels */}
        <div className="flex-1 overflow-hidden relative">
          <div className={`h-full ${activeMainTab === 'chat' ? '' : 'hidden'}`}>
            <ChatPanel
              session={chatSession}
              messages={chatMessages}
              status={chatStatus}
              onSend={sendChatMessage}
              onDetach={detachSession}
              onKill={killSession}
              onStartNew={() => setShowNewSession(true)}
            />
          </div>
          <div className={`h-full ${activeMainTab === 'raw' ? '' : 'hidden'}`}>
            <RawTerminal ref={rawTermRef} theme={theme} />
          </div>
          <div className={`h-full ${activeMainTab === 'git' ? '' : 'hidden'}`}>
            <GitPanel cwd={chatSession?.cwd} />
          </div>
          <div className={`h-full ${activeMainTab === 'files' ? '' : 'hidden'}`}>
            <FilesPanel cwd={chatSession?.cwd} />
          </div>
          <div className={`h-full ${activeMainTab === 'bash' ? '' : 'hidden'}`}>
            <BashTerminal cwd={chatSession?.cwd} theme={theme} active={activeMainTab === 'bash'} />
          </div>
        </div>
      </main>

      {/* Modals */}
      {showNewSession && (
        <NewSessionDialog
          onStart={startNewSession}
          onClose={() => setShowNewSession(false)}
        />
      )}
      {replay && (
        <ReplayOverlay
          replay={replay}
          onResume={() => resumeSession(replay.sessionId, replay.cwd, replay.title)}
          onClose={() => setReplay(null)}
        />
      )}
    </div>
  )
}
