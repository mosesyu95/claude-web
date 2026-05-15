import { useRef, useEffect } from 'react'
import { MessageSquare, Zap, ArrowDown } from 'lucide-react'
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
      <div className="h-full flex flex-col items-center justify-center gap-6" style={{ animation: 'fadeIn 0.5s ease' }}>
        {/* Animated glow ring */}
        <div className="relative">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--amber-7), var(--amber-5))',
              boxShadow: '0 4px 24px var(--glow-amber-strong), 0 0 60px var(--glow-amber)',
              animation: 'pulseGlow 3s ease-in-out infinite',
            }}
          >
            <MessageSquare size={32} className="text-white" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>Welcome to Claude</h2>
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>Start a new session to begin coding with AI</p>
        </div>
        <button
          onClick={onStartNew}
          className="px-6 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, var(--amber-7), var(--amber-5))',
            color: 'white',
            boxShadow: '0 2px 12px var(--glow-amber-strong)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px var(--glow-amber-strong)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px var(--glow-amber-strong)' }}
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
        style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: status === 'busy' ? 'var(--status-success)' : 'var(--obsidian-6)',
              boxShadow: status === 'busy' ? '0 0 8px var(--glow-success)' : 'none',
              animation: status === 'busy' ? 'pulseGlow 2s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[13px] font-semibold truncate max-w-[300px]" style={{ color: 'var(--text-primary)' }}>
            {session.title || 'Session'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDetach}
            className="px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-200"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            Detach
          </button>
          <button
            onClick={onKill}
            className="px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-200"
            style={{ color: 'var(--status-error)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--glow-error)'}
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
      <ChatInput onSend={onSend} disabled={status === 'busy'} />
    </div>
  )
}
