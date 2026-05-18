import { useState, useEffect, useCallback, useRef } from 'react'
import { sessions as sessionsApi } from '../../api'
import { shortProject, timeAgo } from '../../helpers'
import { ChevronDown, ChevronRight, Activity, Trash2 } from 'lucide-react'
import { useToast } from '../common/Toast'
import { SessionGroupSkeleton } from '../common/Skeleton'

export default function ActiveSessions({ activeSessions, onResumeSession, onOpenReadOnly, currentSessionId }) {
  const { showToast } = useToast()
  const [systemSessions, setSystemSessions] = useState([])
  const [projects, setProjects] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef(null)
  const expandedRef = useRef({})

  const load = useCallback(async () => {
    try {
      const data = await sessionsApi.activeList()
      const active = data?.sessions || []
      setSystemSessions(active)

      const cwds = [...new Set(active.map(s => s.cwd).filter(Boolean))]
      const results = await Promise.all(
        cwds.map(async (cwd) => {
          const dirName = cwd.replace(/\//g, '-')
          try {
            const d = await sessionsApi.projectSessions(dirName)
            return { dirName, projectPath: cwd, sessions: d?.sessions || [] }
          } catch { return null }
        })
      )

      const activeIds = new Set(active.map(s => s.sessionId))
      const projectList = results
        .filter(p => p && p.sessions.some(s => activeIds.has(s.sessionId)))
        .map(p => ({
          ...p,
          sessions: p.sessions
            .filter(s => activeIds.has(s.sessionId) || s.messageCount > 0)
            .map(s => ({ ...s, isActive: activeIds.has(s.sessionId) }))
            .sort((a, b) => (a.isActive ? 0 : 1) - (b.isActive ? 0 : 1) || new Date(b.lastModified) - new Date(a.lastModified))
        }))

      setProjects(projectList)

      const newExpanded = { ...expandedRef.current }
      projectList.forEach(p => {
        if (!(p.dirName in newExpanded)) newExpanded[p.dirName] = true
      })
      expandedRef.current = newExpanded
      setExpanded(newExpanded)
      setLoaded(true)
    } catch {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])

  const toggleExpand = (dirName) => {
    setExpanded(prev => {
      const next = { ...prev, [dirName]: !prev[dirName] }
      expandedRef.current = next
      return next
    })
  }

  const startEdit = (sessionId, currentTitle) => {
    setEditingId(sessionId)
    setEditValue(currentTitle || '')
    setTimeout(() => editRef.current?.select(), 10)
  }

  const commitEdit = async (sessionId, dirName) => {
    const trimmed = editValue.trim()
    setEditingId(null)
    if (!trimmed) return
    try {
      await sessionsApi.rename(sessionId, trimmed, dirName)
      setProjects(prev => prev.map(p => ({
        ...p,
        sessions: p.sessions.map(s =>
          s.sessionId === sessionId ? { ...s, title: trimmed } : s
        ),
      })))
    } catch {
      showToast('Failed to rename session', 'error')
    }
  }

  const handleDelete = async (sessionId, dirName) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    try {
      await sessionsApi.delete(sessionId, dirName)
      setProjects(prev => prev.map(p => ({
        ...p,
        sessions: p.sessions.filter(s => s.sessionId !== sessionId),
      })).filter(p => p.sessions.length > 0))
    } catch {
      showToast('Failed to delete session', 'error')
    }
  }

  if (!loaded) {
    return (
      <div className="py-1.5 px-2">
        <SessionGroupSkeleton />
        <SessionGroupSkeleton />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-quaternary)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--bg-spotlight)' }}>
          <Activity size={18} style={{ color: 'var(--text-quaternary)' }} />
        </div>
        <span className="text-[12px]">No active sessions</span>
      </div>
    )
  }

  return (
    <div className="py-1.5 px-2">
      {projects.map((project, pi) => (
        <div key={project.dirName} style={{ animation: `slideInRight 0.3s ease ${pi * 30}ms both` }}>
          <button
            onClick={() => toggleExpand(project.dirName)}
            className="w-full text-left px-2.5 py-2 flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors duration-200 hover-bg-spotlight"
            style={{ color: 'var(--text-secondary)' }}
          >
            {expanded[project.dirName]
              ? <ChevronDown size={12} style={{ color: 'var(--text-quaternary)' }} />
              : <ChevronRight size={12} style={{ color: 'var(--text-quaternary)' }} />
            }
            <span className="truncate flex-1">{shortProject(project.projectPath)}</span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ color: 'var(--status-success)', background: 'var(--bg-spotlight)' }}
            >
              {project.sessions.filter(s => s.isActive).length}
            </span>
          </button>
          {expanded[project.dirName] && (
            <div className="ml-2 pl-2.5" style={{ borderLeft: '1px solid var(--border-secondary)' }}>
              {project.sessions.map(s => {
                const isActive = currentSessionId === s.sessionId
                return (
                  <button
                    key={s.sessionId}
                    onClick={() => {
                      if (s.isActive) {
                        onResumeSession(s.sessionId, project.projectPath, s.title)
                      } else {
                        onOpenReadOnly(s.sessionId, project.projectPath, project.dirName, s.title)
                      }
                    }}
                    className={`group w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] transition-colors duration-200 mb-0.5 sidebar-item-indicator${!isActive ? ' hover-bg-spotlight' : ''}`}
                    style={{
                      color: isActive ? 'var(--primary)' : 'var(--text-tertiary)',
                      background: isActive ? 'var(--primary-bg)' : 'transparent',
                    }}
                  >
                    <span
                      className="block w-[6px] h-[6px] rounded-full shrink-0"
                      style={{
                        background: s.isActive ? 'var(--status-success)' : 'var(--text-quaternary)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      {editingId === s.sessionId ? (
                        <input
                          ref={editRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(s.sessionId, project.dirName)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(s.sessionId, project.dirName)
                            if (e.key === 'Escape') setEditingId(null)
                            e.stopPropagation()
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-[13px] bg-transparent outline-none"
                          style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--primary)' }}
                        />
                      ) : (
                        <div
                          className="truncate font-medium"
                          onDoubleClick={e => { e.stopPropagation(); startEdit(s.sessionId, s.title) }}
                        >
                          {s.title || 'Untitled'}
                        </div>
                      )}
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(s.lastModified)}</div>
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(s.sessionId, project.dirName)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity duration-200 cursor-pointer hover-danger"
                      style={{ color: 'var(--text-quaternary)' }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
