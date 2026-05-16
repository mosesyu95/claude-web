import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
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

const RawTerminal = forwardRef(function RawTerminal({ theme }, ref) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

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

    const fitOnce = () => {
      try { fit.fit() } catch {}
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }
    setTimeout(fitOnce, 50)

    termRef.current = term
    fitRef.current = fit

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

  const bg = theme === 'dark' ? darkTheme.background : lightTheme.background

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: bg }}
    />
  )
})

export default RawTerminal
