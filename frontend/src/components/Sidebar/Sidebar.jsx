import { useState } from 'react'
import { Sun, Moon, Monitor, Plus, Bot } from 'lucide-react'
import ActiveSessions from './ActiveSessions'
import History from './History'

export default function Sidebar({ theme, effective, cycleTheme, onNewSession, activeSessions, onResumeSession, currentSessionId, onOpenConversation }) {
  const [sidebarTab, setSidebarTab] = useState('sessions')

  return (
    <aside
      className="w-[272px] shrink-0 flex flex-col"
      style={{
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-secondary)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary)' }}
            >
              <Bot size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>Claude</h1>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Web Console</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={cycleTheme}
              className="p-1.5 rounded-md transition-colors duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-spotlight)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              title={theme === 'auto' ? 'Auto (system)' : theme === 'dark' ? 'Dark' : 'Light'}
            >
              {theme === 'auto' ? <Monitor size={14} /> : theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={onNewSession}
              className="p-1.5 rounded-md transition-colors duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-bg)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              title="New Session (Ctrl+Shift+N)"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar tabs — Ant Design segmented style */}
      <div className="flex mx-3 mb-2 p-[2px] rounded-lg" style={{ background: 'var(--bg-spotlight)' }}>
        {['sessions', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className="flex-1 py-1 text-[12px] font-medium capitalize rounded-md transition-all duration-200"
            style={{
              color: sidebarTab === tab ? 'var(--primary)' : 'var(--text-tertiary)',
              background: sidebarTab === tab ? 'var(--bg-elevated)' : 'transparent',
              boxShadow: sidebarTab === tab ? 'var(--shadow-sm)' : 'none',
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
