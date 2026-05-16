import { useState, useEffect, useCallback } from 'react'
import { files as filesApi } from '../../api'
import { fileIcon, formatSize, timeAgo } from '../../helpers'
import { FolderOpen, ChevronRight, ArrowLeft, X, File } from 'lucide-react'

export default function FilesPanel({ cwd }) {
  const [dir, setDir] = useState(null)
  const [listing, setListing] = useState(null)
  const [fileView, setFileView] = useState(null)
  const [loading, setLoading] = useState(false)
  const currentDir = dir || cwd || window._homeDir || '.'

  const loadDir = useCallback(async (d) => {
    setLoading(true)
    try {
      const data = await filesApi.list(d)
      setListing(data)
      setDir(d)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    const d = cwd || window._homeDir
    if (d && !dir) loadDir(d)
  }, [cwd, loadDir])

  const openFile = async (path) => {
    try {
      const data = await filesApi.read(path)
      setFileView(data)
    } catch {}
  }

  const Breadcrumbs = () => {
    const parts = currentDir.split('/').filter(Boolean)
    return (
      <div
        className="flex items-center gap-1 px-4 py-2.5 overflow-x-auto shrink-0"
        style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}
      >
        <button
          onClick={() => loadDir('/')}
          className="text-[12px] font-mono px-1.5 py-0.5 rounded transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--amber-5)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
        >
          /
        </button>
        {parts.map((part, i) => {
          const path = '/' + parts.slice(0, i + 1).join('/')
          return (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10} style={{ color: 'var(--obsidian-6)' }} />
              <button
                onClick={() => loadDir(path)}
                className="text-[12px] font-mono px-1.5 py-0.5 rounded transition-colors truncate max-w-[120px]"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
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
            style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}
          >
            <div className="flex items-center gap-2">
              <File size={12} style={{ color: 'var(--text-ghost)' }} />
              <span className="text-[12px] font-mono truncate" style={{ color: 'var(--text-primary)' }}>{fileView.path}</span>
            </div>
            <button
              onClick={() => setFileView(null)}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre
              className="text-[12px] whitespace-pre-wrap leading-relaxed rounded-xl p-4"
              style={{ color: 'var(--text-secondary)', background: 'var(--obsidian-2)', fontFamily: 'var(--font-mono)', border: '1px solid var(--obsidian-4)' }}
            >
              {fileView.content}
            </pre>
            {fileView.truncated && (
              <div className="mt-2 text-[11px] font-medium" style={{ color: 'var(--status-warning)' }}>
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
              className="w-full flex items-center gap-2 px-4 py-2 text-[12px] transition-all duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-2)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <ArrowLeft size={12} />
              <span>..</span>
            </button>
          )}
          {listing?.items?.map(item => (
            <button
              key={item.fullPath}
              onClick={() => item.type === 'dir' ? loadDir(item.fullPath) : openFile(item.fullPath)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] transition-all duration-200 text-left"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--obsidian-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="shrink-0 text-[14px]">{fileIcon(item.name, item.type)}</span>
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              {item.type === 'file' && (
                <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--text-ghost)' }}>{formatSize(item.size)}</span>
              )}
              <span className="text-[11px] shrink-0 w-16 text-right" style={{ color: 'var(--text-ghost)' }}>{timeAgo(item.modified)}</span>
            </button>
          ))}
          {listing?.items?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-ghost)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--obsidian-3)' }}>
                <FolderOpen size={18} style={{ color: 'var(--text-ghost)' }} />
              </div>
              <span className="text-[11px] font-medium">Empty directory</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
