import { useState, useEffect, useCallback } from 'react'
import { files as filesApi } from '../../api'
import { fileIcon, formatSize, timeAgo } from '../../helpers'
import { FolderOpen, ChevronRight, ArrowLeft, X, File } from 'lucide-react'

export default function FilesPanel({ cwd }) {
  const [rootDir, setRootDir] = useState(null)
  const [dir, setDir] = useState(null)
  const [listing, setListing] = useState(null)
  const [fileView, setFileView] = useState(null)
  const [loading, setLoading] = useState(false)
  const currentDir = dir || rootDir || '.'

  const loadDir = useCallback(async (d, root) => {
    const r = root || rootDir
    if (!r) return
    setLoading(true)
    try {
      const data = await filesApi.list(d, r)
      setListing(data)
      setDir(d)
    } catch {}
    setLoading(false)
  }, [rootDir])

  useEffect(() => {
    const d = cwd || window._homeDir
    if (d && !rootDir) {
      setRootDir(d)
      loadDir(d, d)
    }
  }, [cwd, rootDir, loadDir])

  const openFile = async (path) => {
    if (!rootDir) return
    try {
      const data = await filesApi.read(path, rootDir)
      setFileView(data)
    } catch {}
  }

  const Breadcrumbs = () => {
    const rootParts = rootDir ? rootDir.split('/').filter(Boolean) : []
    const curParts = currentDir.split('/').filter(Boolean)
    const relParts = curParts.slice(rootParts.length)
    return (
      <div
        className="flex items-center gap-1 px-4 py-2 overflow-x-auto shrink-0"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-secondary)' }}
      >
        <button
          onClick={() => rootDir && loadDir(rootDir)}
          className="text-[12px] font-mono px-1.5 py-0.5 rounded transition-colors truncate max-w-[140px] hover-text-accent"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {rootParts[rootParts.length - 1] || '/'}
        </button>
        {relParts.map((part, i) => {
          const path = '/' + [...rootParts, ...relParts.slice(0, i + 1)].join('/')
          return (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10} style={{ color: 'var(--text-quaternary)' }} />
              <button
                onClick={() => loadDir(path)}
                className="text-[12px] font-mono px-1.5 py-0.5 rounded transition-colors truncate max-w-[120px] hover-text-primary"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {part}
              </button>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Breadcrumbs />

      {fileView ? (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div
            className="flex items-center justify-between px-4 py-2 shrink-0"
            style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-secondary)' }}
          >
            <div className="flex items-center gap-2">
              <File size={12} style={{ color: 'var(--text-quaternary)' }} />
              <span className="text-[12px] font-mono truncate" style={{ color: 'var(--text-primary)' }}>{rootDir && fileView.path.startsWith(rootDir) ? fileView.path.slice(rootDir.length + 1) : fileView.path}</span>
            </div>
            <button
              onClick={() => setFileView(null)}
              className="p-1 rounded-md transition-colors hover-bg-spotlight-text"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre
              className="text-[12px] whitespace-pre-wrap leading-relaxed rounded-lg p-4"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-spotlight)', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-secondary)' }}
            >
              {fileView.content}
            </pre>
            {fileView.truncated && (
              <div className="mt-2 text-[11px]" style={{ color: 'var(--status-warning)' }}>
                File truncated (too large)
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ animation: 'fadeIn 0.2s ease' }}>
          {listing?.parent && (
            <button
              onClick={() => loadDir(listing.parent)}
              className="w-full flex items-center gap-2 px-4 py-2 text-[12px] transition-colors duration-200 hover-bg-spotlight-text"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <ArrowLeft size={12} />
              <span>..</span>
            </button>
          )}
          {listing?.items?.map(item => (
            <button
              key={item.path}
              onClick={() => item.type === 'dir' ? loadDir(item.path) : openFile(item.path)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] transition-colors duration-200 text-left hover-bg-spotlight"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="shrink-0 text-[14px]">{fileIcon(item.name, item.type)}</span>
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              {item.type === 'file' && (
                <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--text-quaternary)' }}>{formatSize(item.size)}</span>
              )}
              <span className="text-[11px] shrink-0 w-16 text-right" style={{ color: 'var(--text-quaternary)' }}>{timeAgo(item.modified)}</span>
            </button>
          ))}
          {listing?.items?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-quaternary)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--bg-spotlight)' }}>
                <FolderOpen size={18} style={{ color: 'var(--text-quaternary)' }} />
              </div>
              <span className="text-[12px]">Empty directory</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
