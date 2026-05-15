import { useState, useEffect } from 'react'
import { sessions as sessionsApi } from '../../api'
import { X } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[400px] rounded-xl bg-[var(--cr-gray-10)] border border-[var(--cr-gray-8)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cr-gray-8)]">
          <h2 className="text-sm font-semibold text-[var(--cr-gray-2)]">New Session</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--cr-gray-8)] transition-colors">
            <X size={14} className="text-[var(--cr-gray-5)]" />
          </button>
        </div>
        <div className="p-4">
          <label className="block text-xs text-[var(--cr-gray-5)] mb-1.5">Working Directory</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full rounded-lg bg-[var(--cr-gray-9)] border border-[var(--cr-gray-8)] px-3 py-2 text-sm text-[var(--cr-gray-2)] focus:outline-none focus:border-[var(--cr-brand-6)] transition-colors"
          >
            {directories.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--cr-gray-8)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg text-[var(--cr-gray-4)] hover:bg-[var(--cr-gray-8)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onStart(selected)}
            disabled={!selected}
            className="px-4 py-1.5 text-sm rounded-lg bg-[var(--cr-brand-6)] text-white hover:bg-[var(--cr-brand-7)] disabled:opacity-40 transition-colors"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
