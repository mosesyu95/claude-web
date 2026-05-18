export function Skeleton({ className = '', style }) {
  return (
    <div
      className={`rounded-md animate-pulse ${className}`}
      style={{ background: 'var(--bg-spotlight)', ...style }}
    />
  )
}

export function SkeletonLines({ count = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded"
          style={{ width: i === count - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SessionSkeleton() {
  return (
    <div className="px-2.5 py-2 flex items-center gap-2.5">
      <Skeleton className="w-[6px] h-[6px] rounded-full shrink-0" />
      <Skeleton className="h-3.5 flex-1 rounded" />
    </div>
  )
}

export function SessionGroupSkeleton() {
  return (
    <div className="mb-2 px-2">
      <Skeleton className="h-3 w-20 mb-2 rounded" />
      <SessionSkeleton />
      <SessionSkeleton />
    </div>
  )
}

export function FileRowSkeleton() {
  return (
    <div className="w-full flex items-center gap-2.5 px-4 py-2">
      <Skeleton className="w-4 h-3 rounded shrink-0" />
      <Skeleton className="h-3.5 flex-1 rounded" />
      <Skeleton className="w-10 h-3 rounded shrink-0" />
    </div>
  )
}

export function CommitRowSkeleton() {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-12 h-3 rounded shrink-0" />
        <Skeleton className="h-3.5 flex-1 rounded" />
      </div>
      <div className="mt-1">
        <Skeleton className="w-24 h-2.5 rounded" />
      </div>
    </div>
  )
}

export function GitSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
        <Skeleton className="w-14 h-5 rounded" />
      </div>
      <div className="py-2.5 px-4">
        <Skeleton className="h-3 w-16 mb-3 rounded" />
        <FileRowSkeleton />
        <FileRowSkeleton />
        <FileRowSkeleton />
      </div>
      <div className="py-2.5 px-4" style={{ borderTop: '1px solid var(--border-secondary)' }}>
        <Skeleton className="h-3 w-28 mb-3 rounded" />
        <CommitRowSkeleton />
        <CommitRowSkeleton />
        <CommitRowSkeleton />
      </div>
    </div>
  )
}

export function FilesSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }, (_, i) => (
        <FileRowSkeleton key={i} />
      ))}
    </div>
  )
}

export function ChatSkeleton() {
  return (
    <div className="max-w-[800px] mx-auto space-y-4 px-5 py-4">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-16 w-96 rounded-lg" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-20 w-80 rounded-lg" />
      </div>
    </div>
  )
}
