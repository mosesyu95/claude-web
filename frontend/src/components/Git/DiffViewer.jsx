import { FileCode } from 'lucide-react'

export default function DiffViewer({ files }) {
  if (!files?.length) return <div className="p-4 text-sm text-[var(--cr-gray-5)]">No changes</div>

  return (
    <div className="p-4 space-y-4">
      {files.map((file, fi) => (
        <div key={fi} className="rounded-lg border border-[var(--cr-gray-8)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--cr-gray-9)] border-b border-[var(--cr-gray-8)]">
            <FileCode size={12} className="text-[var(--cr-gray-5)]" />
            <span className="text-xs font-mono text-[var(--cr-gray-3)] truncate">{file.path}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[10px]">
              <span className="text-[var(--cr-success)]">+{file.additions}</span>
              <span className="text-[var(--cr-error)]">-{file.deletions}</span>
            </span>
          </div>
          {file.hunks?.map((hunk, hi) => (
            <div key={hi}>
              <div className="px-3 py-1 bg-[var(--cr-gray-9)]/50 text-[10px] text-[var(--cr-gray-5)] font-mono border-b border-[var(--cr-gray-8)]">
                {hunk.header}
              </div>
              {hunk.lines?.map((line, li) => {
                const isAdd = line.type === 'add'
                const isDel = line.type === 'del'
                return (
                  <div key={li} className={`flex ${isAdd ? 'diff-line-add' : isDel ? 'diff-line-del' : ''}`}>
                    <span className="diff-line-num w-10 text-right pr-2 text-[10px] text-[var(--cr-gray-6)] font-mono select-none shrink-0 bg-[var(--cr-gray-9)]/30">
                      {line.oldNum || ''}
                    </span>
                    <span className="diff-line-num w-10 text-right pr-2 text-[10px] text-[var(--cr-gray-6)] font-mono select-none shrink-0 bg-[var(--cr-gray-9)]/30">
                      {line.newNum || ''}
                    </span>
                    <span className="flex-1 px-2 text-[11px] font-mono whitespace-pre overflow-x-auto">
                      {isAdd && <span className="text-[var(--cr-success)]">+</span>}
                      {isDel && <span className="text-[var(--cr-error)]">-</span>}
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
