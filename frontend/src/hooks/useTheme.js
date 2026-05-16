import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('cw-theme') || 'auto'
  })

  const [effective, setEffective] = useState('dark')

  useEffect(() => {
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const update = () => setEffective(mq.matches ? 'dark' : 'light')
      update()
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    } else {
      setEffective(theme)
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', effective === 'dark')
    document.documentElement.setAttribute('data-theme', effective)
  }, [effective])

  useEffect(() => {
    localStorage.setItem('cw-theme', theme)
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme(t => {
      if (t === 'dark') return 'light'
      if (t === 'light') return 'auto'
      return 'dark'
    })
  }, [])

  return { theme, effective, cycleTheme }
}
