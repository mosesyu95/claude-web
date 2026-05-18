import { createContext, useContext } from 'react'

const SessionContext = createContext(null)

export function useSessionContext() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSessionContext must be used within SessionProvider')
  return ctx
}

export default SessionContext
