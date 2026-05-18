import { useState, useEffect, useCallback, useRef } from 'react'
import { sessions as sessionsApi } from '../../api'
import { shortProject, timeAgo } from '../../helpers'
import { ChevronDown, ChevronRight, Play, FolderClock, Trash2 } from 'lucide-react'
import { useToast } from '../common/Toast'
import { SessionGroupSkeleton } from '../common/Skeleton'

export default function History({ onOpenConversation, onResumeSession }) {
  const { showToast } = useToast()
  const [projects, setProjects] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef(null)

  const loadProjects = useCallback(async () => {
    try {
      const data = await sessionsApi.projects()
      if (data?.projects) setProjects(data.projects)
    } catch {
      showToast('Failed to load history', 'error')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!loaded) loadProjects()
  }, [loaded, loadProjects])

  const toggleExpand = (dirName) => {
    setExpanded(prev => ({ ...prev, [dirName]: !prev[dirName] }))
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
        <SessionGroupSkeleton />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-quaternary)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--bg-spotlight)' }}>
          <FolderClock size={18} style={{ color: 'var(--text-quaternary)' }} />
        </div>
        <span className="text-[12px]">No history</span>
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
              style={{ color: 'var(--text-tertiary)', background: 'var(--bg-spotlight)' }}
            >
              {project.sessions?.length || 0}
            </span>
          </button>
          {expanded[project.dirName] && project.sessions && (
            <div className="ml-2 pl-2.5" style={{ borderLeft: '1px solid var(--border-secondary)' }}>
              {project.sessions.map(session => (
                <div
                  key={session.sessionId}
                  className="group flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-200 hover-bg-spotlight-text sidebar-item-indicator"
                  style={{ color: 'var(--text-tertiary)' }}
                  onClick={() => onOpenConversation(session.sessionId, project.projectPath, project.projectPath, session.title)}
                >
                  <div className="flex-1 min-w-0">
                    {editingId === session.sessionId ? (
                      <input
                        ref={editRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(session.sessionId, project.dirName)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(session.sessionId, project.dirName)
                          if (e.key === 'Escape') setEditingId(null)
                          e.stopPropagation()
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-[13px] bg-transparent outline-none"
                        style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--primary)' }}
                      />
                    ) : (
                      <div
                        className="truncate text-[13px]"
                        onDoubleClick={e => { e.stopPropagation(); startEdit(session.sessionId, session.title) }}
                      >
                        {session.title || 'Untitled'}
                      </div>
                    )}
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(session.lastModified)}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(session.sessionId, project.dirName)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity duration-200 hover-danger"
                    style={{ color: 'var(--text-quaternary)' }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onResumeSession(session.sessionId, project.projectPath, session.title)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity duration-200 hover-primary-accent"
                    style={{ color: 'var(--primary)' }}
                    title="Resume"
                  >
                    <Play size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
