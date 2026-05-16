import { FileCode } from 'lucide-react'

export default function DiffViewer({ files }) {
  if (!files?.length) {
    return (
      <div className="flex items-center justify-center h-32 text-[13px]" style={{ color: 'var(--text-quaternary)' }}>
        No changes
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4" style={{ animation: 'fadeIn 0.3s ease' }}>
      {files.map((file, fi) => (
        <div
          key={fi}
          className="rounded-lg overflow-hidden"
          style={{ background: 'var(--bg-spotlight)', border: '1px solid var(--border-secondary)' }}
        >
          <div
            className="flex items-center gap-2 px-3.5 py-2"
            style={{ background: 'var(--bg-container)', borderBottom: '1px solid var(--border-secondary)' }}
          >
            <FileCode size={12} style={{ color: 'var(--text-quaternary)' }} />
            <span className="text-[12px] font-mono truncate" style={{ color: 'var(--text-primary)' }}>{file.path}</span>
            <span className="ml-auto flex items-center gap-2 text-[11px] font-mono">
              <span style={{ color: 'var(--status-success)' }}>+{file.additions}</span>
              <span style={{ color: 'var(--status-error)' }}>-{file.deletions}</span>
            </span>
          </div>
          {file.hunks?.map((hunk, hi) => (
            <div key={hi}>
              <div
                className="px-3.5 py-1.5 text-[10px] font-mono"
                style={{ color: 'var(--text-quaternary)', background: 'var(--bg-container)', borderBottom: '1px solid var(--border-secondary)' }}
              >
                {hunk.header}
              </div>
              {hunk.lines?.map((line, li) => {
                const isAdd = line.type === 'add'
                const isDel = line.type === 'del'
                return (
                  <div key={li} className={`flex ${isAdd ? 'diff-line-add' : isDel ? 'diff-line-del' : ''}`}>
                    <span
                      className="diff-line-num w-10 text-right pr-2 text-[10px] font-mono select-none shrink-0"
                      style={{ color: 'var(--text-quaternary)', background: 'var(--bg-container)' }}
                    >
                      {line.oldNum || ''}
                    </span>
                    <span
                      className="diff-line-num w-10 text-right pr-2 text-[10px] font-mono select-none shrink-0"
                      style={{ color: 'var(--text-quaternary)', background: 'var(--bg-container)' }}
                    >
                      {line.newNum || ''}
                    </span>
                    <span className="flex-1 px-2 text-[11px] font-mono whitespace-pre overflow-x-auto">
                      {isAdd && <span style={{ color: 'var(--status-success)' }}>+</span>}
                      {isDel && <span style={{ color: 'var(--status-error)' }}>-</span>}
                      {!isAdd && !isDel && <span className="text-transparent"> </span>}
                      {line.content}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
