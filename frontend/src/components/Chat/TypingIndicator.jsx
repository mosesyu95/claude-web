export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="px-3 py-2 rounded-xl bg-[var(--cr-gray-9)] border border-[var(--cr-gray-8)]">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--cr-gray-5)]"
              style={{
                animation: 'typingBounce 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
