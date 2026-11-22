// An in-memory store with the same methods as the PostgreSQL one (pg-store.js). Used by the tests
// and by scripts/poc-sync.js, so the sync can be run and checked without a database.
export function createMemoryStore({ teams = [], tasks = {}, members = {} } = {}) {
  const commits = new Map() // sha -> row
  const pulls = new Map() // "teamId:number" -> row
  const states = new Map() // teamId -> state
  const taskIds = new Map(Object.entries(tasks).map(([teamId, keys]) => [Number(teamId), new Map(Object.entries(keys))]))

  return {
    async listTeamsWithRepos() {
      return teams.filter((team) => team.repo)
    },
    async getSyncState(teamId) {
      return states.get(teamId) ?? { lastSyncAt: null, pullsEtag: null, status: 'never', error: null }
    },
    async saveSyncState(teamId, state) {
      states.set(teamId, { lastSyncAt: state.lastSyncAt ?? null, pullsEtag: state.pullsEtag ?? null, status: state.status, error: state.error ?? null })
    },
    async loadTaskIds(teamId) {
      return new Map(taskIds.get(teamId) ?? [])
    },
    async loadMembers(teamId) {
      return members[teamId] ?? []
    },
    async upsertCommits(teamId, rows) {
      let inserted = 0
      for (const row of rows) {
        const old = commits.get(row.sha)
        if (!old) inserted += 1
        commits.set(row.sha, {
          teamId,
          sha: row.sha,
          message: row.message,
          committedAt: row.committedAt,
          // a link made by hand, or an author found earlier, is never overwritten with "none"
          taskId: row.taskId ?? old?.taskId ?? null,
          authorId: row.authorId ?? old?.authorId ?? null,
        })
      }
      return { inserted }
    },
    async upsertPullRequests(teamId, rows) {
      for (const row of rows) {
        const id = `${teamId}:${row.number}`
        const old = pulls.get(id)
        pulls.set(id, {
          teamId,
          number: row.number,
          state: row.state,
          mergedAt: row.mergedAt,
          taskId: row.taskId ?? old?.taskId ?? null,
          authorId: row.authorId ?? old?.authorId ?? null,
        })
      }
    },
    async listUnlinkedCommits(teamId) {
      return [...commits.values()].filter((row) => row.teamId === teamId && row.taskId === null).map(({ sha, message }) => ({ sha, message }))
    },
    async setCommitTasks(teamId, links) {
      for (const { sha, taskId } of links) {
        const row = commits.get(sha)
        if (row && row.teamId === teamId) row.taskId = taskId
      }
    },
    // for the tests and the proof of concept
    addTask(teamId, key, id) {
      if (!taskIds.has(teamId)) taskIds.set(teamId, new Map())
      taskIds.get(teamId).set(key, id)
    },
    commits: () => [...commits.values()],
    pulls: () => [...pulls.values()],
    state: (teamId) => states.get(teamId),
  }
}
