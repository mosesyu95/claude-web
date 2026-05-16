import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const obsidianTheme = {
  background: '#08080a',
  foreground: '#e8e8ec',
  cursor: '#f59e0b',
  cursorAccent: '#08080a',
  selectionBackground: 'rgba(245, 158, 11, 0.2)',
  selectionForeground: '#e8e8ec',
  black: '#18181b',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#67e8f9',
  white: '#e8e8ec',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#a5f3fc',
  brightWhite: '#fafafa',
}

const lightTheme = {
  background: '#f8f8fa',
  foreground: '#1a1a1e',
  cursor: '#d97706',
  cursorAccent: '#f8f8fa',
  selectionBackground: 'rgba(217, 119, 6, 0.15)',
  black: '#1a1a1e',
  red: '#dc2626',
  green: '#059669',
  yellow: '#d97706',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#fafafa',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#10b981',
  brightYellow: '#f59e0b',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#ffffff',
}

const RawTerminal = forwardRef(function RawTerminal({ theme }, ref) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new Terminal({
      theme: theme === 'dark' ? obsidianTheme : lightTheme,
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      convertEol: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    // Fit after a short delay to ensure container has dimensions (may start hidden)
    const fitOnce = () => {
      try { fit.fit() } catch {}
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }
    setTimeout(fitOnce, 50)

    termRef.current = term
    fitRef.current = fit

    // Re-fit when container resizes (including becoming visible)
    const observer = new ResizeObserver(() => {
      if (containerRef.current?.offsetWidth > 0) fitOnce()
    })
    observer.observe(containerRef.current)

    term.onData(data => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'pty-input', data }))
      }
    })

    return () => {
      observer.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme === 'dark' ? obsidianTheme : lightTheme
    }
  }, [theme])

  useImperativeHandle(ref, () => ({
    connectWs(ws) {
      wsRef.current = ws
      const term = termRef.current
      if (!term) return

      const origOnMessage = ws.onmessage
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'pty-data') {
            term.write(msg.data)
            return
          }
        } catch {}
        origOnMessage?.(e)
      }

      setTimeout(() => {
        try { fitRef.current?.fit() } catch {}
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }, 100)
    },
    disconnect() {
      wsRef.current = null
      if (termRef.current) termRef.current.clear()
    },
  }))

  const bg = theme === 'dark' ? obsidianTheme.background : lightTheme.background

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: bg }}
    />
  )
})

export default RawTerminal
