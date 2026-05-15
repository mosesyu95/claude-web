import { X, Play } from 'lucide-react'
import ChatBubble from '../Chat/ChatBubble'

export default function ReplayOverlay({ replay, onResume, onClose }) {
  if (!replay) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--cr-gray-12)]/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cr-gray-8)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--cr-gray-2)] truncate max-w-[400px]">
            {replay.title || 'Replay'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--cr-brand-6)] text-white hover:bg-[var(--cr-brand-7)] transition-colors"
          >
            <Play size={12} />
            Resume
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--cr-gray-5)] hover:bg-[var(--cr-gray-8)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {replay.turns?.map((turn, i) => (
          <ChatBubble key={i} turn={turn} />
        ))}
        {(!replay.turns || replay.turns.length === 0) && (
          <div className="flex items-center justify-center h-32 text-[var(--cr-gray-5)] text-sm">
            No conversation data
          </div>
        )}
      </div>
    </div>
  )
}
