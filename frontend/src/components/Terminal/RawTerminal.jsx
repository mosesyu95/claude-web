import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { getTerminalTheme, getTerminalBg, terminalDefaults } from '../../helpers/terminal-theme'
import '@xterm/xterm/css/xterm.css'

const RawTerminal = forwardRef(function RawTerminal({ theme }, ref) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new Terminal({
      ...terminalDefaults,
      theme: getTerminalTheme(theme),
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
      termRef.current.options.theme = getTerminalTheme(theme)
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
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: getTerminalBg(theme) }}
    />
  )
})

export default RawTerminal
