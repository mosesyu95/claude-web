import { useState, useRef, useCallback } from 'react'
import { Send, CornerDownLeft } from 'lucide-react'

export default function ChatInput({ onSend, busy }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const ref = useRef()

  const handleSend = useCallback(() => {
    if (!text.trim()) return
    onSend(text)
    setText('')
    ref.current?.focus()
  }, [text, onSend])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="px-5 py-3 shrink-0" style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-secondary)' }}>
      <div className="max-w-[800px] mx-auto">
        <div
          className="flex items-end gap-2 rounded-lg px-3 py-2 transition-all duration-200"
          style={{
            background: 'var(--bg-base)',
            border: `1px solid ${focused ? 'var(--primary)' : 'var(--border)'}`,
            boxShadow: focused ? '0 0 0 2px var(--primary-bg)' : 'none',
          }}
        >
          <textarea
            ref={ref}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={busy ? 'Respond to prompts or type a message...' : 'Ask Claude anything...'}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] focus:outline-none min-h-[24px] max-h-[120px]"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-quaternary)' }}>
              <CornerDownLeft size={10} /> send
            </span>
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="p-1.5 rounded-md transition-colors duration-200"
              style={{
                background: text.trim() ? 'var(--primary)' : 'var(--bg-spotlight)',
                color: text.trim() ? 'var(--text-inverse)' : 'var(--text-quaternary)',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
