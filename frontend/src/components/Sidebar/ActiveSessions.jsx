import { useState, useEffect, useCallback } from 'react'
import { sessions as sessionsApi } from '../../api'
import { shortProject } from '../../helpers'
import { Activity, Circle } from 'lucide-react'

export default function ActiveSessions({ activeSessions, onResumeSession, currentSessionId }) {
  const [systemSessions, setSystemSessions] = useState([])

  const loadSystemSessions = useCallback(async () => {
    try {
      const data = await sessionsApi.activeList()
      if (data?.sessions) setSystemSessions(data.sessions)
    } catch {}
  }, [])

  useEffect(() => {
    loadSystemSessions()
    const timer = setInterval(loadSystemSessions, 5000)
    return () => clearInterval(timer)
  }, [loadSystemSessions])

  // Merge local + system sessions, grouped by project
  const groups = {}
  const localArr = Array.from(activeSessions.entries())

  localArr.forEach(([id, s]) => {
    const key = s.cwd || 'unknown'
    if (!groups[key]) groups[key] = { cwd: key, sessions: [] }
    groups[key].sessions.push({ ...s, id, isLocal: true })
  })

  systemSessions.forEach(s => {
    if (localArr.some(([id]) => id === s.sessionId)) return
    const key = s.cwd || 'unknown'
    if (!groups[key]) groups[key] = { cwd: key, sessions: [] }
    groups[key].sessions.push({ ...s, id: s.sessionId, isLocal: false })
  })

  const groupArr = Object.values(groups)

  if (groupArr.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-[var(--cr-gray-5)] text-xs">
        <Activity size={20} className="mb-2 opacity-40" />
        No active sessions
      </div>
    )
  }

  return (
    <div className="py-1">
      {groupArr.map(group => (
        <div key={group.cwd} className="mb-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--cr-gray-5)] uppercase tracking-wider truncate">
            {shortProject(group.cwd)}
          </div>
          {group.sessions.map(s => (
            <button
              key={s.id}
              onClick={() => {
                if (s.isLocal) {
                  // Switch to this session's chat - handled by parent
                } else {
                  onResumeSession(s.id, s.cwd, s.title)
                }
              }}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                currentSessionId === s.id
                  ? 'bg-[var(--cr-brand-6)]/15 text-[var(--cr-brand-4)]'
                  : 'text-[var(--cr-gray-4)] hover:bg-[var(--cr-gray-8)]'
              }`}
            >
              <Circle
                size={6}
                fill={s.status === 'busy' ? 'var(--cr-success)' : 'var(--cr-gray-6)'}
                className={s.status === 'busy' ? 'text-[var(--cr-success)]' : 'text-[var(--cr-gray-6)]'}
              />
              <span className="truncate">{s.title || 'Untitled'}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
