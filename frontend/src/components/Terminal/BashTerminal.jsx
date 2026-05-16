import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { createWebSocket } from '../../api'
import '@xterm/xterm/css/xterm.css'

const darkTheme = {
  background: '#141414',
  foreground: 'rgba(255,255,255,0.88)',
  cursor: '#1677ff',
  cursorAccent: '#141414',
  selectionBackground: 'rgba(22,119,255,0.2)',
  selectionForeground: '#ffffff',
  black: '#141414',
  red: '#ff4d4f',
  green: '#52c41a',
  yellow: '#faad14',
  blue: '#1677ff',
  magenta: '#9254de',
  cyan: '#13c2c2',
  white: 'rgba(255,255,255,0.88)',
  brightBlack: '#424242',
  brightRed: '#ff7875',
  brightGreen: '#95de64',
  brightYellow: '#ffc53d',
  brightBlue: '#4096ff',
  brightMagenta: '#b37feb',
  brightCyan: '#36cfc9',
  brightWhite: '#ffffff',
}

const lightTheme = {
  background: '#ffffff',
  foreground: 'rgba(0,0,0,0.88)',
  cursor: '#1677ff',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(22,119,255,0.15)',
  black: 'rgba(0,0,0,0.88)',
  red: '#ff4d4f',
  green: '#389e0d',
  yellow: '#d48806',
  blue: '#1677ff',
  magenta: '#722ed1',
  cyan: '#08979c',
  white: '#ffffff',
  brightBlack: '#8c8c8c',
  brightRed: '#ff7875',
  brightGreen: '#73d13d',
  brightYellow: '#ffc53d',
  brightBlue: '#4096ff',
  brightMagenta: '#b37feb',
  brightCyan: '#36cfc9',
  brightWhite: '#fafafa',
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
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      convertEol: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

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
          if (msg.type === 'pty-data') { term.write(msg.data); return }
          if (msg.type === 'pty-exit') { term.write('\r\n[Process exited]'); return }
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

  const bg = theme === 'dark' ? darkTheme.background : lightTheme.background

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: bg }}
    />
  )
}
