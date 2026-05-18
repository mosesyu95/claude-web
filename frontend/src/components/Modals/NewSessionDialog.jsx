import { useState, useEffect, useRef, useCallback } from 'react'
import { sessions as sessionsApi } from '../../api'
import { useDebounce } from '../../hooks/useDebounce'
import { X, Plus, Search, FolderPlus, FolderOpen, Clock, MessageSquare } from 'lucide-react'
import { useToast } from '../common/Toast'
import { shortProject, timeAgo } from '../../helpers'

export default function NewSessionDialog({ onStart, onClose, onOpenReadOnly }) {
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 500)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [roots, setRoots] = useState([])
  const searchRef = useRef(null)
  const newFolderRef = useRef(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Load roots for display path shorthand
  useEffect(() => {
    sessionsApi.directories().then(data => {
      setRoots(data?.directories || [])
    }).catch(() => {})
  }, [])

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    sessionsApi.search(debouncedQuery).then(data => {
      if (cancelled) return
      setResults(data?.results || [])
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setResults([])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [debouncedQuery])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (showNewFolder && newFolderRef.current) newFolderRef.current.focus()
  }, [showNewFolder])

  const displayPath = useCallback((p) => {
    if (!p) return ''
    for (const root of roots) {
      if (p === root) return '~'
      if (p.startsWith(root + '/')) return '~/' + p.slice(root.length + 1)
    }
    return p
  }, [roots])

  const handleCreateFolder = useCallback(async () => {
    const name = newFolder.trim()
    if (!name) return
    // Create in the selected path or first result's path
    const basePath = selectedPath || results[0]?.path
    if (!basePath) {
      showToast('Select a directory first', 'error')
      return
    }
    const fullPath = basePath.replace(/\/$/, '') + '/' + name
    try {
      const result = await sessionsApi.mkdir(fullPath)
      if (result?.created) {
        setNewFolder('')
        setShowNewFolder(false)
        // Trigger a new search to reflect the folder
        if (debouncedQuery.trim()) {
          sessionsApi.search(debouncedQuery).then(data => {
            setResults(data?.results || [])
          }).catch(() => {})
        }
      }
    } catch {
      showToast('Failed to create folder', 'error')
    }
  }, [newFolder, selectedPath, results, debouncedQuery])

  const handleSelectResult = useCallback((path) => {
    setSelectedPath(path)
  }, [])

  const handleStartSession = useCallback(() => {
    if (selectedPath) {
      onStart(selectedPath)
    } else if (results.length === 1) {
      onStart(results[0].path)
    }
  }, [selectedPath, results, onStart])

  const handleOpenSession = useCallback(async (sessionId, projectPath, title) => {
    if (onOpenReadOnly) {
      await onOpenReadOnly(sessionId, projectPath, null, title)
      onClose()
    }
  }, [onOpenReadOnly, onClose])

  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--bg-mask)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[520px] rounded-lg overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.2s ease',
          maxHeight: '70vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--primary)', color: 'var(--text-inverse)' }}
              >
                <Plus size={16} />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>New Session</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Search for a project directory</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover-bg-spotlight-text"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="px-5 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedPath('') }}
              placeholder="Type to search directories..."
              className="w-full rounded-md pl-8 pr-3 py-2 text-[13px] focus:outline-none focus-ring"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="px-5 pb-3 flex-1 overflow-y-auto" style={{ maxHeight: '320px' }}>
          {!hasQuery ? (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-quaternary)' }}>
              Start typing to search projects and directories
            </div>
          ) : loading ? (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>Searching...</div>
          ) : results.length === 0 ? (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
              No matching directories found
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map(result => {
                const isSelected = selectedPath === result.path
                return (
                  <div
                    key={result.path}
                    className="rounded-md overflow-hidden"
                    style={{
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-secondary)'}`,
                      background: isSelected ? 'var(--bg-spotlight)' : 'transparent',
                    }}
                  >
                    {/* Project header */}
                    <button
                      onClick={() => handleSelectResult(result.path)}
                      onDoubleClick={() => onStart(result.path)}
                      className="flex items-center gap-2 px-3 py-2 w-full text-left transition-colors hover-bg-spotlight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <FolderOpen size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span className="text-[12px] font-medium truncate flex-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        {displayPath(result.path) || result.path}
                      </span>
                      {result.hasHistory && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-spotlight)', color: 'var(--text-tertiary)' }}>
                          {result.recentSessions.length} session{result.recentSessions.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    {/* Recent sessions */}
                    {result.hasHistory && result.recentSessions.length > 0 && (
                      <div className="px-3 pb-2">
                        {result.recentSessions.map(session => (
                          <button
                            key={session.sessionId}
                            onClick={() => handleOpenSession(session.sessionId, result.path, session.title)}
                            className="flex items-center gap-2 px-2 py-1.5 w-full text-left rounded transition-colors hover-bg-spotlight"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <MessageSquare size={11} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
                            <span className="text-[11px] truncate flex-1">
                              {session.title || 'Untitled session'}
                            </span>
                            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-quaternary)', flexShrink: 0 }}>
                              <Clock size={10} />
                              {timeAgo(session.lastModified)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* New folder */}
        {showNewFolder && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-2">
              <input
                ref={newFolderRef}
                type="text"
                value={newFolder}
                onChange={e => setNewFolder(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
                placeholder="Folder name"
                className="flex-1 rounded-md px-3 py-1.5 text-[12px] focus:outline-none focus-ring"
                style={{
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolder.trim()}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: newFolder.trim() ? 'var(--primary)' : 'var(--bg-spotlight)',
                  color: newFolder.trim() ? 'var(--text-inverse)' : 'var(--text-quaternary)',
                  border: 'none',
                }}
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center gap-2 px-5 py-4" style={{ background: 'var(--bg-container)', borderTop: '1px solid var(--border-secondary)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowNewFolder(!showNewFolder); setNewFolder('') }}
              className="p-1.5 rounded transition-colors hover-primary-accent"
              style={{ color: showNewFolder ? 'var(--primary)' : 'var(--text-tertiary)' }}
              title="New folder"
            >
              <FolderPlus size={14} />
            </button>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {selectedPath ? displayPath(selectedPath) : 'Select a project'}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-medium rounded-lg transition-colors duration-200 hover-border-accent"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleStartSession}
              disabled={!selectedPath && results.length !== 1}
              className={`px-5 py-2 text-[12px] font-medium rounded-lg transition-colors duration-200${(selectedPath || results.length === 1) ? ' hover-btn-primary' : ''}`}
              style={{
                background: (selectedPath || results.length === 1) ? 'var(--primary)' : 'var(--bg-spotlight)',
                color: (selectedPath || results.length === 1) ? 'var(--text-inverse)' : 'var(--text-quaternary)',
                border: 'none',
              }}
            >
              Start Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
