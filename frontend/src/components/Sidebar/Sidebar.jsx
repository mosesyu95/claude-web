import { useState } from 'react'
import { Sun, Moon, Monitor, Plus, Sparkles } from 'lucide-react'
import ActiveSessions from './ActiveSessions'
import History from './History'

export default function Sidebar({ theme, effective, cycleTheme, onNewSession, activeSessions, onResumeSession, currentSessionId, onOpenConversation }) {
  const [sidebarTab, setSidebarTab] = useState('sessions')

  return (
    <aside
      className="w-[272px] shrink-0 flex flex-col"
      style={{
        background: 'var(--obsidian-1)',
        borderRight: '1px solid var(--obsidian-4)',
      }}
    >
      {/* Header with gradient accent */}
      <div className="relative px-4 pt-4 pb-3">
        {/* Gradient line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, var(--amber-6), var(--amber-4), var(--amber-6))', backgroundSize: '200% 100%', animation: 'gradientShift 6s ease infinite' }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--amber-7), var(--amber-5))', boxShadow: '0 2px 8px var(--glow-amber-strong)' }}
            >
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Claude</h1>
              <span className="text-[10px] font-medium" style={{ color: 'var(--amber-5)' }}>Web Console</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={cycleTheme}
              className="p-1.5 rounded-md transition-all duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              title={theme === 'auto' ? 'Auto (system)' : theme === 'dark' ? 'Dark' : 'Light'}
            >
              {theme === 'auto' ? <Monitor size={13} /> : theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button
              onClick={onNewSession}
              className="p-1.5 rounded-md transition-all duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--glow-amber)'; e.currentTarget.style.color = 'var(--amber-5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              title="New Session (Ctrl+Shift+N)"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar tabs */}
      <div className="flex mx-3 mb-1 p-0.5 rounded-lg" style={{ background: 'var(--obsidian-3)' }}>
        {['sessions', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className="flex-1 py-1.5 text-[11px] font-semibold capitalize rounded-md transition-all duration-200"
            style={{
              color: sidebarTab === tab ? 'var(--amber-5)' : 'var(--text-tertiary)',
              background: sidebarTab === tab ? 'var(--obsidian-5)' : 'transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'sessions' && (
          <ActiveSessions
            activeSessions={activeSessions}
            onResumeSession={onResumeSession}
            currentSessionId={currentSessionId}
          />
        )}
        {sidebarTab === 'history' && (
          <History onOpenConversation={onOpenConversation} onResumeSession={onResumeSession} />
        )}
      </div>
    </aside>
  )
}
