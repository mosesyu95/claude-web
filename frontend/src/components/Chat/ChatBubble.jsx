import { useState } from 'react'
import { getToolIcon, escapeHtml } from '../../helpers'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function ChatBubble({ turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-3 py-2 rounded-xl bg-[var(--cr-brand-6)] text-white text-sm leading-relaxed">
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
        <div className="max-w-[85%] space-y-2">
          {turn.parts?.map((part, i) => {
            if (part.type === 'text') {
              return (
                <div key={i} className="px-3 py-2 rounded-xl bg-[var(--cr-gray-9)] border border-[var(--cr-gray-8)] text-sm text-[var(--cr-gray-2)] leading-relaxed whitespace-pre-wrap">
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
      <div className="flex justify-center">
        <div className="px-3 py-1 rounded-full bg-[var(--cr-gray-9)] border border-[var(--cr-gray-8)] text-xs text-[var(--cr-gray-5)]">
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
    <div className="rounded-lg border border-[var(--cr-gray-8)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--cr-gray-5)] hover:bg-[var(--cr-gray-8)] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="italic">Thinking...</span>
      </button>
      {open && (
        <div className="px-3 pb-2 text-xs text-[var(--cr-gray-4)] italic leading-relaxed whitespace-pre-wrap border-t border-[var(--cr-gray-8)]">
          {text}
        </div>
      )}
    </div>
  )
}

function ToolUseBlock({ tool }) {
  const [open, setOpen] = useState(false)
  const icon = getToolIcon(tool.name)
  return (
    <div className="rounded-lg border border-[var(--cr-gray-8)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-[var(--cr-gray-8)] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-[var(--cr-warning)]">{icon} {tool.name}</span>
      </button>
      {open && tool.input && (
        <div className="px-3 pb-2 border-t border-[var(--cr-gray-8)]">
          <pre className="text-[11px] text-[var(--cr-gray-4)] font-mono whitespace-pre-wrap overflow-x-auto mt-1">
            {typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2)}
          </pre>
          {tool.result && (
            <div className="mt-1.5 pt-1.5 border-t border-[var(--cr-gray-8)]">
              <div className="text-[10px] text-[var(--cr-gray-5)] mb-0.5 font-medium">Result</div>
              <div className="text-[11px] text-[var(--cr-gray-4)] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
