import { useState, useEffect } from 'react'
import { sessions as sessionsApi } from '../../api'
import { X, FolderOpen, Plus } from 'lucide-react'

export default function NewSessionDialog({ onStart, onClose }) {
  const [directories, setDirectories] = useState([])
  const [selected, setSelected] = useState('')

  useEffect(() => {
    sessionsApi.directories().then(data => {
      const dirs = data?.directories || []
      setDirectories(dirs)
      const home = window._homeDir || dirs[0]
      setSelected(home || '')
    })
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--bg-mask)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg overflow-hidden"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
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
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-spotlight)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Directory selector */}
        <div className="px-5 pb-4">
          <label className="block text-[11px] font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Working Directory
          </label>
          <div className="relative">
            <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full rounded-lg py-2.5 pl-9 pr-3 text-[13px] focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 2px var(--primary-bg)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
            >
              {directories.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-4" style={{ background: 'var(--bg-container)', borderTop: '1px solid var(--border-secondary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium rounded-lg transition-colors duration-200"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onStart(selected)}
            disabled={!selected}
            className="px-5 py-2 text-[12px] font-medium rounded-lg transition-colors duration-200"
            style={{
              background: selected ? 'var(--primary)' : 'var(--bg-spotlight)',
              color: selected ? 'var(--text-inverse)' : 'var(--text-quaternary)',
              border: 'none',
            }}
            onMouseEnter={e => { if (selected) e.currentTarget.style.background = 'var(--primary-hover)' }}
            onMouseLeave={e => { if (selected) e.currentTarget.style.background = 'var(--primary)' }}
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  )
}
