import { describe, expect, it } from 'vitest'
import {
  AUTH_STORAGE_KEY,
  createGitHubSession,
  joinTeam,
  loadSession,
  normalizeInviteCode,
  saveSession,
} from './auth.js'

function fakeStorage() {
  const data = {}
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

describe('FR1: GitHub sign-in and invite-code team joining', () => {
  it('normalizes invite codes', () => {
    expect(normalizeInviteCode(' alpha-24 ')).toBe('ALPHA24')
  })

  it('creates a session from a GitHub profile', () => {
    expect(createGitHubSession({ id: 42, login: 'octocat', name: 'The Octocat' })).toMatchObject({
      githubId: '42',
      login: 'octocat',
      name: 'The Octocat',
    })
  })

  it('rejects an invalid invite code', () => {
    const result = joinTeam('WRONG', { githubId: '42', login: 'octocat' })
    expect(result.ok).toBe(false)
  })

  it('requires GitHub sign-in before joining', () => {
    const result = joinTeam('ALPHA24', null)
    expect(result.ok).toBe(false)
  })

  it('joins a signed-in member to the team', () => {
    const session = { githubId: '42', login: 'octocat', name: 'Octocat' }
    const result = joinTeam('alpha24', session)
    expect(result.ok).toBe(true)
    expect(result.session.team).toEqual({ id: 'alpha24', name: 'Team Alpha' })
  })

  it('persists and clears the session', () => {
    const storage = fakeStorage()
    saveSession({ githubId: '42', login: 'octocat' }, storage)
    expect(loadSession(storage).login).toBe('octocat')

    saveSession(null, storage)
    expect(storage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
})
