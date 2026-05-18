import { X, Play, History } from 'lucide-react'
import ChatBubble from '../Chat/ChatBubble'

export default function ReplayOverlay({ replay, onResume, onClose }) {
  if (!replay) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg-mask)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-secondary)' }}
      >
        <div className="flex items-center gap-2.5">
          <History size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-[13px] font-medium truncate max-w-[400px]" style={{ color: 'var(--text-primary)' }}>
            {replay.title || 'Replay'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors duration-200 hover-btn-primary"
            style={{
              background: 'var(--primary)',
              color: 'var(--text-inverse)',
            }}
          >
            <Play size={12} />
            Resume
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors hover-bg-spotlight-text"
            style={{ color: 'var(--text-tertiary)' }}
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
            <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-quaternary)' }}>
              <History size={24} className="mb-2 opacity-30" />
              <span className="text-[13px]">No conversation data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
