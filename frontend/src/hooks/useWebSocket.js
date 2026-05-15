import { useRef, useCallback, useEffect } from 'react'
import { createWebSocket } from '../api'

export function useWebSocket() {
  const wsRef = useRef(null)
  const handlersRef = useRef({})

  const connect = useCallback((params, handlers = {}) => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    handlersRef.current = handlers
    const ws = createWebSocket(params)
    wsRef.current = ws

    ws.onopen = () => handlers.onOpen?.()
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        handlers.onMessage?.(msg)
      } catch {
        handlers.onData?.(e.data)
      }
    }
    ws.onclose = (e) => handlers.onClose?.(e)
    ws.onerror = (e) => handlers.onError?.(e)

    return ws
  }, [])

  const send = useCallback((data) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  const close = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  useEffect(() => () => close(), [close])

  return { connect, send, close, wsRef }
}
