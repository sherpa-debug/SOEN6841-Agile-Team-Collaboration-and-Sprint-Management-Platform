import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../src/app.js'

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

test('GET / returns a successful API landing response', async () => {
  const response = await fetch(`${baseUrl}/`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    name: 'SprintProof API',
    status: 'running',
    info: '/api',
  })
})

test('GET /api reports the API name and health endpoint', async () => {
  const response = await fetch(`${baseUrl}/api`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    name: 'SprintProof API',
    version: '0.1.0',
    endpoints: ['/api/health', '/api/health/database'],
  })
})

test('GET /api/health returns a successful liveness response', async () => {
  const response = await fetch(`${baseUrl}/api/health`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'sprintproof-api',
  })
})

test('unknown API routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`)

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Not found' })
})
