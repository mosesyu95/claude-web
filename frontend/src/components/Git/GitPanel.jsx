import { useState, useEffect, useCallback } from 'react'
import { git as gitApi } from '../../api'
import { timeAgo } from '../../helpers'
import { GitBranch, FileCode, ArrowLeft, Plus, Minus, Edit3 } from 'lucide-react'
import DiffViewer from './DiffViewer'

export default function GitPanel({ cwd }) {
  const [overview, setOverview] = useState(null) // { branch, ahead, behind, staged, unstaged, untracked, commits }
  const [loading, setLoading] = useState(false)
  const [diff, setDiff] = useState(null) // { files, title }
  const dir = cwd || window._homeDir || '.'

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, logRes] = await Promise.all([
        gitApi.status(dir),
        gitApi.log(dir),
      ])
      setOverview({
        branch: statusRes?.branch,
        ahead: statusRes?.ahead,
        behind: statusRes?.behind,
        staged: statusRes?.staged || [],
        unstaged: statusRes?.unstaged || [],
        untracked: statusRes?.untracked || [],
        commits: logRes?.commits || [],
      })
    } catch (e) {
      setOverview(null)
    }
    setLoading(false)
  }, [dir])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const showFileDiff = async (file, staged) => {
    try {
      const data = await gitApi.diff(dir, file, staged)
      setDiff({ files: data?.files || [], title: file })
    } catch {}
  }

  const showCommitDiff = async (commit) => {
    try {
      const data = await gitApi.diff(dir, null, false, commit)
      setDiff({ files: data?.files || [], title: commit?.slice(0, 8) })
    } catch {}
  }

  if (loading && !overview) {
    return <div className="flex items-center justify-center h-full text-[var(--cr-gray-5)] text-sm">Loading git info...</div>
  }

  if (!overview) {
    return <div className="flex items-center justify-center h-full text-[var(--cr-gray-5)] text-sm">No git repository found</div>
  }

  if (diff) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--cr-gray-8)] shrink-0">
          <button onClick={() => setDiff(null)} className="p-1 rounded hover:bg-[var(--cr-gray-8)] transition-colors">
            <ArrowLeft size={16} className="text-[var(--cr-gray-4)]" />
          </button>
          <span className="text-sm font-medium text-[var(--cr-gray-2)] truncate">{diff.title}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DiffViewer files={diff.files} />
        </div>
      </div>
    )
  }

  const FileItem = ({ file, staged, onClick }) => {
    const statusColors = { M: 'text-[var(--cr-warning)]', A: 'text-[var(--cr-success)]', D: 'text-[var(--cr-error)]', R: 'text-[var(--cr-info)]', '?': 'text-[var(--cr-gray-5)]' }
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--cr-gray-8)] transition-colors text-left"
      >
        <span className={statusColors[file.status] || 'text-[var(--cr-gray-4)]'}>{file.status}</span>
        <span className="text-[var(--cr-gray-3)] truncate">{file.path}</span>
      </button>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Branch bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--cr-gray-8)]">
        <GitBranch size={14} className="text-[var(--cr-brand-5)]" />
        <span className="px-2 py-0.5 rounded bg-[var(--cr-brand-6)]/15 text-[var(--cr-brand-4)] text-xs font-mono">
          {overview.branch}
        </span>
        {overview.ahead > 0 && <span className="text-[10px] text-[var(--cr-success)]">↑{overview.ahead}</span>}
        {overview.behind > 0 && <span className="text-[10px] text-[var(--cr-error)]">↓{overview.behind}</span>}
      </div>

      {/* Staged files */}
      {overview.staged.length > 0 && (
        <Section title="Staged" count={overview.staged.length} color="success">
          {overview.staged.map(f => <FileItem key={f.path} file={f} staged onClick={() => showFileDiff(f.path, true)} />)}
        </Section>
      )}

      {/* Unstaged files */}
      {overview.unstaged.length > 0 && (
        <Section title="Changes" count={overview.unstaged.length} color="warning">
          {overview.unstaged.map(f => <FileItem key={f.path} file={f} onClick={() => showFileDiff(f.path, false)} />)}
        </Section>
      )}

      {/* Untracked files */}
      {overview.untracked.length > 0 && (
        <Section title="Untracked" count={overview.untracked.length} color="info">
          {overview.untracked.map(f => <FileItem key={f.path} file={f} />)}
        </Section>
      )}

      {/* Commits */}
      {overview.commits.length > 0 && (
        <Section title="Recent Commits" count={overview.commits.length}>
          {overview.commits.map(c => (
            <button
              key={c.hash}
              onClick={() => showCommitDiff(c.hash)}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--cr-gray-8)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--cr-warning)]">{c.shortHash}</span>
                <span className="text-xs text-[var(--cr-gray-3)] truncate flex-1">{c.message}</span>
              </div>
              <div className="text-[10px] text-[var(--cr-gray-6)] mt-0.5">{c.author} · {timeAgo(c.date)}</div>
            </button>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, color, children }) {
  const colorMap = {
    success: 'text-[var(--cr-success)]',
    warning: 'text-[var(--cr-warning)]',
    info: 'text-[var(--cr-info)]',
  }
  return (
    <div className="border-b border-[var(--cr-gray-8)]">
      <div className="px-4 py-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-[var(--cr-gray-3)] uppercase tracking-wider">{title}</h3>
        <span className={`text-[10px] font-mono ${colorMap[color] || 'text-[var(--cr-gray-5)]'}`}>{count}</span>
      </div>
      <div className="pb-1">{children}</div>
    </div>
  )
}
