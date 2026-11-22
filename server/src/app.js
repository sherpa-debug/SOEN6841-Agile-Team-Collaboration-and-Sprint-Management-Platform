import cors from 'cors'
import express from 'express'
import healthRouter from './routes/health.js'

const app = express()

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
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
    endpoints: ['/api/health', '/api/health/database'],
  })
})

app.use('/api/health', healthRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

export default app
