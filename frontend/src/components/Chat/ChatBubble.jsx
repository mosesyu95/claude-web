import { useState } from 'react'
import { getToolIcon, timeAgo } from '../../helpers'
import { ChevronDown, ChevronRight, Brain, Wrench, Copy, Check, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function ChatBubble({ turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex flex-col items-end" style={{ animation: 'fadeIn 0.2s ease' }}>
        <div
          className="max-w-[70%] px-4 py-2.5 rounded-lg text-[13px]"
          style={{
            background: 'var(--bg-spotlight)',
            color: 'var(--text-primary)',
            lineHeight: '1.65',
          }}
        >
          {turn.parts?.filter(p => p.type === 'text').map((p, i) => (
            <div key={`${p.type}-${p.text?.slice(0, 20)}-${i}`} className="whitespace-pre-wrap">{p.text}</div>
          ))}
        </div>
        {turn.timestamp && (
          <span className="text-[10px] mt-1 mr-1" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(turn.timestamp)}</span>
        )}
      </div>
    )
  }

  if (turn.role === 'assistant') {
    return (
      <div className="flex flex-col items-start" style={{ animation: 'fadeIn 0.25s ease' }}>
        <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {turn.parts?.map((part, i) => {
            const partKey = `${part.type}-${part.text?.slice(0, 20) || part.name || ''}-${i}`
            if (part.type === 'text') {
              return (
                <div
                  key={partKey}
                  className="text-[13px] whitespace-pre-wrap"
                  style={{ color: 'var(--text-primary)', lineHeight: '1.75' }}
                >
                  {part.text}
                </div>
              )
            }
            if (part.type === 'thinking') {
              return <ThinkingBlock key={partKey} text={part.text} />
            }
            if (part.type === 'tool_use') {
              return <ToolUseBlock key={partKey} tool={part} />
            }
            return null
          })}
        </div>
        {turn.timestamp && (
          <span className="text-[10px] mt-2" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(turn.timestamp)}</span>
        )}
      </div>
    )
  }

  if (turn.role === 'system') {
    return (
      <div className="flex justify-center py-2">
        <div
          className="px-3 py-1 rounded-full text-[10px] tracking-wide uppercase"
          style={{ color: 'var(--text-quaternary)', background: 'var(--bg-spotlight)' }}
        >
          {turn.parts?.filter(p => p.type === 'text').map((p, i) => (
            <span key={`${p.type}-${p.text?.slice(0, 20)}-${i}`}>{p.text}</span>
          ))}
        </div>
      </div>
    )
  }

  return null
}

function ThinkingBlock({ text }) {
  const [open, setOpen] = useState(false)
  const preview = text?.slice(0, 100) + (text?.length > 100 ? '...' : '')

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--bg-container)',
        border: '1px solid var(--border-secondary)',
        borderLeft: '2px solid var(--primary)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[11px] transition-colors duration-200 hover:bg-[var(--bg-spotlight)]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <Brain size={11} style={{ color: 'var(--primary)' }} />
        <span className="italic font-medium" style={{ color: 'var(--primary)' }}>Thinking</span>
        {!open && (
          <span className="truncate text-[10px] ml-1 opacity-60">{preview}</span>
        )}
        <span className="ml-auto">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>
      <div className={`thinking-content ${open ? 'open' : ''}`}>
        <div
          className="px-3.5 pb-3 text-[12px] italic leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-secondary)' }}
        >
          <div className="pt-2">{text}</div>
        </div>
      </div>
    </div>
  )
}

function ToolUseBlock({ tool }) {
  const [open, setOpen] = useState(false)
  const hasResult = !!tool.result
  const isError = hasResult && typeof tool.result === 'string' && tool.result.toLowerCase().includes('error')
  const status = !hasResult ? 'running' : isError ? 'error' : 'done'
  const icon = getToolIcon(tool.name)

  return (
    <div className="tool-step" style={{ animation: 'slideInUp 0.2s ease' }}>
      <div className={`tool-step-dot ${status}`} />

      <div
        className="rounded-lg overflow-hidden transition-all duration-200"
        style={{
          background: 'var(--bg-container)',
          border: '1px solid var(--border-secondary)',
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] transition-colors duration-200 hover:bg-[var(--bg-spotlight)]"
        >
          {status === 'running' && <Loader2 size={12} style={{ color: 'var(--primary)' }} className="animate-spin" />}
          {status === 'done' && <CheckCircle2 size={12} style={{ color: 'var(--status-success)' }} />}
          {status === 'error' && <XCircle size={12} style={{ color: 'var(--status-error)' }} />}
          <span className="font-semibold" style={{ color: 'var(--primary)' }}>{tool.name}</span>
          {status === 'running' && (
            <span className="text-[10px] ml-auto" style={{ color: 'var(--text-quaternary)' }}>running...</span>
          )}
          <span className="ml-auto">
            {open ? <ChevronDown size={11} style={{ color: 'var(--text-quaternary)' }} /> : <ChevronRight size={11} style={{ color: 'var(--text-quaternary)' }} />}
          </span>
        </button>

        {open && tool.input && (
          <div className="px-3.5 pb-3" style={{ borderTop: '1px solid var(--border-secondary)' }}>
            <div className="text-[10px] font-semibold mt-2 mb-1 uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Input</div>
            <CodeBlock code={typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2)} />
            {hasResult && (
              <>
                <div className="text-[10px] font-semibold mt-3 mb-1 uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Result</div>
                <CodeBlock
                  code={typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                  maxHeight="10rem"
                  isError={isError}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CodeBlock({ code, maxHeight, isError }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="code-block-wrapper">
      <button className="code-block-copy" onClick={handleCopy}>
        {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
      </button>
      <pre style={{
        color: isError ? 'var(--status-error)' : 'var(--text-secondary)',
        maxHeight: maxHeight || undefined,
        overflow: 'auto',
      }}>
        {code}
      </pre>
    </div>
  )
}
