// Proof of concept for SP-9 (D3, section V): how many of a repository's commits does the sync
// link to the right task, are the authors matched, and how long does it take?
//
//   Live, against GitHub (needs a read-only token in GITHUB_TOKEN):
//     node scripts/poc-sync.js --live owner/name --tasks SP-1,SP-2 --members login1,login2
//   Offline, from files saved with `gh api --paginate --slurp` (no token, no network):
//     node scripts/poc-sync.js --commits commits.json --pulls pulls.json --tasks SP-1,SP-2 --members login1
//
// --tasks is the list of task keys that exist (default SP-1 to SP-30). Nothing is written to a
// database: the run uses the in-memory store.
import { readFileSync } from 'node:fs'
import { createGitHubClient, normalizeCommit, normalizePull } from '../src/sync/github.js'
import { createMemoryStore } from '../src/sync/memory-store.js'
import { findKeys } from '../src/sync/linking.js'
import { syncTeam } from '../src/sync/sync.js'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []))
const flat = (path) => JSON.parse(readFileSync(path, 'utf8')).flat()

let github
let repo = args.live ?? 'offline/fixture'
if (args.live) {
  github = createGitHubClient({ token: process.env.GITHUB_TOKEN })
} else if (args.commits) {
  const commits = flat(args.commits).map(normalizeCommit)
  const pulls = args.pulls ? flat(args.pulls).map(normalizePull) : []
  github = {
    listCommits: async () => ({ notModified: false, items: commits, etag: null }),
    listPulls: async () => ({ notModified: false, items: pulls, etag: null }),
    listPullCommits: async () => [], // not available offline
  }
} else {
  console.error('Give --live owner/name, or --commits file.json [--pulls file.json].')
  process.exit(2)
}

const keys = (args.tasks ?? Array.from({ length: 30 }, (_, i) => `SP-${i + 1}`).join(',')).split(',')
const logins = (args.members ?? '').split(',').filter(Boolean)
const tasks = Object.fromEntries(keys.map((key, i) => [key, i + 1]))
const store = createMemoryStore({
  teams: [{ id: 1, repo }],
  tasks: { 1: tasks },
  members: { 1: logins.map((login, i) => ({ id: i + 1, login, email: null })) },
})

const result = await syncTeam({ store, github, team: { id: 1, repo } })
if (!result.ok) {
  console.error(`Sync failed: ${result.error}`)
  process.exit(1)
}

const commits = store.commits()
const withKey = commits.filter((c) => findKeys(c.message).length > 0)
const linked = commits.filter((c) => c.taskId !== null)
const share = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : 'n/a')

console.log(`Repository: ${repo}`)
console.log(`Commits fetched: ${commits.length}, pull requests: ${store.pulls().length}, time: ${result.durationMs} ms`)
console.log(`Linked to a task: ${linked.length} of ${commits.length} (${share(linked.length, commits.length)})`)
console.log(`Carrying a task key in the message: ${withKey.length} (${share(withKey.length, commits.length)}); of those, linked to an existing task: ${share(withKey.filter((c) => c.taskId !== null).length, withKey.length)}`)
if (logins.length) console.log(`Authors matched to the given members: ${share(commits.filter((c) => c.authorId !== null).length, commits.length)}; not on the list: ${result.unmatchedAuthors.join(', ') || 'none'}`)
const unlinked = commits.filter((c) => c.taskId === null)
console.log(`Unlinked work (${unlinked.length}), first 10:`)
for (const c of unlinked.slice(0, 10)) console.log(`  ${c.sha.slice(0, 7)}  ${c.message.split('\n')[0].slice(0, 70)}`)
