export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="px-4 py-3 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)' }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--primary)',
                animation: 'typingBounce 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
