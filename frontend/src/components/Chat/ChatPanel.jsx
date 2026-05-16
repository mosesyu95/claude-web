import { useRef, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import ChatBubble from './ChatBubble'
import ChatInput from './ChatInput'
import TypingIndicator from './TypingIndicator'

export default function ChatPanel({ session, messages, status, onSend, onDetach, onKill, onStartNew }) {
  const messagesRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, status])

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5" style={{ animation: 'fadeIn 0.5s ease' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)' }}
        >
          <MessageSquare size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <div className="text-center">
          <h2 className="text-[16px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome to Claude</h2>
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>Start a new session to begin coding with AI</p>
        </div>
        <button
          onClick={onStartNew}
          className="px-5 py-2 text-[13px] font-medium rounded-lg transition-colors duration-200"
          style={{
            background: 'var(--primary)',
            color: 'var(--text-inverse)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
        >
          Start New Session
        </button>
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
        <div className="flex items-center gap-2.5">
          <span
            className="w-[6px] h-[6px] rounded-full"
            style={{
              background: status === 'busy' ? 'var(--status-success)' : 'var(--text-quaternary)',
            }}
          />
          <span className="text-[13px] font-medium truncate max-w-[300px]" style={{ color: 'var(--text-primary)' }}>
            {session.title || 'Session'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDetach}
            className="px-2.5 py-1 text-[12px] rounded-md transition-colors duration-200"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-spotlight)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            Detach
          </button>
          <button
            onClick={onKill}
            className="px-2.5 py-1 text-[12px] rounded-md transition-colors duration-200"
            style={{ color: 'var(--status-error)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,77,79,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Kill
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-[800px] mx-auto space-y-4">
          {messages.map((turn, i) => (
            <div key={i} style={{ animation: `fadeIn 0.3s ease ${Math.min(i * 30, 200)}ms both` }}>
              <ChatBubble turn={turn} />
            </div>
          ))}
          {status === 'busy' && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} busy={status === 'busy'} />
    </div>
  )
}
