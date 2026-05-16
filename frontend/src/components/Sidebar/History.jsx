import { useState, useEffect, useCallback, useRef } from 'react'
import { sessions as sessionsApi } from '../../api'
import { shortProject, timeAgo } from '../../helpers'
import { ChevronDown, ChevronRight, Play, FolderClock, Trash2 } from 'lucide-react'

export default function History({ onOpenConversation, onResumeSession }) {
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
      setLoaded(true)
    } catch {}
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
    } catch {}
  }

  const handleDelete = async (sessionId, dirName) => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    try {
      await sessionsApi.delete(sessionId, dirName)
      setProjects(prev => prev.map(p => ({
        ...p,
        sessions: p.sessions.filter(s => s.sessionId !== sessionId),
      })).filter(p => p.sessions.length > 0))
    } catch {}
  }

  if (!loaded) {
    return (
      <div className="p-3">
        <div className="h-4 rounded-md animate-pulse" style={{ background: 'var(--obsidian-3)' }} />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-ghost)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--obsidian-3)' }}>
          <FolderClock size={18} style={{ color: 'var(--text-ghost)' }} />
        </div>
        <span className="text-[11px] font-medium">No history</span>
      </div>
    )
  }

  return (
    <div className="py-2 px-2">
      {projects.map((project, pi) => (
        <div key={project.dirName} style={{ animation: `slideInRight 0.3s ease ${pi * 30}ms both` }}>
          <button
            onClick={() => toggleExpand(project.dirName)}
            className="w-full text-left px-2.5 py-2 flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition-all duration-200"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--obsidian-3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {expanded[project.dirName]
              ? <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
              : <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
            }
            <span className="truncate flex-1">{shortProject(project.projectPath)}</span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
              style={{ color: 'var(--text-ghost)', background: 'var(--obsidian-3)' }}
            >
              {project.sessions?.length || 0}
            </span>
          </button>
          {expanded[project.dirName] && project.sessions && (
            <div className="ml-2 pl-2.5" style={{ borderLeft: '1px solid var(--obsidian-4)' }}>
              {project.sessions.map(session => (
                <div
                  key={session.sessionId}
                  className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-3)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
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
                        className="w-full text-[12px] bg-transparent outline-none border-b"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--amber-5)' }}
                      />
                    ) : (
                      <div
                        className="truncate text-[12px]"
                        onDoubleClick={e => { e.stopPropagation(); startEdit(session.sessionId, session.title) }}
                      >
                        {session.title || 'Untitled'}
                      </div>
                    )}
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{timeAgo(session.lastModified)}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(session.sessionId, project.dirName)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all duration-200"
                    style={{ color: 'var(--status-error)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--glow-error)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onResumeSession(session.sessionId, project.projectPath, session.title)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all duration-200"
                    style={{ color: 'var(--amber-5)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--glow-amber)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Resume"
                  >
                    <Play size={10} />
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
