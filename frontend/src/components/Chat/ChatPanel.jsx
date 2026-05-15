import { useRef, useEffect, useState } from 'react'
import { MessageSquare, Zap } from 'lucide-react'
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
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--cr-brand-6)]/15 flex items-center justify-center">
          <MessageSquare size={28} className="text-[var(--cr-brand-5)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--cr-gray-2)]">Welcome to Claude Web</h2>
        <p className="text-sm text-[var(--cr-gray-5)]">Start a new session to begin</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onStartNew}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--cr-brand-6)] text-white hover:bg-[var(--cr-brand-7)] transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--cr-gray-8)] shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} className={status === 'busy' ? 'text-[var(--cr-success)]' : 'text-[var(--cr-gray-6)]'} />
          <span className="text-sm font-medium text-[var(--cr-gray-2)] truncate max-w-[300px]">
            {session.title || 'Session'}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onDetach}
            className="px-2.5 py-1 text-xs rounded-md text-[var(--cr-gray-4)] hover:text-[var(--cr-gray-2)] hover:bg-[var(--cr-gray-8)] transition-colors"
          >
            Detach
          </button>
          <button
            onClick={onKill}
            className="px-2.5 py-1 text-xs rounded-md text-[var(--cr-error)] hover:bg-[var(--cr-error)]/15 transition-colors"
          >
            Kill
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((turn, i) => (
          <ChatBubble key={i} turn={turn} />
        ))}
        {status === 'busy' && <TypingIndicator />}
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={status === 'busy'} />
    </div>
  )
}
