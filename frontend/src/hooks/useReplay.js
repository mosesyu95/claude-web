import { useState, useCallback } from 'react'
import { sessions as sessionsApi } from '../api'

export function useReplay(onResume) {
  const [replay, setReplay] = useState(null)

  const openReplay = useCallback(async (sessionId, projectDir, cwd, title) => {
    try {
      const data = await sessionsApi.conversation(sessionId)
      setReplay({ sessionId, projectDir, cwd, title, turns: data?.turns || [] })
    } catch {}
  }, [])

  const closeReplay = useCallback(() => setReplay(null), [])

  const resumeFromReplay = useCallback(() => {
    if (!replay) return
    onResume(replay.sessionId, replay.cwd, replay.title)
    setReplay(null)
  }, [replay, onResume])

  return { replay, openReplay, closeReplay, resumeFromReplay }
}
