import { useState, useCallback, useEffect, createContext, useContext } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

let _nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'error') => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const colors = {
    success: { bg: 'var(--status-success)', icon: '✓' },
    error: { bg: 'var(--status-error)', icon: '✗' },
    warning: { bg: 'var(--status-warning)', icon: '⚠' },
  }

  const c = colors[toast.type] || colors.error

  return (
    <div
      className="pointer-events-auto px-4 py-2.5 rounded-lg text-[13px] font-medium shadow-lg flex items-center gap-2 cursor-pointer"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${c.bg}`,
        color: 'var(--text-primary)',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }}
      onClick={() => onRemove(toast.id)}
    >
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] text-white shrink-0" style={{ background: c.bg }}>
        {c.icon}
      </span>
      <span>{toast.message}</span>
    </div>
  )
}
