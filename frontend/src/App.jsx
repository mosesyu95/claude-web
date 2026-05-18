import { useRef, useState, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { useWebSocket } from './hooks/useWebSocket'
import { useChat } from './hooks/useChat'
import { useSession } from './hooks/useSession'
import { useKeyboard } from './hooks/useKeyboard'
import { useReplay } from './hooks/useReplay'
import { ToastProvider } from './components/common/Toast'
import ConnectionBar from './components/common/ConnectionBar'
import Sidebar from './components/Sidebar/Sidebar'
import ChatPanel from './components/Chat/ChatPanel'
import RawTerminal from './components/Terminal/RawTerminal'
import BashTerminal from './components/Terminal/BashTerminal'
import GitPanel from './components/Git/GitPanel'
import FilesPanel from './components/Files/FilesPanel'
import NewSessionDialog from './components/Modals/NewSessionDialog'
import ReplayOverlay from './components/Modals/ReplayOverlay'
import { sessions as sessionsApi } from './api'
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
  const rawTermRef = useRef(null)
  const chat = useChat()
  const session = useSession(wsHook, chat, rawTermRef)
  const kb = useKeyboard()
  const replay = useReplay(session.resume)
  const [readOnlySession, setReadOnlySession] = useState(null)

  const handleOpenReadOnly = useCallback(async (sessionId, cwd, dirName, title) => {
    try {
      const data = await sessionsApi.conversation(sessionId)
      setReadOnlySession({
        sessionId,
        cwd,
        title: title || 'Session',
        messages: data?.turns || [],
      })
      kb.setActiveTab('chat')
    } catch {
      // Failed to load conversation
    }
  }, [kb])

  const handleResumeFromReadOnly = useCallback(() => {
    if (!readOnlySession) return
    const { sessionId, cwd, title } = readOnlySession
    setReadOnlySession(null)
    session.resume(sessionId, cwd, title)
    kb.setActiveTab('chat')
  }, [readOnlySession, session.resume, kb])

  const handleStartNew = (cwd) => {
    setReadOnlySession(null)
    session.startNew(cwd)
    kb.setShowNewSession(false)
    kb.setActiveTab('chat')
  }

  const handleResume = (sessionId, cwd, title) => {
    setReadOnlySession(null)
    session.resume(sessionId, cwd, title)
    replay.closeReplay()
    kb.setActiveTab('chat')
  }

  return (
    <ToastProvider>
    <div className="flex h-full overflow-hidden relative">
      <ConnectionBar wsState={wsHook.wsState} />

      <Sidebar
        theme={theme}
        effective={effective}
        cycleTheme={cycleTheme}
        collapsed={kb.sidebarCollapsed}
        onToggleCollapse={kb.toggleSidebar}
        onNewSession={() => kb.setShowNewSession(true)}
        activeSessions={session.activeSessions}
        onResumeSession={handleResume}
        onOpenReadOnly={handleOpenReadOnly}
        currentSessionId={session.session?.sessionId}
        onOpenConversation={replay.openReplay}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center px-3 shrink-0"
          style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-secondary)' }}>
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon
            const active = kb.activeTab === tab.key
            const needsSession = tab.key === 'raw' || tab.key === 'git' || tab.key === 'files'
            const disabled = needsSession && !session.session
            return (
              <button
                key={tab.key}
                onClick={() => { if (!disabled) kb.setActiveTab(tab.key) }}
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors duration-200"
                style={{
                  color: disabled ? 'var(--text-quaternary)' : active ? 'var(--primary)' : 'var(--text-tertiary)',
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? 'default' : 'pointer',
                }}
              >
                <Icon size={14} strokeWidth={active ? 2 : 1.5} />
                {tab.label}
                {active && !disabled && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-hidden relative" style={{ background: 'var(--bg-base)' }}>
          <div className="absolute inset-0" style={{ visibility: kb.activeTab === 'chat' ? 'visible' : 'hidden', zIndex: kb.activeTab === 'chat' ? 1 : 0 }}>
            <ChatPanel
              session={readOnlySession || session.session}
              messages={readOnlySession ? readOnlySession.messages : chat.messages}
              status={readOnlySession ? 'idle' : chat.status}
              onSend={session.send}
              onDetach={session.detach}
              onKill={session.kill}
              onStartNew={() => kb.setShowNewSession(true)}
              readOnly={!!readOnlySession}
              onResumeSession={handleResumeFromReadOnly}
            />
          </div>
          <div className="absolute inset-0" style={{ visibility: kb.activeTab === 'raw' ? 'visible' : 'hidden', zIndex: kb.activeTab === 'raw' ? 1 : 0 }}>
            <RawTerminal ref={rawTermRef} theme={effective} />
          </div>
          <div className="absolute inset-0" style={{ visibility: kb.activeTab === 'git' ? 'visible' : 'hidden', zIndex: kb.activeTab === 'git' ? 1 : 0 }}>
            <GitPanel cwd={session.session?.cwd} />
          </div>
          <div className="absolute inset-0" style={{ visibility: kb.activeTab === 'files' ? 'visible' : 'hidden', zIndex: kb.activeTab === 'files' ? 1 : 0 }}>
            <FilesPanel cwd={session.session?.cwd} />
          </div>
          <div className="absolute inset-0" style={{ visibility: kb.activeTab === 'bash' ? 'visible' : 'hidden', zIndex: kb.activeTab === 'bash' ? 1 : 0 }}>
            <BashTerminal cwd={session.session?.cwd} theme={effective} active={kb.activeTab === 'bash'} />
          </div>
        </div>
      </main>

      {kb.showNewSession && (
        <NewSessionDialog onStart={handleStartNew} onClose={() => kb.setShowNewSession(false)} onOpenReadOnly={handleOpenReadOnly} />
      )}
      {replay.replay && (
        <ReplayOverlay
          replay={replay.replay}
          onResume={replay.resumeFromReplay}
          onClose={replay.closeReplay}
        />
      )}
    </div>
    </ToastProvider>
  )
}
