import { useState, useEffect, useCallback, useRef } from 'react'
import { sessions as sessionsApi } from '../../api'
import { shortProject } from '../../helpers'
import { Activity, Trash2 } from 'lucide-react'

export default function ActiveSessions({ activeSessions, onResumeSession, currentSessionId }) {
  const [systemSessions, setSystemSessions] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef(null)

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

  const startEdit = (sessionId, currentTitle) => {
    setEditingId(sessionId)
    setEditValue(currentTitle || '')
    setTimeout(() => editRef.current?.select(), 10)
  }

  const commitEdit = async (sessionId, cwd) => {
    const trimmed = editValue.trim()
    setEditingId(null)
    if (!trimmed) return
    const dirName = cwd ? cwd.replace(/\//g, '-') : null
    try {
      await sessionsApi.rename(sessionId, trimmed, dirName)
      setSystemSessions(prev => prev.map(s =>
        s.sessionId === sessionId ? { ...s, title: trimmed } : s
      ))
    } catch {}
  }

  const handleDelete = async (sessionId, cwd) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    const dirName = cwd ? cwd.replace(/\//g, '-') : null
    try {
      await sessionsApi.delete(sessionId, dirName)
      setSystemSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch {}
  }

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
      <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-ghost)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--obsidian-3)' }}>
          <Activity size={18} style={{ color: 'var(--text-ghost)' }} />
        </div>
        <span className="text-[11px] font-medium">No active sessions</span>
      </div>
    )
  }

  return (
    <div className="py-2 px-2">
      {groupArr.map((group, gi) => (
        <div key={group.cwd} className="mb-2" style={{ animation: `slideInRight 0.3s ease ${gi * 50}ms both` }}>
          <div
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] truncate"
            style={{ color: 'var(--text-ghost)' }}
          >
            {shortProject(group.cwd)}
          </div>
          {group.sessions.map(s => {
            const isActive = currentSessionId === s.id
            const isBusy = s.status === 'busy'
            return (
              <button
                key={s.id}
                onClick={() => {
                  if (!s.isLocal) onResumeSession(s.id, s.cwd, s.title)
                }}
                className="group w-full text-left px-2.5 py-2 flex items-center gap-2.5 rounded-lg text-[12px] transition-all duration-200 mb-0.5"
                style={{
                  color: isActive ? 'var(--amber-4)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--glow-amber)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--obsidian-3)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="relative flex-shrink-0">
                  <span
                    className="block w-2 h-2 rounded-full"
                    style={{
                      background: isBusy ? 'var(--status-success)' : 'var(--obsidian-6)',
                      boxShadow: isBusy ? '0 0 6px var(--glow-success)' : 'none',
                    }}
                  />
                </span>
                {editingId === s.id ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(s.id, s.cwd)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit(s.id, s.cwd)
                      if (e.key === 'Escape') setEditingId(null)
                      e.stopPropagation()
                    }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 text-[12px] bg-transparent outline-none border-b min-w-0"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--amber-5)' }}
                  />
                ) : (
                  <span
                    className="truncate font-medium flex-1 min-w-0"
                    onDoubleClick={e => { e.stopPropagation(); startEdit(s.id, s.title) }}
                  >
                    {s.title || 'Untitled'}
                  </span>
                )}
                {!s.isLocal && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(s.id, s.cwd)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all duration-200 cursor-pointer"
                    style={{ color: 'var(--status-error)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--glow-error)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
