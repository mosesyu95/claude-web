import { X, Play, History } from 'lucide-react'
import ChatBubble from '../Chat/ChatBubble'

export default function ReplayOverlay({ replay, onResume, onClose }) {
  if (!replay) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(8,8,10,0.95)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}
      >
        <div className="flex items-center gap-2.5">
          <History size={14} style={{ color: 'var(--amber-5)' }} />
          <span className="text-[13px] font-semibold truncate max-w-[400px]" style={{ color: 'var(--text-primary)' }}>
            {replay.title || 'Replay'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold rounded-xl transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, var(--amber-7), var(--amber-5))',
              color: 'white',
              boxShadow: '0 2px 12px var(--glow-amber-strong)',
            }}
          >
            <Play size={12} />
            Resume
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-[800px] mx-auto space-y-4">
          {replay.turns?.map((turn, i) => (
            <div key={i} style={{ animation: `fadeIn 0.3s ease ${Math.min(i * 30, 300)}ms both` }}>
              <ChatBubble turn={turn} />
            </div>
          ))}
          {(!replay.turns || replay.turns.length === 0) && (
            <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-ghost)' }}>
              <History size={24} className="mb-2 opacity-30" />
              <span className="text-[13px] font-medium">No conversation data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
