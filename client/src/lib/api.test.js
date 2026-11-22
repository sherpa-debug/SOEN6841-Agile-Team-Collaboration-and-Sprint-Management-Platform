import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api.js'
import { DEMO_SESSION, joinDemoTeam } from './auth.js'
import { authorize, hasSecrets } from './access.js'

afterEach(() => vi.unstubAllGlobals())

const reply = (body, ok = true) => ({ ok, json: async () => JSON.parse(body) })

describe('apiRequest when no API is running', () => {
  it('marks an HTML page (the single-page fallback) as NO_API with a clear message', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => JSON.parse('<!doctype html><html></html>') }))
    await expect(apiRequest('/api/auth/session')).rejects.toMatchObject({
      code: 'NO_API',
      message: 'The sign-in server is not available right now.',
    })
  })

  it('still returns JSON and the server error text when the API answers', async () => {
    vi.stubGlobal('fetch', async () => reply('{"session":null}'))
    await expect(apiRequest('/api/auth/session')).resolves.toEqual({ session: null })
    vi.stubGlobal('fetch', async () => reply('{"error":"Invalid or expired invite code."}', false))
    await expect(apiRequest('/api/teams/join', { method: 'POST', body: {} })).rejects.toThrow('Invalid or expired invite code.')
  })
})

describe('demo mode', () => {
  it('starts as a signed-in user with no team and no token', () => {
    expect(DEMO_SESSION).toMatchObject({ githubId: 'demo', demo: true })
    expect(DEMO_SESSION.team).toBeUndefined()
    expect(hasSecrets(DEMO_SESSION)).toBe(false)
  })

  it('makes a student of the team for a team code, reaching only that team', () => {
    const { ok, session } = joinDemoTeam('alpha-24', DEMO_SESSION)
    expect(ok).toBe(true)
    expect(session).toMatchObject({ role: 'student', demo: true, team: { id: 'alpha24', name: 'Team Alpha' } })
    expect(authorize(session, { action: 'update', teamId: 'alpha24' }).ok).toBe(true)
    expect(authorize(session, { action: 'read', teamId: 'sprint1' })).toMatchObject({ ok: false, status: 403 })
  })

  it('gives staff codes a read-only role over every team', () => {
    for (const [code, role] of [['TA6841', 'ta'], ['PROF6841', 'instructor']]) {
      const { session } = joinDemoTeam(code, DEMO_SESSION)
      expect(session.role).toBe(role)
      expect(authorize(session, { action: 'read', teamId: 'alpha24' })).toEqual({ ok: true })
      expect(authorize(session, { action: 'update', teamId: 'alpha24' })).toMatchObject({ ok: false, status: 403 })
    }
  })

  it('refuses a made-up code, and a join with no sign-in', () => {
    expect(joinDemoTeam('NOPE', DEMO_SESSION)).toEqual({ ok: false, error: 'Invalid or expired invite code.' })
    expect(joinDemoTeam('ALPHA24', null)).toEqual({ ok: false, error: 'Sign in with GitHub before joining a team.' })
  })
})
