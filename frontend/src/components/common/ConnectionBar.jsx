export default function ConnectionBar({ wsState }) {
  if (wsState === 'idle' || wsState === 'connected') return null

  const isDisconnected = wsState === 'disconnected'

  return (
    <div className={`connection-bar ${isDisconnected ? 'connection-bar-disconnected' : 'connection-bar-reconnecting'}`} />
  )
}
