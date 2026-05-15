const BASE = '/api'

export const sessions = {
  directories: () => fetch(`${BASE}/sessions/directories`).then(r => r.json()),
  projects: () => fetch(`${BASE}/sessions/projects`).then(r => r.json()),
  projectSessions: (dirName) => fetch(`${BASE}/sessions/projects/${dirName}`).then(r => r.json()),
  findRecent: (dir, afterMs) => fetch(`${BASE}/sessions/find-recent?dir=${encodeURIComponent(dir)}&afterMs=${afterMs}`).then(r => r.json()),
  activeList: () => fetch(`${BASE}/sessions/active/list`).then(r => r.json()),
  conversation: (id) => fetch(`${BASE}/sessions/${id}/conversation`).then(r => r.json()),
}

export const git = {
  status: (dir) => fetch(`${BASE}/git/status?dir=${encodeURIComponent(dir)}`).then(r => r.json()),
  log: (dir) => fetch(`${BASE}/git/log?dir=${encodeURIComponent(dir)}`).then(r => r.json()),
  diff: (dir, file, staged, commit) => {
    const params = new URLSearchParams({ dir })
    if (file) params.set('file', file)
    if (staged) params.set('staged', 'true')
    if (commit) params.set('commit', commit)
    return fetch(`${BASE}/git/diff?${params}`).then(r => r.json())
  },
  branches: (dir) => fetch(`${BASE}/git/branches?dir=${encodeURIComponent(dir)}`).then(r => r.json()),
}

export const files = {
  list: (dir) => fetch(`${BASE}/files/list?dir=${encodeURIComponent(dir)}`).then(r => r.json()),
  read: (path) => fetch(`${BASE}/files/read?path=${encodeURIComponent(path)}`).then(r => r.json()),
}

export function createWebSocket(params) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const qs = new URLSearchParams(params).toString()
  return new WebSocket(`${proto}//${location.host}?${qs}`)
}
