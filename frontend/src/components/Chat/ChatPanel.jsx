import { useRef, useEffect, useMemo } from 'react'
import { MessageSquare, FolderOpen, Hash, Plus, Clock, Keyboard, RotateCcw } from 'lucide-react'
import { shortProject } from '../../helpers'
import ChatBubble from './ChatBubble'
import ChatInput from './ChatInput'
import TypingIndicator from './TypingIndicator'
import { ChatSkeleton } from '../common/Skeleton'

export default function ChatPanel({ session, messages, status, onSend, onDetach, onKill, onStartNew, readOnly, onResumeSession }) {
  const messagesRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, status])

  const messageCount = useMemo(() => {
    return messages.filter(m => m.role === 'user').length
  }, [messages])

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-[480px] px-6" style={{ animation: 'fadeIn 0.5s ease' }}>
          {/* Brand */}
          <div className="text-center mb-10">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: 'var(--primary-bg)',
                border: '1px solid var(--primary-border)',
                boxShadow: '0 0 24px rgba(204, 120, 92, 0.08)',
              }}
            >
              <MessageSquare size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <h1
              className="text-[22px] font-bold tracking-tight mb-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              Claude Web Console
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              AI-powered coding assistant in your browser
            </p>
          </div>

          {/* Quick actions */}
          <div className="space-y-2 mb-8">
            <button
              onClick={onStartNew}
              className="welcome-shortcut w-full"
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary)', color: 'var(--text-inverse)' }}
              >
                <Plus size={16} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>New Session</div>
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Start a fresh coding session</div>
              </div>
              <kbd
                className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--bg-spotlight)', color: 'var(--text-quaternary)', border: '1px solid var(--border-secondary)' }}
              >
                Ctrl+Shift+N
              </kbd>
            </button>

            <button
              onClick={onStartNew}
              className="welcome-shortcut w-full"
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-spotlight)', color: 'var(--text-secondary)' }}
              >
                <Clock size={16} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Recent Sessions</div>
                <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>View session history in sidebar</div>
              </div>
              <kbd
                className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--bg-spotlight)', color: 'var(--text-quaternary)', border: '1px solid var(--border-secondary)' }}
              >
                Ctrl+B
              </kbd>
            </button>
          </div>

          {/* Keyboard shortcuts */}
          <div
            className="flex items-center justify-center gap-4 text-[11px]"
            style={{ color: 'var(--text-quaternary)' }}
          >
            <span className="flex items-center gap-1.5">
              <Keyboard size={11} />
              <span>Ctrl+1-5 switch tabs</span>
            </span>
            <span style={{ color: 'var(--border-secondary)' }}>|</span>
            <span>Esc close dialogs</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-secondary)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-[6px] h-[6px] rounded-full shrink-0"
            style={{
              background: readOnly ? 'var(--text-quaternary)' : status === 'busy' ? 'var(--status-success)' : 'var(--text-quaternary)',
            }}
          />
          <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {session.title || 'Session'}
          </span>
          {session.cwd && (
            <span
              className="flex items-center gap-1 text-[11px] shrink-0 px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-tertiary)', background: 'var(--bg-spotlight)' }}
            >
              <FolderOpen size={10} />
              {shortProject(session.cwd)}
            </span>
          )}
          {messageCount > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] shrink-0 px-1.5 py-0.5 rounded font-mono"
              style={{ color: 'var(--text-quaternary)', background: 'var(--bg-spotlight)' }}
            >
              <Hash size={10} />
              {messageCount}
            </span>
          )}
          {readOnly && (
            <span
              className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-quaternary)', background: 'var(--bg-spotlight)' }}
            >
              Read Only
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDetach}
              className="px-2.5 py-1 text-[12px] rounded-md transition-colors duration-200 hover-bg-spotlight-text"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Detach
            </button>
            <button
              onClick={onKill}
              className="px-2.5 py-1 text-[12px] rounded-md transition-colors duration-200 hover-danger"
              style={{ color: 'var(--status-error)' }}
            >
              Kill
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto">
          {messages.length === 0 && status === 'idle' ? (
            <ChatSkeleton />
          ) : (
            <div style={{ padding: '24px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map((turn, i) => {
                const key = turn.timestamp
                  ? `${turn.role}-${turn.timestamp}`
                  : `${turn.role}-${turn.parts?.[0]?.text?.slice(0, 30) || ''}-${i}`
                return (
                  <div key={key}>
                    <ChatBubble turn={turn} />
                  </div>
                )
              })}
              {status === 'busy' && <TypingIndicator />}
            </div>
          )}
        </div>
      </div>

      {/* Input or Resume */}
      {readOnly ? (
        <div
          className="shrink-0 px-5 py-4 flex justify-center"
          style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-secondary)' }}
        >
          <button
            onClick={onResumeSession}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-[14px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'var(--primary)',
              color: 'var(--text-inverse)',
              boxShadow: '0 4px 12px rgba(204, 120, 92, 0.3)',
            }}
          >
            <RotateCcw size={16} />
            Resume Session
          </button>
        </div>
      ) : (
        <ChatInput onSend={onSend} busy={status === 'busy'} />
      )}
    </div>
  )
}
