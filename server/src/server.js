import app from './app.js'
import { closeDatabase } from './database.js'

const port = Number(process.env.PORT ?? 3000)
const server = app.listen(port, () => {
  console.log(`SprintProof API listening on port ${port}`)
})

async function shutdown() {
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
