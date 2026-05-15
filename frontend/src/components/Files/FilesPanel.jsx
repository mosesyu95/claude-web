import { useState, useEffect, useCallback } from 'react'
import { files as filesApi } from '../../api'
import { fileIcon, formatSize, timeAgo } from '../../helpers'
import { FolderOpen, ChevronRight, ArrowLeft, X } from 'lucide-react'

export default function FilesPanel({ cwd }) {
  const [dir, setDir] = useState(null)
  const [listing, setListing] = useState(null) // { items, parent }
  const [fileView, setFileView] = useState(null) // { content, path, truncated }
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
    if (cwd) loadDir(cwd)
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
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--cr-gray-8)] overflow-x-auto shrink-0">
        <button
          onClick={() => loadDir('/')}
          className="text-xs text-[var(--cr-gray-5)] hover:text-[var(--cr-gray-3)] transition-colors"
        >
          /
        </button>
        {parts.map((part, i) => {
          const path = '/' + parts.slice(0, i + 1).join('/')
          return (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10} className="text-[var(--cr-gray-6)]" />
              <button
                onClick={() => loadDir(path)}
                className="text-xs text-[var(--cr-gray-4)] hover:text-[var(--cr-gray-2)] transition-colors truncate max-w-[120px]"
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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--cr-gray-8)] shrink-0">
            <span className="text-xs font-mono text-[var(--cr-gray-3)] truncate">{fileView.path}</span>
            <button onClick={() => setFileView(null)} className="p-1 rounded hover:bg-[var(--cr-gray-8)] transition-colors">
              <X size={14} className="text-[var(--cr-gray-5)]" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs font-mono text-[var(--cr-gray-3)] whitespace-pre-wrap leading-relaxed">
              {fileView.content}
            </pre>
            {fileView.truncated && (
              <div className="mt-2 text-xs text-[var(--cr-warning)]">File truncated (too large)</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {listing?.parent && (
            <button
              onClick={() => loadDir(listing.parent)}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-[var(--cr-gray-4)] hover:bg-[var(--cr-gray-8)] transition-colors"
            >
              <ArrowLeft size={12} />
              <span>..</span>
            </button>
          )}
          {listing?.items?.map(item => (
            <button
              key={item.fullPath}
              onClick={() => item.type === 'dir' ? loadDir(item.fullPath) : openFile(item.fullPath)}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-[var(--cr-gray-8)] transition-colors text-left"
            >
              <span className="shrink-0">{fileIcon(item.name, item.type)}</span>
              <span className="flex-1 truncate text-[var(--cr-gray-3)]">{item.name}</span>
              {item.type === 'file' && (
                <span className="text-[var(--cr-gray-6)] shrink-0">{formatSize(item.size)}</span>
              )}
              <span className="text-[var(--cr-gray-6)] shrink-0 w-16 text-right">{timeAgo(item.modified)}</span>
            </button>
          ))}
          {listing?.items?.length === 0 && (
            <div className="flex items-center justify-center h-32 text-[var(--cr-gray-5)] text-xs">
              <FolderOpen size={20} className="mr-2 opacity-40" />
              Empty directory
            </div>
          )}
        </div>
      )}
    </div>
  )
}
