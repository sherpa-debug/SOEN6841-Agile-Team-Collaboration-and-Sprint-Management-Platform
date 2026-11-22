import app from './app.js'
import { closeDatabase, query } from './database.js'
import { createGitHubClient } from './sync/github.js'
import { createPgStore } from './sync/pg-store.js'
import { startSyncSchedule } from './sync/scheduler.js'
import { syncAllTeams } from './sync/sync.js'

const port = Number(process.env.PORT ?? 3000)
const server = app.listen(port, () => {
  console.log(`SprintProof API listening on port ${port}`)
})

// Keep each team's commits and pull requests up to date (SP-9). Needs a database and a read-only
// GitHub token, both from the environment; without them the API runs without syncing.
let schedule = null
if (process.env.DATABASE_URL && process.env.GITHUB_TOKEN) {
  const store = createPgStore(query)
  const github = createGitHubClient({ token: process.env.GITHUB_TOKEN })
  schedule = startSyncSchedule({
    run: () => syncAllTeams({ store, github }),
    intervalMs: Number(process.env.SYNC_INTERVAL_MS) || undefined,
  })
} else {
  console.log('GitHub sync is off: set DATABASE_URL and GITHUB_TOKEN to turn it on.')
}

async function shutdown() {
  schedule?.stop()
  server.close(async (error) => {
    if (error) {
      console.error('Failed to close the API server cleanly:', error)
      process.exitCode = 1
    }

    try {
      await closeDatabase()
    } catch (databaseError) {
      console.error('Failed to close the database pool cleanly:', databaseError)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
