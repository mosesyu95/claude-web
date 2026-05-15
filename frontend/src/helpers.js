export function shortProject(path) {
  if (!path) return ''
  const parts = path.split('/').filter(Boolean)
  return parts.slice(-2).join('/')
}

export function getToolIcon(name) {
  const map = {
    Bash: '>', Read: '📄', Write: '✏️', Edit: '✏️',
    Grep: '🔍', Agent: '🤖', WebSearch: '🌐', WebFetch: '📡',
    Glob: '📁', LS: '📂', TodoRead: '📋', TodoWrite: '📋',
    NotebookEdit: '📓', Skill: '⚡',
  }
  return map[name] || '🔧'
}

export function fileIcon(name, type) {
  if (type === 'dir') return '📁'
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    js: '📜', jsx: '⚛️', ts: '📜', tsx: '⚛️', json: '📋',
    md: '📝', css: '🎨', html: '🌐', py: '🐍', go: '🔵',
    rs: '🦀', rb: '💎', sh: '🖥️', yml: '⚙️', yaml: '⚙️',
    svg: '🖼️', png: '🖼️', jpg: '🖼️', git: '📂',
  }
  return map[ext] || '📄'
}

export function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function timeAgo(date) {
  if (!date) return ''
  const now = Date.now()
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function escapeAttr(str) {
  if (!str) return ''
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
