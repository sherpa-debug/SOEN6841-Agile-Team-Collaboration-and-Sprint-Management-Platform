import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api.js'
import { DEMO_SESSION } from './auth.js'
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

describe('demo session', () => {
  it('is a student of the SprintProof team only, with no token', () => {
    expect(DEMO_SESSION).toMatchObject({ role: 'student', demo: true, team: { id: 'sprintproof' } })
    expect(authorize(DEMO_SESSION, { action: 'update', teamId: 'sprintproof' }).ok).toBe(true)
    expect(authorize(DEMO_SESSION, { action: 'read', teamId: 'alpha24' })).toMatchObject({ ok: false, status: 403 })
    expect(hasSecrets(DEMO_SESSION)).toBe(false)
  })
})
