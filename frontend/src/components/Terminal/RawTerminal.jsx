import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const darkTheme = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#7c3aed',
  selectionBackground: '#7c3aed40',
  black: '#18181b',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#f87171',
  brightGreen: '#34d399',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#fafafa',
}

const lightTheme = {
  background: '#fafafa',
  foreground: '#18181b',
  cursor: '#7c3aed',
  selectionBackground: '#7c3aed30',
  black: '#18181b',
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
      theme: theme === 'dark' ? darkTheme : lightTheme,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    const observer = new ResizeObserver(() => {
      try { fit.fit() } catch {}
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
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

  // Update theme
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme
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

  return (
    <div ref={containerRef} className="h-full w-full bg-[var(--cr-gray-12)]" />
  )
})

export default RawTerminal
