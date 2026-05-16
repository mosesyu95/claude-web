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
  const { theme, effective, cycleTheme } = useTheme()
  const wsHook = useWebSocket()

  const [activeMainTab, setActiveMainTab] = useState('chat')
  const [showNewSession, setShowNewSession] = useState(false)
  const [activeSessions, setActiveSessions] = useState(new Map())

  const [chatSession, setChatSession] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatStatus, setChatStatus] = useState('idle')
  const chatPollRef = useRef(null)
  const chatRenderedRef = useRef(0)

  const [replay, setReplay] = useState(null)
  const rawTermRef = useRef(null)

  const addLocalSession = useCallback((id, data) => {
    setActiveSessions(prev => {
      const next = new Map(prev)
      next.set(id, { ...data, local: true })
      return next
    })
  }, [])

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

  const sendChatMessage = useCallback((text) => {
    if (!text.trim()) return
    wsHook.send({ type: 'pty-input', data: text + '\n' })
    setChatStatus('busy')
    setChatMessages(prev => [...prev, { role: 'user', parts: [{ type: 'text', text }] }])
  }, [wsHook])

  const detachSession = useCallback(() => {
    wsHook.close()
    setChatSession(null)
    setChatMessages([])
    chatRenderedRef.current = 0
    if (chatPollRef.current) clearInterval(chatPollRef.current)
    rawTermRef.current?.disconnect()
  }, [wsHook])

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

  useEffect(() => () => {
    if (chatPollRef.current) clearInterval(chatPollRef.current)
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        theme={theme}
        effective={effective}
        cycleTheme={cycleTheme}
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
        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-3 py-1.5 shrink-0"
          style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}>
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeMainTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveMainTab(tab.key)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200"
                style={{
                  color: active ? 'var(--amber-5)' : 'var(--text-tertiary)',
                  background: active ? 'var(--glow-amber)' : 'transparent',
                }}
              >
                <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--amber-6), var(--amber-4))' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab panels — use absolute+visibility so xterm containers always have dimensions */}
        <div className="flex-1 overflow-hidden relative" style={{ background: 'var(--obsidian-0)' }}>
          <div className="absolute inset-0" style={{ visibility: activeMainTab === 'chat' ? 'visible' : 'hidden', zIndex: activeMainTab === 'chat' ? 1 : 0 }}>
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
          <div className="absolute inset-0" style={{ visibility: activeMainTab === 'raw' ? 'visible' : 'hidden', zIndex: activeMainTab === 'raw' ? 1 : 0 }}>
            <RawTerminal ref={rawTermRef} theme={effective} />
          </div>
          <div className="absolute inset-0" style={{ visibility: activeMainTab === 'git' ? 'visible' : 'hidden', zIndex: activeMainTab === 'git' ? 1 : 0 }}>
            <GitPanel cwd={chatSession?.cwd} />
          </div>
          <div className="absolute inset-0" style={{ visibility: activeMainTab === 'files' ? 'visible' : 'hidden', zIndex: activeMainTab === 'files' ? 1 : 0 }}>
            <FilesPanel cwd={chatSession?.cwd} />
          </div>
          <div className="absolute inset-0" style={{ visibility: activeMainTab === 'bash' ? 'visible' : 'hidden', zIndex: activeMainTab === 'bash' ? 1 : 0 }}>
            <BashTerminal cwd={chatSession?.cwd} theme={effective} active={activeMainTab === 'bash'} />
          </div>
        </div>
      </main>

      {showNewSession && (
        <NewSessionDialog onStart={startNewSession} onClose={() => setShowNewSession(false)} />
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
