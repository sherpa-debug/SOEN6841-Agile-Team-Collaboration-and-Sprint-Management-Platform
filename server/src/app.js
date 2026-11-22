import cors from 'cors'
import express from 'express'
import healthRouter from './routes/health.js'
import { createAuthRouter } from './routes/auth.js'

const app = express()
app.set('trust proxy', 1)

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

app.get('/', (_request, response) => {
  response.json({
    name: 'SprintProof API',
    status: 'running',
    info: '/api',
  })
})

app.get('/api', (_request, response) => {
  response.json({
    name: 'SprintProof API',
    version: '0.1.0',
    endpoints: [
      '/api/health',
      '/api/health/database',
      '/api/auth/github',
      '/api/auth/callback',
      '/api/auth/session',
      '/api/auth/logout',
      '/api/teams',
      '/api/teams/invites',
      '/api/teams/join',
    ],
  })
})

app.use('/api/health', healthRouter)
const authRouter = createAuthRouter()
app.use('/api', authRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

export default app
