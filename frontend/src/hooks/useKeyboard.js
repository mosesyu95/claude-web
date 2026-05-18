import { useState, useEffect } from 'react'

const TAB_KEYS = ['chat', 'raw', 'git', 'files', 'bash']

export function useKeyboard() {
  const [activeTab, setActiveTab] = useState('chat')
  const [showNewSession, setShowNewSession] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar-collapsed', next) } catch {}
      return next
    })
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        setShowNewSession(true)
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key) - 1
        if (TAB_KEYS[idx]) {
          e.preventDefault()
          setActiveTab(TAB_KEYS[idx])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return {
    activeTab,
    setActiveTab,
    showNewSession,
    setShowNewSession,
    sidebarCollapsed,
    toggleSidebar,
  }
}
