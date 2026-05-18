export default function TypingIndicator() {
  return (
    <div className="flex justify-start" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-container)' }}>
        <div className="flex gap-1">
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
        <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>thinking...</span>
      </div>
    </div>
  )
}
