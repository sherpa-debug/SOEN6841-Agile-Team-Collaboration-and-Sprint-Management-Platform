import { Router } from 'express'
import { checkDatabase } from '../database.js'

const router = Router()

router.get('/', (_request, response) => {
  response.json({ status: 'ok', service: 'sprintproof-api' })
})

router.get('/database', async (_request, response) => {
  try {
    await checkDatabase()
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Database health check failed:', error.message)
    response.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

export default router
