import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { createWebSocket } from '../../api'
import '@xterm/xterm/css/xterm.css'

const darkTheme = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#7c3aed',
  selectionBackground: '#7c3aed40',
}

const lightTheme = {
  background: '#fafafa',
  foreground: '#18181b',
  cursor: '#7c3aed',
  selectionBackground: '#7c3aed30',
}

export default function BashTerminal({ cwd, theme, active }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!active || initialized || !containerRef.current) return

    const term = new Terminal({
      theme: theme === 'dark' ? darkTheme : lightTheme,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    // Delay fit to ensure container is visible
    setTimeout(() => {
      try { fit.fit() } catch {}

      const dir = cwd || window._homeDir || '.'
      const ws = createWebSocket({ action: 'bash', cwd: dir })
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'pty-data') {
            term.write(msg.data)
            return
          }
          if (msg.type === 'pty-exit') {
            term.write('\r\n[Process exited]')
            return
          }
        } catch {}
      }

      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pty-input', data }))
        }
      })
    }, 50)

    termRef.current = term
    fitRef.current = fit
    setInitialized(true)

    const observer = new ResizeObserver(() => {
      try { fit.fit() } catch {}
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      wsRef.current?.close()
      term.dispose()
      termRef.current = null
      wsRef.current = null
      setInitialized(false)
    }
  }, [active, cwd])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme
    }
  }, [theme])

  return (
    <div ref={containerRef} className="h-full w-full bg-[var(--cr-gray-12)]" />
  )
}
