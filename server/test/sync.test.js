import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GitHubError } from '../src/sync/github.js'
import { MAX_PULL_COMMIT_REQUESTS, OVERLAP_MS, syncAllTeams, syncTeam } from '../src/sync/sync.js'
import { MEMBERS, TASKS, TEAM, commit, fakeGitHub, seededStore } from './helpers.js'

const at = (iso) => () => new Date(iso)
const run = (store, github, when = '2026-11-16T09:00:00Z') => syncTeam({ store, github: github.api, team: TEAM, now: at(when) })
const taskOf = (store, sha) => store.commits().find((row) => row.sha === sha)?.taskId

describe('T4: the seeded repository links work to the right task', () => {
  it('links keyed commits and pull requests, and keeps the rest as unlinked work', async () => {
    const store = seededStore()
    const github = fakeGitHub({
      commits: [
        commit('c1', 'SP-1 database schema'),
        commit('c2', 'sp-3: sign-in fix', { login: 'Moncef-BHFN' }),
        commit('c3', 'tidy the readme'),
        commit('c4', 'SP-99 spike for later'),
      ],
      pulls: [{ number: 7, title: 'Contribution engine', branch: 'tanzir/SP-4_engine', authorLogin: 'tanzir-h', state: 'merged', mergedAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z' }],
    })
    const result = await run(store, github)

    assert.equal(result.ok, true)
    assert.equal(taskOf(store, 'c1'), TASKS['SP-1'])
    assert.equal(taskOf(store, 'c2'), TASKS['SP-3'])
    assert.equal(taskOf(store, 'c3'), null) // unlinked work stays visible, never dropped
    assert.equal(taskOf(store, 'c4'), null) // an unknown key is unlinked too
    assert.deepEqual(result.commits, { fetched: 4, inserted: 4, linked: 2, unlinked: 2 })
    assert.equal(store.pulls()[0].taskId, TASKS['SP-4'])
    assert.equal(store.pulls()[0].state, 'merged')
  })

  it('lets a commit without a key take the task of its pull request', async () => {
    const store = seededStore()
    const github = fakeGitHub({
      commits: [commit('own', 'SP-2 own key wins'), commit('wip', 'wip'), commit('lone', 'wip too')],
      pulls: [{ number: 9, title: 'SP-5 deploy', branch: 'x', authorLogin: 'sherpa-debug', state: 'open', mergedAt: null, updatedAt: '2026-11-16T08:00:00Z' }],
      pullCommits: { 9: ['wip', 'own'] },
    })
    await run(store, github)

    assert.equal(taskOf(store, 'wip'), TASKS['SP-5'])
    assert.equal(taskOf(store, 'own'), TASKS['SP-2']) // its own key comes before the pull request's
    assert.equal(taskOf(store, 'lone'), null)
  })

  it('asks GitHub for pull request commits only when a commit needs one, and never more than the limit', async () => {
    const quiet = fakeGitHub({ commits: [commit('c1', 'SP-1 fine')], pulls: [{ number: 1, title: 'SP-1', branch: '', state: 'open', updatedAt: '2026-11-16T08:00:00Z' }] })
    await run(seededStore(), quiet)
    assert.equal(quiet.calls.listPullCommits.length, 0)

    const pulls = Array.from({ length: 80 }, (_, i) => ({ number: i + 1, title: 'SP-2 part', branch: '', state: 'open', updatedAt: '2026-11-16T08:00:00Z' }))
    const busy = fakeGitHub({ commits: [commit('lost', 'no key anywhere')], pulls })
    await run(seededStore(), busy)
    assert.equal(busy.calls.listPullCommits.length, MAX_PULL_COMMIT_REQUESTS)
  })
})

describe('authors are matched to team members', () => {
  it('matches by login in any letter case, by GitHub noreply address, and by e-mail', async () => {
    const store = seededStore()
    const github = fakeGitHub({
      commits: [
        commit('a', 'SP-1 a', { login: 'MING-DEV' }),
        commit('b', 'SP-1 b', { login: null, email: '259220713+sherpa-debug@users.noreply.github.com' }),
        commit('c', 'SP-1 c', { login: null, email: 'Tanzir@Example.test' }),
      ],
    })
    await run(store, github)

    const author = (sha) => store.commits().find((row) => row.sha === sha).authorId
    assert.equal(author('a'), 11)
    assert.equal(author('b'), 13)
    assert.equal(author('c'), 14)
  })

  it('lists authors who are not on the team, once each, instead of guessing', async () => {
    const store = seededStore()
    const github = fakeGitHub({ commits: [commit('a', 'SP-1 a', { login: 'visitor' }), commit('b', 'SP-1 b', { login: 'visitor' }), commit('c', 'SP-1 c', { login: 'ming-dev' })] })
    const result = await run(store, github)

    assert.deepEqual(result.unmatchedAuthors, ['visitor'])
    assert.equal(store.commits().find((row) => row.sha === 'a').authorId, null)
  })
})

describe('T13: a sync that was stopped catches up with no missing or duplicate commits', () => {
  it('shows 5 commits pushed during a stopped sync exactly once, however often it runs after', async () => {
    const store = seededStore()
    const github = fakeGitHub({ commits: [commit('a1', 'SP-1 one', { at: '2026-11-15T10:00:00Z' }), commit('a2', 'SP-1 two', { at: '2026-11-15T11:00:00Z' }), commit('a3', 'SP-2 three', { at: '2026-11-15T12:00:00Z' })] })

    const first = await run(store, github, '2026-11-15T13:00:00Z')
    assert.equal(first.commits.inserted, 3)
    assert.equal(github.calls.listCommits[0].since, null) // the first sync reads everything

    // the sync is down; five commits are pushed in the meantime
    for (let i = 1; i <= 5; i += 1) github.repo.commits.unshift(commit(`d${i}`, `SP-3 while down ${i}`, { at: `2026-11-15T${13 + i}:00:00Z` }))

    const second = await run(store, github, '2026-11-15T20:00:00Z')
    assert.equal(second.commits.inserted, 5)
    assert.equal(github.calls.listCommits[1].since.getTime(), new Date('2026-11-15T13:00:00Z').getTime() - OVERLAP_MS)

    // running again straight away re-reads the overlap and must change nothing
    const third = await run(store, github, '2026-11-15T20:05:00Z')
    assert.equal(third.commits.inserted, 0)
    assert.equal(store.commits().length, 8)
    assert.equal(new Set(store.commits().map((row) => row.sha)).size, 8)
  })

  it('does not move the last-sync time when a sync fails, so the next one covers the gap', async () => {
    const store = seededStore()
    const github = fakeGitHub({ commits: [commit('a1', 'SP-1 one', { at: '2026-11-15T10:00:00Z' })] })
    await run(store, github, '2026-11-15T11:00:00Z')

    github.repo.failWith = new GitHubError('GitHub rate limit reached.', { status: 403, resetAt: new Date('2026-11-15T13:00:00Z') })
    github.repo.commits.unshift(commit('b1', 'SP-2 missed', { at: '2026-11-15T11:30:00Z' }))
    const failed = await run(store, github, '2026-11-15T12:00:00Z')

    assert.equal(failed.ok, false)
    assert.match(failed.error, /rate limit/)
    assert.equal(failed.resetAt.toISOString(), '2026-11-15T13:00:00.000Z')
    assert.equal(store.state(TEAM.id).status, 'error')
    assert.equal(store.state(TEAM.id).lastSyncAt.toISOString(), '2026-11-15T11:00:00.000Z')

    github.repo.failWith = null
    const recovered = await run(store, github, '2026-11-15T14:00:00Z')
    assert.equal(recovered.ok, true)
    assert.equal(taskOf(store, 'b1'), TASKS['SP-2'])
    assert.equal(store.state(TEAM.id).status, 'ok')
  })

  it('leaves everything as it was on a repeat run (idempotent)', async () => {
    const store = seededStore()
    const github = fakeGitHub({ commits: [commit('a', 'SP-1 a'), commit('b', 'unkeyed')], pulls: [{ number: 1, title: 'SP-2', branch: '', authorLogin: 'ming-dev', state: 'open', updatedAt: '2026-11-15T00:00:00Z' }] })
    await run(store, github)
    const before = JSON.stringify([store.commits(), store.pulls()])
    const again = await run(store, github, '2026-11-16T09:10:00Z')

    assert.equal(again.commits.inserted, 0)
    assert.equal(JSON.stringify([store.commits(), store.pulls()]), before)
  })
})

describe('what is already saved is looked after', () => {
  it('links earlier unlinked commits once their task exists', async () => {
    const store = seededStore()
    const github = fakeGitHub({ commits: [commit('s9', 'SP-9 GitHub sync')] })
    await run(store, github)
    assert.equal(taskOf(store, 's9'), null)

    store.addTask(TEAM.id, 'SP-9', 109) // the task is created afterwards
    const next = await run(store, github, '2026-11-16T09:10:00Z')
    assert.equal(next.relinked, 1)
    assert.equal(taskOf(store, 's9'), 109)
  })

  it('never replaces a task or an author that is already saved with "none"', async () => {
    const store = seededStore()
    const github = fakeGitHub({ commits: [commit('m1', 'no key at all', { login: 'ming-dev' })] })
    await run(store, github)
    await store.setCommitTasks(TEAM.id, [{ sha: 'm1', taskId: 104 }]) // linked by hand

    github.repo.commits = [commit('m1', 'no key at all', { login: 'someone-else' })]
    await run(store, github, '2026-11-16T09:10:00Z')

    const saved = store.commits().find((row) => row.sha === 'm1')
    assert.equal(saved.taskId, 104)
    assert.equal(saved.authorId, 11)
  })

  it('skips the pull request list when GitHub says it did not change, and keeps the pull requests', async () => {
    const store = seededStore()
    const github = fakeGitHub({ pulls: [{ number: 3, title: 'SP-1', branch: '', state: 'open', updatedAt: '2026-11-15T00:00:00Z' }] })
    await run(store, github)
    const second = await run(store, github, '2026-11-16T09:10:00Z')

    assert.equal(second.pullsNotModified, true)
    assert.equal(github.calls.listPulls[1].etag, 'v1')
    assert.equal(store.pulls().length, 1)
    assert.equal(store.state(TEAM.id).pullsEtag, 'v1')
  })
})

describe('proof of concept: a 200-commit repository', () => {
  it('links every keyed commit to the right task and maps every author, in well under 60 seconds', async () => {
    const keys = Object.keys(TASKS)
    const commits = Array.from({ length: 200 }, (_, i) => {
      const keyed = i % 10 !== 9 // one commit in ten has no key, as a real history does
      return commit(`h${String(i).padStart(4, '0')}`, keyed ? `${keys[i % keys.length]} change ${i}` : `merge ${i}`, { login: MEMBERS[i % 4].login })
    })
    const store = seededStore()
    const start = performance.now()
    const result = await run(store, fakeGitHub({ commits }))
    const seconds = (performance.now() - start) / 1000

    assert.ok(seconds < 60)
    assert.equal(result.commits.fetched, 200)
    const keyed = commits.filter((c) => !c.message.startsWith('merge'))
    const rightTask = keyed.filter((c) => taskOf(store, c.sha) === TASKS[c.message.split(' ')[0]])
    assert.equal(rightTask.length, keyed.length) // 100% of keyed commits, above the 99% target
    assert.equal(result.commits.unlinked, 20)
    assert.equal(store.commits().filter((row) => row.authorId === null).length, 0)
    assert.deepEqual(result.unmatchedAuthors, [])
  })
})

describe('syncing every team', () => {
  it('goes on with the next team when one fails, and logs both outcomes', async () => {
    const teams = [{ id: 1, repo: 'a/one' }, { id: 2, repo: 'b/two' }, { id: 3, repo: null }]
    const store = seededStore({ teams, tasks: { 1: { 'SP-1': 1 }, 2: { 'SP-1': 2 } }, members: {} })
    const logs = []
    const github = {
      async listPulls() { return { notModified: false, items: [], etag: null } },
      async listPullCommits() { return [] },
      async listCommits(repo) {
        if (repo === 'a/one') throw new GitHubError('Repository not found, or the token cannot read it.', { status: 404 })
        return { notModified: false, items: [commit('z1', 'SP-1 ok')], etag: null }
      },
    }
    const results = await syncAllTeams({ store, github, logger: { log: (line) => logs.push(line) } })

    assert.deepEqual(results.map((r) => [r.repo, r.ok]), [['a/one', false], ['b/two', true]]) // no repo: not synced
    assert.equal(logs.length, 2)
    assert.match(logs[0], /failed: Repository not found/)
    assert.match(logs[1], /1 commits \(1 linked\)/)
  })
})
