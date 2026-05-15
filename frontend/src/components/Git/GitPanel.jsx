import { useState, useEffect, useCallback } from 'react'
import { git as gitApi } from '../../api'
import { timeAgo } from '../../helpers'
import { GitBranch, ArrowLeft, FileCode, Plus, Minus, CircleDot } from 'lucide-react'
import DiffViewer from './DiffViewer'

export default function GitPanel({ cwd }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [diff, setDiff] = useState(null)
  const dir = cwd || window._homeDir || '.'

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, logRes] = await Promise.all([
        gitApi.status(dir),
        gitApi.log(dir),
      ])
      const branchObj = statusRes?.branch || {}
      setOverview({
        branchName: branchObj.name || '',
        ahead: branchObj.ahead || 0,
        behind: branchObj.behind || 0,
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

  useEffect(() => { loadOverview() }, [loadOverview])

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
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-ghost)' }}>
        <div className="text-[13px] font-medium">Loading git info...</div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-ghost)' }}>
        <GitBranch size={24} className="mb-2 opacity-30" />
        <span className="text-[13px] font-medium">No git repository found</span>
      </div>
    )
  }

  if (diff) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}
        >
          <button
            onClick={() => setDiff(null)}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--obsidian-4)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <ArrowLeft size={14} />
          </button>
          <FileCode size={13} style={{ color: 'var(--text-ghost)' }} />
          <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{diff.title}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DiffViewer files={diff.files} />
        </div>
      </div>
    )
  }

  const statusColors = {
    M: 'var(--status-warning)',
    A: 'var(--status-success)',
    D: 'var(--status-error)',
    R: 'var(--status-info)',
    '?': 'var(--text-ghost)',
  }

  return (
    <div className="h-full overflow-y-auto" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Branch bar */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: 'var(--obsidian-1)', borderBottom: '1px solid var(--obsidian-4)' }}
      >
        <GitBranch size={14} style={{ color: 'var(--amber-5)' }} />
        <span
          className="px-2.5 py-1 rounded-lg text-[12px] font-mono font-medium"
          style={{ color: 'var(--amber-4)', background: 'var(--glow-amber)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          {overview.branchName}
        </span>
        {overview.ahead > 0 && (
          <span className="text-[11px] font-mono flex items-center gap-0.5" style={{ color: 'var(--status-success)' }}>
            <Plus size={10} />{overview.ahead}
          </span>
        )}
        {overview.behind > 0 && (
          <span className="text-[11px] font-mono flex items-center gap-0.5" style={{ color: 'var(--status-error)' }}>
            <Minus size={10} />{overview.behind}
          </span>
        )}
      </div>

      {/* Staged */}
      {overview.staged.length > 0 && (
        <Section title="Staged" count={overview.staged.length} color="var(--status-success)">
          {overview.staged.map(f => (
            <FileRow key={f.path} file={f} color={statusColors[f.status]} onClick={() => showFileDiff(f.path, true)} />
          ))}
        </Section>
      )}

      {/* Unstaged */}
      {overview.unstaged.length > 0 && (
        <Section title="Changes" count={overview.unstaged.length} color="var(--status-warning)">
          {overview.unstaged.map(f => (
            <FileRow key={f.path} file={f} color={statusColors[f.status]} onClick={() => showFileDiff(f.path, false)} />
          ))}
        </Section>
      )}

      {/* Untracked */}
      {overview.untracked.length > 0 && (
        <Section title="Untracked" count={overview.untracked.length} color="var(--text-ghost)">
          {overview.untracked.map(f => (
            <FileRow key={f.path} file={f} color={statusColors[f.status]} />
          ))}
        </Section>
      )}

      {/* Commits */}
      {overview.commits.length > 0 && (
        <Section title="Recent Commits" count={overview.commits.length} color="var(--text-tertiary)">
          {overview.commits.map(c => (
            <button
              key={c.hash}
              onClick={() => showCommitDiff(c.hash)}
              className="w-full text-left px-4 py-2.5 transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--obsidian-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-mono font-medium shrink-0" style={{ color: 'var(--amber-4)' }}>{c.shortHash}</span>
                <span className="text-[12px] truncate flex-1" style={{ color: 'var(--text-primary)' }}>{c.message}</span>
              </div>
              <div className="text-[10px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-ghost)' }}>
                <span>{c.author}</span>
                <CircleDot size={8} />
                <span>{timeAgo(c.date)}</span>
              </div>
            </button>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, color, children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--obsidian-4)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-tertiary)' }}>{title}</h3>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
          style={{ color, background: 'var(--obsidian-3)' }}
        >
          {count}
        </span>
      </div>
      <div className="pb-1">{children}</div>
    </div>
  )
}

function FileRow({ file, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] transition-all duration-200 text-left"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--obsidian-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span className="font-mono font-bold w-4 text-center shrink-0" style={{ color }}>{file.status}</span>
      <span className="truncate">{file.path}</span>
    </button>
  )
}
