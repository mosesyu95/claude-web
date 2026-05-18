import { useState, useEffect, useRef, useCallback } from 'react'
import { sessions as sessionsApi } from '../../api'
import { X, FolderOpen, Plus, ChevronRight, ArrowLeft, Search, FolderPlus } from 'lucide-react'

export default function NewSessionDialog({ onStart, onClose }) {
  const [roots, setRoots] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const searchRef = useRef(null)
  const newFolderRef = useRef(null)

  useEffect(() => {
    sessionsApi.directories().then(data => {
      const dirs = data?.directories || []
      setRoots(dirs)
      if (dirs.length === 1) {
        navigateTo(dirs[0])
      }
    })
  }, [])

  const navigateTo = useCallback(async (dir) => {
    setCurrentPath(dir)
    setSearch('')
    setShowNewFolder(false)
    setNewFolder('')
    setLoading(true)
    try {
      const data = await sessionsApi.ls(dir)
      setEntries(data?.entries || [])
    } catch { setEntries([]) }
    setLoading(false)
  }, [])

  const goUp = useCallback(() => {
    if (!currentPath) return
    const parent = currentPath.replace(/\/[^/]+\/?$/, '') || '/'
    navigateTo(parent)
  }, [currentPath, navigateTo])

  const handleCreateFolder = useCallback(async () => {
    const name = newFolder.trim()
    if (!name || !currentPath) return
    const fullPath = currentPath.replace(/\/$/, '') + '/' + name
    try {
      const result = await sessionsApi.mkdir(fullPath)
      if (result?.created) {
        setNewFolder('')
        setShowNewFolder(false)
        navigateTo(currentPath)
      }
    } catch {}
  }, [newFolder, currentPath, navigateTo])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (showNewFolder && newFolderRef.current) newFolderRef.current.focus()
  }, [showNewFolder])

  const filtered = search
    ? entries.filter(e => e.toLowerCase().includes(search.toLowerCase()))
    : entries

  const displayPath = (p) => {
    if (!p) return ''
    for (const root of roots) {
      if (p === root) return '~'
      if (p.startsWith(root + '/')) return '~/' + p.slice(root.length + 1)
    }
    return p
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--bg-mask)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[480px] rounded-lg overflow-hidden flex flex-col"
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
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Choose a working directory</p>
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

        {/* Root selector or breadcrumb */}
        {!currentPath ? (
          <div className="px-5 pb-3">
            <label className="block text-[11px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Root Directory
            </label>
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {roots.map(dir => (
                <button
                  key={dir}
                  onClick={() => navigateTo(dir)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] text-left transition-colors hover-bg-spotlight"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  <FolderOpen size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span className="truncate">{displayPath(dir)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Breadcrumb + back */}
            <div className="px-5 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={goUp}
                  className="p-1 rounded transition-colors hover-bg-spotlight-text"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <ArrowLeft size={14} />
                </button>
                <div
                  className="flex-1 text-[12px] truncate px-2 py-1 rounded"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)', fontFamily: 'var(--font-mono)' }}
                  title={currentPath}
                >
                  {displayPath(currentPath)}
                </div>
                <button
                  onClick={() => { setShowNewFolder(!showNewFolder); setNewFolder('') }}
                  className="p-1 rounded transition-colors hover-primary-accent"
                  style={{ color: showNewFolder ? 'var(--primary)' : 'var(--text-tertiary)' }}
                  title="New folder"
                >
                  <FolderPlus size={14} />
                </button>
              </div>
            </div>

            {/* New folder input */}
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

            {/* Search */}
            <div className="px-5 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter directories..."
                  className="w-full rounded-md pl-8 pr-3 py-1.5 text-[12px] focus:outline-none focus-ring"
                  style={{
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </div>

            {/* Directory list */}
            <div className="px-5 pb-3 flex-1 overflow-y-auto" style={{ maxHeight: '240px' }}>
              {loading ? (
                <div className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {search ? 'No matching directories' : 'Empty directory'}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {filtered.map(name => {
                    const fullPath = currentPath.replace(/\/$/, '') + '/' + name
                    return (
                      <button
                        key={name}
                        onClick={() => navigateTo(fullPath)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] text-left transition-colors hover-bg-spotlight"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                      >
                        <FolderOpen size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span className="truncate flex-1">{name}</span>
                        <ChevronRight size={12} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center gap-2 px-5 py-4" style={{ background: 'var(--bg-container)', borderTop: '1px solid var(--border-secondary)' }}>
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {currentPath ? displayPath(currentPath) : 'Select a root'}
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
              onClick={() => currentPath && onStart(currentPath)}
              disabled={!currentPath}
              className={`px-5 py-2 text-[12px] font-medium rounded-lg transition-colors duration-200${currentPath ? ' hover-btn-primary' : ''}`}
              style={{
                background: currentPath ? 'var(--primary)' : 'var(--bg-spotlight)',
                color: currentPath ? 'var(--text-inverse)' : 'var(--text-quaternary)',
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
