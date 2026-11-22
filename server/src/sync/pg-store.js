// The PostgreSQL store for the sync (tables from db/schema.sql and db/sync_state.sql).
// `query(sql, params)` runs one parameterised statement and returns the rows. Values only ever go
// in as parameters, never into the SQL text.
const CHUNK = 200

// "($1,$2,$3),($4,$5,$6)" for rows of three values
function valuesFor(rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, row) => `(${Array.from({ length: columnCount }, (_, col) => `$${row * columnCount + col + 1}`).join(',')})`).join(',')
}

const chunks = (rows) => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK))

export function createPgStore(query) {
  return {
    listTeamsWithRepos: () => query(`SELECT id, repo FROM team WHERE repo IS NOT NULL AND btrim(repo) <> '' ORDER BY id`),

    async getSyncState(teamId) {
      const [row] = await query(`SELECT last_sync_at, pulls_etag, status, last_error FROM sync_state WHERE team_id = $1`, [teamId])
      return row
        ? { lastSyncAt: row.last_sync_at, pullsEtag: row.pulls_etag, status: row.status, error: row.last_error }
        : { lastSyncAt: null, pullsEtag: null, status: 'never', error: null }
    },

    async saveSyncState(teamId, state) {
      await query(
        `INSERT INTO sync_state (team_id, last_sync_at, pulls_etag, status, last_error)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (team_id) DO UPDATE SET
           last_sync_at = EXCLUDED.last_sync_at, pulls_etag = EXCLUDED.pulls_etag,
           status = EXCLUDED.status, last_error = EXCLUDED.last_error`,
        [teamId, state.lastSyncAt ?? null, state.pullsEtag ?? null, state.status, state.error ?? null],
      )
    },

    // task key -> task id over all of the team's sprints (a later sprint wins if a key repeats)
    async loadTaskIds(teamId) {
      const rows = await query(
        `SELECT t.key, t.id FROM task t JOIN sprint s ON s.id = t.sprint_id WHERE s.team_id = $1 ORDER BY s.number ASC, t.id ASC`,
        [teamId],
      )
      return new Map(rows.map((row) => [row.key, row.id]))
    },

    loadMembers: (teamId) =>
      query(`SELECT u.id, u.github_login AS login, u.email FROM team_member m JOIN app_user u ON u.id = m.user_id WHERE m.team_id = $1`, [teamId]),

    // A commit is keyed by its sha. A repeat updates it in place; a link or an author that is
    // already saved (for example one made by hand) is never replaced by "none".
    async upsertCommits(teamId, rows) {
      const unique = [...new Map(rows.map((row) => [row.sha, row])).values()]
      let inserted = 0
      for (const chunk of chunks(unique)) {
        const params = chunk.flatMap((row) => [row.sha, teamId, row.taskId, row.authorId, row.message, row.committedAt])
        const result = await query(
          `INSERT INTO commits (sha, team_id, task_id, author_id, message, committed_at)
           VALUES ${valuesFor(chunk.length, 6)}
           ON CONFLICT (sha) DO UPDATE SET
             task_id = COALESCE(EXCLUDED.task_id, commits.task_id),
             author_id = COALESCE(EXCLUDED.author_id, commits.author_id),
             message = EXCLUDED.message
           RETURNING (xmax = 0) AS inserted`,
          params,
        )
        inserted += result.filter((row) => row.inserted).length
      }
      return { inserted }
    },

    async upsertPullRequests(teamId, rows) {
      const unique = [...new Map(rows.map((row) => [row.number, row])).values()]
      for (const chunk of chunks(unique)) {
        const params = chunk.flatMap((row) => [teamId, row.number, row.taskId, row.authorId, row.state, row.mergedAt])
        await query(
          `INSERT INTO pull_request (team_id, number, task_id, author_id, state, merged_at)
           VALUES ${valuesFor(chunk.length, 6)}
           ON CONFLICT (team_id, number) DO UPDATE SET
             task_id = COALESCE(EXCLUDED.task_id, pull_request.task_id),
             author_id = COALESCE(EXCLUDED.author_id, pull_request.author_id),
             state = EXCLUDED.state,
             merged_at = EXCLUDED.merged_at`,
          params,
        )
      }
    },

    listUnlinkedCommits: (teamId) => query(`SELECT sha, message FROM commits WHERE team_id = $1 AND task_id IS NULL`, [teamId]),

    async setCommitTasks(teamId, links) {
      for (const chunk of chunks(links)) {
        await query(
          `UPDATE commits c SET task_id = v.task_id
           FROM unnest($2::text[], $3::bigint[]) AS v(sha, task_id)
           WHERE c.sha = v.sha AND c.team_id = $1 AND c.task_id IS NULL`,
          [teamId, chunk.map((link) => link.sha), chunk.map((link) => link.taskId)],
        )
      }
    },
  }
}
