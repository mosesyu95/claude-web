import { useState } from 'react'
import { getToolIcon, timeAgo } from '../../helpers'
import { ChevronDown, ChevronRight, Brain, Wrench } from 'lucide-react'

export default function ChatBubble({ turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div
          className="max-w-[70%] px-4 py-2.5 rounded-lg text-[13px] leading-relaxed"
          style={{
            background: 'var(--primary)',
            color: 'var(--text-inverse)',
          }}
        >
          {turn.parts?.filter(p => p.type === 'text').map((p, i) => (
            <div key={i} className="whitespace-pre-wrap">{p.text}</div>
          ))}
        </div>
        {turn.timestamp && (
          <span className="text-[11px] mt-1 mr-1" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(turn.timestamp)}</span>
        )}
      </div>
    )
  }

  if (turn.role === 'assistant') {
    return (
      <div className="flex flex-col items-start">
        <div className="max-w-[85%] space-y-2.5">
          {turn.parts?.map((part, i) => {
            if (part.type === 'text') {
              return (
                <div
                  key={i}
                  className="px-4 py-3 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-secondary)',
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
        {turn.timestamp && (
          <span className="text-[11px] mt-1 ml-1" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(turn.timestamp)}</span>
        )}
      </div>
    )
  }

  if (turn.role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <div
          className="px-3 py-1 rounded-full text-[11px]"
          style={{ color: 'var(--text-tertiary)', background: 'var(--bg-spotlight)' }}
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
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-spotlight)', border: '1px solid var(--border-secondary)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2 text-[12px] transition-colors duration-200 hover:bg-[var(--bg-container)]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Brain size={12} style={{ color: 'var(--primary)' }} />
        <span className="italic font-medium">Thinking...</span>
      </button>
      {open && (
        <div
          className="px-3.5 pb-3 text-[12px] italic leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-secondary)' }}
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
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-spotlight)', border: '1px solid var(--border-secondary)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2 text-[12px] transition-colors duration-200 hover:bg-[var(--bg-container)]"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={11} style={{ color: 'var(--primary)' }} />
        <span className="font-semibold" style={{ color: 'var(--primary)' }}>{tool.name}</span>
      </button>
      {open && tool.input && (
        <div className="px-3.5 pb-3" style={{ borderTop: '1px solid var(--border-secondary)' }}>
          <pre
            className="text-[11px] whitespace-pre-wrap overflow-x-auto mt-2 rounded-md p-2.5"
            style={{ color: 'var(--text-tertiary)', background: 'var(--bg-container)', fontFamily: 'var(--font-mono)' }}
          >
            {typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2)}
          </pre>
          {tool.result && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-secondary)' }}>
              <div className="text-[10px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Result</div>
              <div
                className="text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto rounded-md p-2.5"
                style={{ color: 'var(--text-tertiary)', background: 'var(--bg-container)', fontFamily: 'var(--font-mono)' }}
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
