import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import express from 'express'
import { createAuthRouter } from '../src/routes/auth.js'
import {
  createOAuthStateCookie,
  createSessionCookie,
  hashInviteCode,
  normalizeInviteCode,
  readOAuthStateCookie,
  readSessionCookie,
} from '../src/auth/session.js'

const secret = 'a-test-session-secret-with-more-than-32-characters'

test('signed sessions round-trip and reject tampering and expiration', () => {
  const session = {
    githubId: '42',
    login: 'octocat',
    name: 'Octocat',
    avatarUrl: null,
    role: 'student',
    team: { id: '7', name: 'Sprint team' },
  }
  const cookie = createSessionCookie(session, secret, false, 1_000)
  const token = cookie.split(';')[0].split('=')[1]

  assert.deepEqual(readSessionCookie(token, secret, 1_001), session)
  assert.equal(readSessionCookie(`${token.slice(0, -1)}x`, secret, 1_001), null)
  assert.equal(readSessionCookie(token, secret, 8 * 24 * 60 * 60 * 1000), null)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
})

test('OAuth state is signed and invitation codes normalize before hashing', () => {
  const state = createOAuthStateCookie('/?invite=ABC123', secret, false)
  const token = state.cookie.split(';')[0].split('=')[1]

  assert.equal(readOAuthStateCookie(token, secret).state, state.state)
  assert.equal(readOAuthStateCookie(`${token.slice(0, -1)}x`, secret), null)
  const code = 'a1b2c3'.repeat(8)
  assert.equal(normalizeInviteCode(' A1-B2_C3 '.repeat(8)), code.toUpperCase())
  assert.equal(hashInviteCode(code), hashInviteCode(code.toUpperCase()))
  assert.notEqual(hashInviteCode(code), code)
})

let server
let baseUrl

before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api', createAuthRouter({
    pool: {},
    env: { SESSION_SECRET: secret, GITHUB_CLIENT_ID: 'test-client-id' },
  }))
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

test('GitHub login redirects with a state token and an HttpOnly state cookie', async () => {
  const response = await fetch(`${baseUrl}/api/auth/github?returnTo=%2F%3Finvite%3DABC123`, {
    redirect: 'manual',
  })
  const location = new URL(response.headers.get('location'))

  assert.equal(response.status, 302)
  assert.equal(location.origin, 'https://github.com')
  assert.equal(location.pathname, '/login/oauth/authorize')
  assert.equal(location.searchParams.get('client_id'), 'test-client-id')
  assert.equal(location.searchParams.get('redirect_uri'), `${baseUrl}/api/auth/callback`)
  assert.ok(location.searchParams.get('state'))
  assert.match(response.headers.get('set-cookie'), /HttpOnly/)
})

test('invalid OAuth state and unauthenticated team requests are rejected', async () => {
  const callback = await fetch(`${baseUrl}/api/auth/callback?code=not-used&state=wrong`, {
    redirect: 'manual',
  })
  assert.equal(callback.status, 302)
  assert.equal(callback.headers.get('location'), '/?authError=github')

  const createTeam = await fetch(`${baseUrl}/api/teams`, {
    method: 'POST',
    headers: { Origin: baseUrl, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Team' }),
  })
  assert.equal(createTeam.status, 401)
  assert.deepEqual(await createTeam.json(), { error: 'Sign in with GitHub to create a team.' })
})
