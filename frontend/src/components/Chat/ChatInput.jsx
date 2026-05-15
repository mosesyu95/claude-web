import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const ref = useRef()

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
    ref.current?.focus()
  }, [text, disabled, onSend])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-[var(--cr-gray-8)] shrink-0">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Waiting for response...' : 'Type a message... (Enter to send, Shift+Enter for newline)'}
        rows={1}
        className="flex-1 resize-none rounded-lg bg-[var(--cr-gray-9)] border border-[var(--cr-gray-8)] px-3 py-2 text-sm text-[var(--cr-gray-2)] placeholder:text-[var(--cr-gray-6)] focus:outline-none focus:border-[var(--cr-brand-6)] transition-colors min-h-[36px] max-h-[120px]"
        style={{ height: 'auto' }}
        onInput={(e) => {
          e.target.style.height = 'auto'
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="p-2 rounded-lg bg-[var(--cr-brand-6)] text-white hover:bg-[var(--cr-brand-7)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        <Send size={16} />
      </button>
    </div>
  )
}
