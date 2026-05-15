import { useState } from 'react'
import { getToolIcon } from '../../helpers'
import { ChevronDown, ChevronRight, Brain, Wrench } from 'lucide-react'

export default function ChatBubble({ turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-md text-[13px] leading-relaxed"
          style={{
            background: 'linear-gradient(135deg, var(--amber-7), var(--amber-6))',
            color: 'white',
            boxShadow: '0 2px 12px rgba(245, 158, 11, 0.2)',
          }}
        >
          {turn.parts?.filter(p => p.type === 'text').map((p, i) => (
            <div key={i} className="whitespace-pre-wrap">{p.text}</div>
          ))}
        </div>
      </div>
    )
  }

  if (turn.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-2.5">
          {turn.parts?.map((part, i) => {
            if (part.type === 'text') {
              return (
                <div
                  key={i}
                  className="px-4 py-3 rounded-2xl rounded-bl-md text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: 'var(--obsidian-2)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--obsidian-4)',
                  }}
                >
                  {part.text}
                </div>
              )
            }
            if (part.type === 'thinking') {
              return <ThinkingBlock key={i} text={part.text} />
            }
            if (part.type === 'tool_use') {
              return <ToolUseBlock key={i} tool={part} />
            }
            return null
          })}
        </div>
      </div>
    )
  }

  if (turn.role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <div
          className="px-4 py-1.5 rounded-full text-[11px] font-medium"
          style={{ color: 'var(--text-ghost)', background: 'var(--obsidian-2)', border: '1px solid var(--obsidian-4)' }}
        >
          {turn.parts?.filter(p => p.type === 'text').map((p, i) => (
            <span key={i}>{p.text}</span>
          ))}
        </div>
      </div>
    )
  }

  return null
}

function ThinkingBlock({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--obsidian-2)', border: '1px solid var(--obsidian-4)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2 text-[12px] transition-all duration-200"
        style={{ color: 'var(--text-tertiary)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--obsidian-3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Brain size={12} style={{ color: 'var(--amber-5)' }} />
        <span className="italic font-medium">Thinking...</span>
      </button>
      {open && (
        <div
          className="px-3.5 pb-3 text-[12px] italic leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--obsidian-4)' }}
        >
          <div className="pt-2">{text}</div>
        </div>
      )}
    </div>
  )
}

function ToolUseBlock({ tool }) {
  const [open, setOpen] = useState(false)
  const icon = getToolIcon(tool.name)
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--obsidian-2)', border: '1px solid var(--obsidian-4)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2 text-[12px] transition-all duration-200"
        onMouseEnter={e => e.currentTarget.style.background = 'var(--obsidian-3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={11} style={{ color: 'var(--amber-5)' }} />
        <span className="font-semibold" style={{ color: 'var(--amber-4)' }}>{tool.name}</span>
      </button>
      {open && tool.input && (
        <div className="px-3.5 pb-3" style={{ borderTop: '1px solid var(--obsidian-4)' }}>
          <pre
            className="text-[11px] whitespace-pre-wrap overflow-x-auto mt-2 rounded-lg p-2.5"
            style={{ color: 'var(--text-tertiary)', background: 'var(--obsidian-3)', fontFamily: 'var(--font-mono)' }}
          >
            {typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2)}
          </pre>
          {tool.result && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--obsidian-4)' }}>
              <div className="text-[10px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Result</div>
              <div
                className="text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto rounded-lg p-2.5"
                style={{ color: 'var(--text-tertiary)', background: 'var(--obsidian-3)', fontFamily: 'var(--font-mono)' }}
              >
                {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
