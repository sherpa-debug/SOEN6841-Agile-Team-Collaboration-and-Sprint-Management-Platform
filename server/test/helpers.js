// Shared fakes for the sync tests: a GitHub that serves a repository we control, and the
// seeded team the tests run on.
import { createMemoryStore } from '../src/sync/memory-store.js'

export const TEAM = { id: 1, repo: 'sherpa-debug/sprintproof' }
export const TASKS = { 'SP-1': 101, 'SP-2': 102, 'SP-3': 103, 'SP-4': 104, 'SP-5': 105 }
export const MEMBERS = [
  { id: 11, login: 'ming-dev', email: 'ming@example.test' },
  { id: 12, login: 'Moncef-BHFN', email: null },
  { id: 13, login: 'sherpa-debug', email: null },
  { id: 14, login: 'tanzir-h', email: 'tanzir@example.test' },
]

export const seededStore = (overrides = {}) =>
  createMemoryStore({ teams: [TEAM], tasks: { [TEAM.id]: { ...TASKS } }, members: { [TEAM.id]: MEMBERS }, ...overrides })

export const commit = (sha, message, { login = 'ming-dev', email = null, at = '2026-11-15T12:00:00Z' } = {}) => ({
  sha,
  message,
  authorLogin: login,
  authorEmail: email,
  committedAt: at,
})

// A fake GitHub. Change `repo.commits`, `repo.pulls` and `repo.pullCommits` between syncs to
// play "someone pushed while the sync was stopped".
export function fakeGitHub({ commits = [], pulls = [], pullCommits = {} } = {}) {
  const repo = { commits, pulls, pullCommits, etag: 'v1', failWith: null }
  const calls = { listCommits: [], listPulls: [], listPullCommits: [] }
  const api = {
    async listCommits(name, { since = null } = {}) {
      calls.listCommits.push({ name, since })
      if (repo.failWith) throw repo.failWith
      const items = repo.commits.filter((c) => !since || new Date(c.committedAt) >= since)
      return { notModified: false, items, etag: null }
    },
    async listPulls(name, { etag = null } = {}) {
      calls.listPulls.push({ name, etag })
      if (repo.failWith) throw repo.failWith
      if (etag && etag === repo.etag) return { notModified: true, items: [], etag }
      return { notModified: false, items: repo.pulls, etag: repo.etag }
    },
    async listPullCommits(name, number) {
      calls.listPullCommits.push({ name, number })
      return repo.pullCommits[number] ?? []
    },
  }
  return { api, repo, calls }
}
