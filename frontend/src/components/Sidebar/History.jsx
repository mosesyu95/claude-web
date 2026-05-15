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
    return <div className="p-3 text-xs text-[var(--cr-gray-5)]">Loading...</div>
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-[var(--cr-gray-5)] text-xs">
        <FolderClock size={20} className="mb-2 opacity-40" />
        No history
      </div>
    )
  }

  return (
    <div className="py-1">
      {projects.map(project => (
        <div key={project.dirName}>
          <button
            onClick={() => toggleExpand(project.dirName)}
            className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--cr-gray-3)] hover:bg-[var(--cr-gray-8)] transition-colors"
          >
            {expanded[project.dirName] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="truncate">{shortProject(project.projectDir)}</span>
            <span className="ml-auto text-[var(--cr-gray-6)] text-[10px)]">{project.sessions?.length || 0}</span>
          </button>
          {expanded[project.dirName] && project.sessions && (
            <div>
              {project.sessions.map(session => (
                <div
                  key={session.sessionId}
                  className="group flex items-center gap-1 pl-6 pr-3 py-1 text-xs text-[var(--cr-gray-4)] hover:bg-[var(--cr-gray-8)] transition-colors cursor-pointer"
                  onClick={() => onOpenConversation(session.sessionId, project.projectDir, project.cwd, session.title)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{session.title || 'Untitled'}</div>
                    <div className="text-[10px] text-[var(--cr-gray-6)]">{timeAgo(session.modified)}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onResumeSession(session.sessionId, project.cwd, session.title)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--cr-brand-5)] hover:bg-[var(--cr-brand-6)]/20 transition-all"
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
