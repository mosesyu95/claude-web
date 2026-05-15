import { useState, useEffect, useCallback } from 'react'
import { sessions as sessionsApi } from '../../api'
import { shortProject, timeAgo } from '../../helpers'
import { ChevronDown, ChevronRight, Play, FolderClock } from 'lucide-react'

export default function History({ onOpenConversation, onResumeSession }) {
  const [projects, setProjects] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loaded, setLoaded] = useState(false)

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
            <span className="truncate flex-1">{shortProject(project.projectDir)}</span>
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
                  onClick={() => onOpenConversation(session.sessionId, project.projectDir, project.cwd, session.title)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[12px]">{session.title || 'Untitled'}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{timeAgo(session.modified)}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onResumeSession(session.sessionId, project.cwd, session.title)
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
