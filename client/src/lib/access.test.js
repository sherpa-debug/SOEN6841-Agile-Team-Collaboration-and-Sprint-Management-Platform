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

const base = { githubId: '7', login: 'octocat', name: 'Octo' }
const alphaStudent = { ...base, role: 'student', team: { id: 'alpha24', name: 'Team Alpha' } }
const sprintStudent = { ...base, role: 'student', team: { id: 'sprint1', name: 'Sprint Team' } }
const ta = { ...base, role: 'ta', team: { id: ALL_TEAMS, name: 'All teams' } }
const instructor = { ...base, role: 'instructor', team: { id: ALL_TEAMS, name: 'All teams' } }

const WRITES = ['create', 'update', 'delete']

describe('session roles', () => {
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

describe('secret fields are stripped from client data', () => {
  const leaky = { ...base, access_token: 'gho_secret', nested: { refreshToken: 'x', clientSecret: 'y', keep: 1 } }

  it('finds and removes secret-looking fields at any depth', () => {
    expect(hasSecrets(leaky)).toBe(true)
    expect(hasSecrets(base)).toBe(false)
    expect(stripSecrets(leaky)).toEqual({ ...base, nested: { keep: 1 } })
    expect(stripSecrets([{ token: 1, ok: 2 }])).toEqual([{ ok: 2 }])
  })

  it('does not preserve token fields when reducing a profile to client data', () => {
    expect(stripSecrets({ ...base, access_token: 'gho_secret' })).toEqual(base)
  })
})
