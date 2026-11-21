import { describe, it, expect } from 'vitest'
import {
  ALL_TEAMS,
  authorize,
  canRead,
  canWrite,
  hasSecrets,
  isStaff,
  roleOf,
  stripSecrets,
  visibleTeams,
} from './access.js'
import { createGitHubSession, joinTeam, loadSession, saveSession } from './auth.js'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => [...data.values()].join('\n'),
  }
}

const profile = { id: 7, login: 'octocat', name: 'Octo' }
const base = createGitHubSession(profile)
const alphaStudent = joinTeam('ALPHA24', base).session
const sprintStudent = joinTeam('SPRINT1', base).session
const ta = joinTeam('TA6841', base).session
const instructor = joinTeam('PROF6841', base).session

const WRITES = ['create', 'update', 'delete']

describe('joining sets the role', () => {
  it('makes a student of anyone who joins with a team code', () => {
    expect(alphaStudent.role).toBe('student')
    expect(alphaStudent.team).toEqual({ id: 'alpha24', name: 'Team Alpha' })
  })

  it('gives staff codes a staff role over all teams, and still needs a GitHub sign-in', () => {
    expect(ta).toMatchObject({ role: 'ta', team: { id: ALL_TEAMS } })
    expect(instructor).toMatchObject({ role: 'instructor', team: { id: ALL_TEAMS } })
    expect(joinTeam('TA6841', null)).toEqual({ ok: false, error: 'Sign in with GitHub before joining a team.' })
    expect(joinTeam('ta-6841', base).session.role).toBe('ta') // same clean-up as team codes
  })

  it('refuses a made-up code, and a team code cannot be turned into a staff role', () => {
    expect(joinTeam('STAFF', base).ok).toBe(false)
    expect(joinTeam('ALPHA24', ta).session.role).toBe('student')
  })

  it('treats a session without a role as a student', () => {
    expect(roleOf({ githubId: '1' })).toBe('student')
    expect(isStaff(ta)).toBe(true)
    expect(isStaff(alphaStudent)).toBe(false)
  })
})

describe('T12: students reach only their own team', () => {
  it('lets a student read and write their own team', () => {
    expect(authorize(alphaStudent, { action: 'read', teamId: 'alpha24' })).toEqual({ ok: true })
    for (const action of WRITES) expect(authorize(alphaStudent, { action, teamId: 'alpha24' }).ok).toBe(true)
    expect(canWrite(alphaStudent, 'alpha24')).toBe(true)
  })

  it("returns 403 for another team's data, for reading and for every write", () => {
    for (const action of ['read', ...WRITES]) {
      expect(authorize(alphaStudent, { action, teamId: 'sprint1' })).toMatchObject({ ok: false, status: 403 })
    }
    expect(canRead(alphaStudent, 'sprint1')).toBe(false)
    expect(canRead(sprintStudent, 'alpha24')).toBe(false)
  })

  it('lists only the own team to a student, and every team to staff', () => {
    const teams = [{ id: 'alpha24' }, { id: 'sprint1' }]
    expect(visibleTeams(alphaStudent, teams)).toEqual([{ id: 'alpha24' }])
    expect(visibleTeams(ta, teams)).toEqual(teams)
  })

  it('does not let a student who has no team, or who claims the all-teams id, reach anything', () => {
    expect(canRead({ githubId: '1', role: 'student' }, 'alpha24')).toBe(false)
    expect(canRead({ githubId: '1', role: 'student', team: { id: ALL_TEAMS } }, 'alpha24')).toBe(false)
    expect(canRead({ githubId: '1', role: 'student', team: { id: ALL_TEAMS } }, ALL_TEAMS)).toBe(false)
  })

  it('returns 401 without a signed-in user', () => {
    expect(authorize(null, { action: 'read', teamId: 'alpha24' })).toMatchObject({ ok: false, status: 401 })
    expect(authorize({}, { action: 'read', teamId: 'alpha24' })).toMatchObject({ ok: false, status: 401 })
  })

  it('fails closed on an unknown role or action', () => {
    expect(authorize({ ...ta, role: 'admin' }, { action: 'read', teamId: 'alpha24' }).status).toBe(403)
    expect(authorize(alphaStudent, { action: 'export', teamId: 'alpha24' }).status).toBe(403)
    expect(authorize(alphaStudent, { teamId: 'alpha24' }).status).toBe(403)
  })
})

describe('T7: TAs and instructors can only read', () => {
  it('lets a TA and an instructor read every team', () => {
    for (const staff of [ta, instructor]) {
      for (const teamId of ['alpha24', 'sprint1', 'any-other-team']) {
        expect(authorize(staff, { action: 'read', teamId })).toEqual({ ok: true })
      }
    }
  })

  it('returns 403 for every create, update and delete, in every team', () => {
    for (const staff of [ta, instructor]) {
      for (const teamId of ['alpha24', 'sprint1', ALL_TEAMS]) {
        for (const action of WRITES) {
          expect(authorize(staff, { action, teamId })).toMatchObject({ ok: false, status: 403 })
        }
        expect(canWrite(staff, teamId)).toBe(false)
      }
    }
  })
})

describe('T12: no token is ever kept in the browser', () => {
  const leaky = { ...base, access_token: 'gho_secret', nested: { refreshToken: 'x', clientSecret: 'y', keep: 1 } }

  it('finds and removes secret-looking fields at any depth', () => {
    expect(hasSecrets(leaky)).toBe(true)
    expect(hasSecrets(base)).toBe(false)
    expect(stripSecrets(leaky)).toEqual({ ...base, nested: { keep: 1 } })
    expect(stripSecrets([{ token: 1, ok: 2 }])).toEqual([{ ok: 2 }])
  })

  it('does not copy a token from the GitHub profile into the session', () => {
    const session = createGitHubSession({ ...profile, access_token: 'gho_secret' })
    expect(hasSecrets(session)).toBe(false)
  })

  it('never saves a token, even if the session passed in has one', () => {
    const storage = fakeStorage()
    saveSession({ ...alphaStudent, access_token: 'gho_secret' }, storage)
    expect(storage.dump()).not.toContain('gho_secret')
    expect(hasSecrets(loadSession(storage))).toBe(false)
  })

  it('drops a token that an older version of the app already saved', () => {
    const storage = fakeStorage()
    storage.setItem('sprintproof.auth.v1', JSON.stringify({ ...alphaStudent, access_token: 'gho_secret' }))
    expect(JSON.stringify(loadSession(storage))).not.toContain('gho_secret')
    expect(loadSession(storage)).toEqual(alphaStudent)
  })

  it('has no token in any session a join produces', () => {
    for (const session of [alphaStudent, sprintStudent, ta, instructor]) expect(hasSecrets(session)).toBe(false)
  })
})
