import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, Plus } from 'lucide-react'
import { sessions as sessionsApi } from '../../api'
import ActiveSessions from './ActiveSessions'
import History from './History'

export default function Sidebar({ theme, toggleTheme, onNewSession, activeSessions, onResumeSession, currentSessionId, onOpenConversation }) {
  const [sidebarTab, setSidebarTab] = useState('sessions') // sessions | history

  return (
    <aside className="w-[260px] shrink-0 flex flex-col border-r border-[var(--cr-gray-8)] bg-[var(--cr-gray-10)] dark:bg-[var(--cr-gray-11)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--cr-gray-8)]">
        <h1 className="text-sm font-semibold text-[var(--cr-brand-5)] tracking-wide">Claude Web</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-[var(--cr-gray-5)] hover:text-[var(--cr-gray-3)] hover:bg-[var(--cr-gray-8)] transition-colors"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={onNewSession}
            className="p-1.5 rounded-md text-[var(--cr-gray-5)] hover:text-[var(--cr-brand-5)] hover:bg-[var(--cr-gray-8)] transition-colors"
            title="New Session (Ctrl+Shift+N)"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Sidebar tabs */}
      <div className="flex border-b border-[var(--cr-gray-8)]">
        {['sessions', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              sidebarTab === tab
                ? 'text-[var(--cr-brand-5)] border-b-2 border-[var(--cr-brand-6)]'
                : 'text-[var(--cr-gray-5)] hover:text-[var(--cr-gray-3)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
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
