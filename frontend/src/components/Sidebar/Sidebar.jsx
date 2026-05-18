import { useState } from 'react'
import { Sun, Moon, Monitor, Plus, Bot, PanelLeftClose, PanelLeftOpen, MessageSquare, History as HistoryIcon } from 'lucide-react'
import ActiveSessions from './ActiveSessions'
import History from './History'

const SIDEBAR_WIDTH = 272
const SIDEBAR_COLLAPSED = 56

export default function Sidebar({ theme, effective, cycleTheme, collapsed, onToggleCollapse, onNewSession, activeSessions, onResumeSession, currentSessionId, onOpenConversation }) {
  const [sidebarTab, setSidebarTab] = useState('sessions')

  if (collapsed) {
    return (
      <aside
        className="shrink-0 flex flex-col items-center"
        style={{
          width: SIDEBAR_COLLAPSED,
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-secondary)',
        }}
      >
        {/* Logo */}
        <div className="pt-5 pb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--primary)' }}
          >
            <Bot size={16} style={{ color: 'var(--text-inverse)' }} />
          </div>
        </div>

        {/* Nav icons */}
        <div className="flex flex-col items-center gap-1.5 mb-3">
          <button
            onClick={() => { setSidebarTab('sessions'); onToggleCollapse() }}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors${sidebarTab !== 'sessions' ? ' hover-bg-spotlight' : ''}`}
            style={{
              color: sidebarTab === 'sessions' ? 'var(--primary)' : 'var(--text-tertiary)',
              background: sidebarTab === 'sessions' ? 'var(--primary-bg)' : 'transparent',
            }}
            title="Sessions"
          >
            <MessageSquare size={16} />
            {activeSessions.size > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                style={{ background: 'var(--primary)', color: 'var(--text-inverse)' }}
              >
                {activeSessions.size > 9 ? '9+' : activeSessions.size}
              </span>
            )}
          </button>
          <button
            onClick={() => { setSidebarTab('history'); onToggleCollapse() }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors${sidebarTab !== 'history' ? ' hover-bg-spotlight' : ''}`}
            style={{
              color: sidebarTab === 'history' ? 'var(--primary)' : 'var(--text-tertiary)',
              background: sidebarTab === 'history' ? 'var(--primary-bg)' : 'transparent',
            }}
            title="History"
          >
            <HistoryIcon size={16} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1.5 pb-5">
          <button
            onClick={cycleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover-bg-spotlight-text"
            style={{ color: 'var(--text-tertiary)' }}
            title={theme === 'auto' ? 'Auto (system)' : theme === 'dark' ? 'Dark' : 'Light'}
          >
            {theme === 'auto' ? <Monitor size={16} /> : theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={onNewSession}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover-primary-accent"
            style={{ color: 'var(--text-tertiary)' }}
            title="New Session (Ctrl+Shift+N)"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover-bg-spotlight-text"
            style={{ color: 'var(--text-tertiary)' }}
            title="Expand sidebar (Ctrl+B)"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="shrink-0 flex flex-col"
      style={{
        width: SIDEBAR_WIDTH,
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-secondary)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary)' }}
            >
              <Bot size={15} style={{ color: 'var(--text-inverse)' }} />
            </div>
            <div>
              <h1 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>Claude</h1>
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Web Console</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={cycleTheme}
              className="p-1.5 rounded-md transition-colors duration-200 hover-bg-spotlight-text"
              style={{ color: 'var(--text-tertiary)' }}
              title={theme === 'auto' ? 'Auto (system)' : theme === 'dark' ? 'Dark' : 'Light'}
            >
              {theme === 'auto' ? <Monitor size={14} /> : theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={onNewSession}
              className="p-1.5 rounded-md transition-colors duration-200 hover-primary-accent"
              style={{ color: 'var(--text-tertiary)' }}
              title="New Session (Ctrl+Shift+N)"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-md transition-colors duration-200 hover-bg-spotlight-text"
              style={{ color: 'var(--text-tertiary)' }}
              title="Collapse sidebar (Ctrl+B)"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar tabs */}
      <div className="flex mx-3 mb-2 p-[2px] rounded-lg" style={{ background: 'var(--bg-spotlight)' }}>
        {['sessions', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className="flex-1 py-1.5 text-[11px] font-medium capitalize rounded-md transition-all duration-200"
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
