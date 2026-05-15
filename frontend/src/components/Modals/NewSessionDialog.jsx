import { useState, useEffect } from 'react'
import { sessions as sessionsApi } from '../../api'
import { X, FolderOpen, Sparkles } from 'lucide-react'

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
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-2xl overflow-hidden"
        style={{
          background: 'var(--obsidian-1)',
          border: '1px solid var(--obsidian-4)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px var(--obsidian-4)',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="relative px-5 pt-5 pb-4">
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, var(--amber-6), var(--amber-4), var(--amber-6))', backgroundSize: '200% 100%', animation: 'gradientShift 6s ease infinite' }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--amber-7), var(--amber-5))', boxShadow: '0 2px 8px var(--glow-amber-strong)' }}
              >
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>New Session</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Choose a working directory</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Directory selector */}
        <div className="px-5 pb-4">
          <label className="block text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>
            Working Directory
          </label>
          <div className="relative">
            <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-ghost)' }} />
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full rounded-xl py-2.5 pl-9 pr-3 text-[13px] focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
              style={{
                background: 'var(--obsidian-2)',
                color: 'var(--text-primary)',
                border: '1px solid var(--obsidian-4)',
                fontFamily: 'var(--font-mono)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--amber-6)'; e.target.style.boxShadow = '0 0 0 3px var(--glow-amber)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--obsidian-4)'; e.target.style.boxShadow = 'none' }}
            >
              {directories.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-4" style={{ background: 'var(--obsidian-2)', borderTop: '1px solid var(--obsidian-4)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium rounded-xl transition-all duration-200"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onStart(selected)}
            disabled={!selected}
            className="px-5 py-2 text-[12px] font-semibold rounded-xl transition-all duration-300"
            style={{
              background: selected ? 'linear-gradient(135deg, var(--amber-7), var(--amber-5))' : 'var(--obsidian-4)',
              color: selected ? 'white' : 'var(--text-ghost)',
              boxShadow: selected ? '0 2px 12px var(--glow-amber-strong)' : 'none',
            }}
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  )
}
