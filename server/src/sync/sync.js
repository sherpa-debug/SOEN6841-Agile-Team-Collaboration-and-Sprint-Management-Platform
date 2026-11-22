// The sync job (FR4, NFR2, NFR4): pull a team's commits and pull requests from GitHub, link each
// to a task by the key in its message, branch or title, match the author to a team member and
// save everything. Safe to run again and again: a commit is keyed by its sha, so a repeat or a
// catch-up never makes a duplicate or loses one.
//
// `store` and `github` are passed in, so the same code runs against PostgreSQL and GitHub in
// production and against in-memory fakes in the tests.
import { resolveKey } from './linking.js'

// A catch-up starts a little before the last successful sync, to cover clock drift and commits
// that were still arriving when it ran. The overlap costs nothing: commits are upserted by sha.
export const OVERLAP_MS = 5 * 60 * 1000
// Linking a commit through its pull request costs one GitHub request per pull request
export const MAX_PULL_COMMIT_REQUESTS = 50

const NOREPLY = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i

function memberMatcher(members) {
  const byLogin = new Map()
  const byEmail = new Map()
  for (const member of members) {
    if (member.login) byLogin.set(member.login.toLowerCase(), member.id)
    if (member.email) byEmail.set(member.email.toLowerCase(), member.id)
  }
  // A member id for a commit author: the GitHub login, else the login inside a GitHub
  // "noreply" address, else the e-mail address. null when nobody matches.
  return ({ authorLogin, authorEmail }) => {
    if (authorLogin && byLogin.has(authorLogin.toLowerCase())) return byLogin.get(authorLogin.toLowerCase())
    const noreply = authorEmail?.match(NOREPLY)?.[1]
    if (noreply && byLogin.has(noreply.toLowerCase())) return byLogin.get(noreply.toLowerCase())
    if (authorEmail && byEmail.has(authorEmail.toLowerCase())) return byEmail.get(authorEmail.toLowerCase())
    return null
  }
}

export async function syncTeam({ store, github, team, now = () => new Date() }) {
  const startedAt = now()
  const clock = performance.now()
  const state = await store.getSyncState(team.id)

  try {
    const since = state.lastSyncAt ? new Date(state.lastSyncAt.getTime() - OVERLAP_MS) : null
    const [taskIds, members] = await Promise.all([store.loadTaskIds(team.id), store.loadMembers(team.id)])
    const known = new Set(taskIds.keys())
    const matchAuthor = memberMatcher(members)

    const pulls = await github.listPulls(team.repo, { etag: state.pullsEtag })
    const commits = await github.listCommits(team.repo, { since })

    // 1. Link each commit by its own message
    const commitRows = commits.items.map((commit) => {
      const key = resolveKey([commit.message], known)
      return {
        sha: commit.sha,
        message: commit.message,
        committedAt: commit.committedAt,
        authorId: matchAuthor(commit),
        taskId: key ? taskIds.get(key) : null,
        authorLogin: commit.authorLogin,
      }
    })

    // 2. Pull requests carry a key in the branch or title
    const pullRows = pulls.items.map((pull) => {
      const key = resolveKey([pull.branch, pull.title], known)
      return {
        number: pull.number,
        state: pull.state,
        mergedAt: pull.mergedAt,
        authorId: matchAuthor({ authorLogin: pull.authorLogin }),
        taskId: key ? taskIds.get(key) : null,
        authorLogin: pull.authorLogin,
        updatedAt: pull.updatedAt,
      }
    })

    // 3. A commit with no key of its own inherits the task of its pull request
    const stillUnlinked = new Map(commitRows.filter((row) => row.taskId === null).map((row) => [row.sha, row]))
    let requests = 0
    for (const pull of pullRows) {
      if (stillUnlinked.size === 0 || requests >= MAX_PULL_COMMIT_REQUESTS) break
      const recent = !since || !pull.updatedAt || new Date(pull.updatedAt) >= since
      if (pull.taskId === null || !recent) continue
      requests += 1
      for (const sha of await github.listPullCommits(team.repo, pull.number)) {
        const row = stillUnlinked.get(sha)
        if (row) {
          row.taskId = pull.taskId
          stillUnlinked.delete(sha)
        }
      }
    }

    // 4. Save. Existing rows are updated in place, so a repeat never duplicates.
    const saved = await store.upsertCommits(team.id, commitRows)
    await store.upsertPullRequests(team.id, pullRows)

    // 5. Work saved earlier with no task may have one now (the task was created after the commit)
    const relinks = []
    for (const row of await store.listUnlinkedCommits(team.id)) {
      const key = resolveKey([row.message], known)
      if (key) relinks.push({ sha: row.sha, taskId: taskIds.get(key) })
    }
    if (relinks.length) await store.setCommitTasks(team.id, relinks)

    await store.saveSyncState(team.id, {
      lastSyncAt: startedAt,
      pullsEtag: pulls.notModified ? state.pullsEtag : (pulls.etag ?? state.pullsEtag),
      status: 'ok',
      error: null,
    })

    const unmatched = new Set()
    for (const row of [...commitRows, ...pullRows]) {
      if (row.authorId === null && row.authorLogin) unmatched.add(row.authorLogin)
    }
    return {
      ok: true,
      teamId: team.id,
      repo: team.repo,
      pullsNotModified: pulls.notModified,
      commits: {
        fetched: commitRows.length,
        inserted: saved.inserted,
        linked: commitRows.filter((row) => row.taskId !== null).length,
        unlinked: commitRows.filter((row) => row.taskId === null).length,
      },
      pulls: { fetched: pullRows.length, linked: pullRows.filter((row) => row.taskId !== null).length },
      relinked: relinks.length,
      unmatchedAuthors: [...unmatched].sort(),
      durationMs: Math.round(performance.now() - clock),
    }
  } catch (error) {
    // Keep the old last-sync time, so the next run covers what this one missed (NFR4)
    await store.saveSyncState(team.id, { ...state, status: 'error', error: error.message }).catch(() => {})
    return { ok: false, teamId: team.id, repo: team.repo, error: error.message, resetAt: error.resetAt ?? null }
  }
}

// One pass over every team that has a repository linked; one team failing does not stop the rest
export async function syncAllTeams({ store, github, logger = console, now }) {
  const results = []
  for (const team of await store.listTeamsWithRepos()) {
    const result = await syncTeam({ store, github, team, now })
    logger.log?.(
      result.ok
        ? `sync ${team.repo}: ${result.commits.fetched} commits (${result.commits.linked} linked), ${result.pulls.fetched} PRs, ${result.durationMs} ms`
        : `sync ${team.repo} failed: ${result.error}`,
    )
    results.push(result)
  }
  return results
}
