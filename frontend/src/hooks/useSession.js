import { useState, useCallback, useRef } from 'react'
import { sessions as sessionsApi } from '../api'
import { useToast } from '../components/common/Toast'

export function useSession(wsHook, chat, rawTermRef) {
  const { showToast } = useToast()
  const [session, setSession] = useState(null)
  const [activeSessions, setActiveSessions] = useState(new Map())

  const addLocal = useCallback((id, data) => {
    setActiveSessions(prev => {
      const next = new Map(prev)
      next.set(id, { ...data, local: true })
      return next
    })
  }, [])

  const discover = useCallback((cwd, sessionId) => {
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      if (attempts > 10) { clearInterval(timer); return }
      try {
        const data = await sessionsApi.findRecent(cwd, Date.now() - 30000)
        if (data?.sessionId) {
          clearInterval(timer)
          setSession(prev => prev ? { ...prev, sessionId: data.sessionId } : prev)
          chat.startPoll(data.sessionId)
        }
      } catch {
        if (attempts >= 10) showToast('Failed to discover session', 'error')
      }
    }, 2000)
  }, [chat])

  const startNew = useCallback((cwd) => {
    chat.clearMessages()

    const ws = wsHook.connect(
      { action: 'new', cwd },
      {
        onMessage: (msg) => {
          if (msg.type === 'session-started') {
            const info = { sessionId: msg.sessionId, cwd, title: 'New Session' }
            setSession(info)
            addLocal(msg.sessionId, info)
            discover(cwd, msg.sessionId)
          } else if (msg.type === 'session-timeout') {
            chat.setStatus('idle')
          } else if (msg.type === 'pty-exit') {
            chat.setStatus('idle')
            chat.stopPoll()
          }
        },
        onOpen: () => {
          rawTermRef.current?.connectWs(ws)
        },
      }
    )
  }, [wsHook, chat, addLocal, discover, rawTermRef])

  const resume = useCallback((sessionId, cwd, title) => {
    chat.clearMessages()

    const ws = wsHook.connect(
      { action: 'resume', sessionId, cwd },
      {
        onMessage: (msg) => {
          if (msg.type === 'session-started') {
            setSession({ sessionId, cwd, title: title || 'Resumed Session' })
            addLocal(sessionId, { sessionId, cwd, title })
            chat.startPoll(sessionId)
          } else if (msg.type === 'session-timeout') {
            chat.setStatus('idle')
          } else if (msg.type === 'pty-exit') {
            chat.setStatus('idle')
            chat.stopPoll()
          }
        },
        onOpen: () => {
          rawTermRef.current?.connectWs(ws)
        },
      }
    )
  }, [wsHook, chat, addLocal, rawTermRef])

  const send = useCallback((text) => {
    if (!text.trim()) return
    wsHook.send({ type: 'pty-input', data: text + '\n' })
    chat.setStatus('busy')
    chat.addUserMessage(text)
  }, [wsHook, chat])

  const detach = useCallback(() => {
    wsHook.close()
    setSession(null)
    chat.clearMessages()
    chat.stopPoll()
    rawTermRef.current?.disconnect()
  }, [wsHook, chat, rawTermRef])

  const kill = useCallback(() => {
    wsHook.send({ type: 'pty-input', data: '\x03' })
    setTimeout(() => wsHook.send({ type: 'pty-input', data: '\x03' }), 1000)
    setTimeout(() => {
      wsHook.close()
      setSession(null)
      chat.clearMessages()
      chat.stopPoll()
      rawTermRef.current?.disconnect()
    }, 2000)
  }, [wsHook, chat, rawTermRef])

  return {
    session,
    activeSessions,
    startNew,
    resume,
    send,
    detach,
    kill,
  }
}
