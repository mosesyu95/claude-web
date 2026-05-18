import { useState, useRef, useCallback, useEffect } from 'react'
import { sessions as sessionsApi } from '../api'
import { useToast } from '../components/common/Toast'

export function useChat() {
  const { showToast } = useToast()
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle')
  const pollRef = useRef(null)
  const renderedRef = useRef(0)

  const addUserMessage = useCallback((text) => {
    setMessages(prev => [...prev, { role: 'user', parts: [{ type: 'text', text }] }])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    renderedRef.current = 0
    setStatus('idle')
  }, [])

  const startPoll = useCallback((sessionId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const data = await sessionsApi.conversation(sessionId)
        if (data?.turns && data.turns.length > renderedRef.current) {
          setMessages(data.turns)
          renderedRef.current = data.turns.length
        }
      } catch {
        showToast('Failed to load messages', 'error')
      }
    }, 3000)
  }, [])

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPoll(), [stopPoll])

  return {
    messages,
    status,
    setStatus,
    setMessages,
    addUserMessage,
    clearMessages,
    startPoll,
    stopPoll,
  }
}
