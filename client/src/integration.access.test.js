import { describe, it, expect } from 'vitest'
import { MEMBERS, SAMPLE_AI_LOG, SAMPLE_TASKS, SPRINTS } from './data/sampleData.js'
import { authorize, canRead, canWrite, hasSecrets, visibleTeams } from './lib/access.js'
import { AUTH_STORAGE_KEY, createGitHubSession, joinTeam, loadSession, saveSession } from './lib/auth.js'
import { linkWork, memberMeasures, sprintSummary } from './lib/contribution.js'
import { unlinkedInSprint, workCountsByTask } from './lib/linkedWork.js'

// SP-14: permission tests (T7, T12) and the 500-commit check (T11), run as whole flows:
// sign in -> join -> save -> reload -> decide. The rules themselves are unit-tested in access.test.js.

const profile = { id: 259220713, login: 'sherpa-debug', name: 'Anusha', avatar_url: 'https://example.test/a.png' }
const TEAMS = [
  { id: 'alpha24', name: 'Team Alpha' },
  { id: 'sprint1', name: 'SprintProof Team' },
]
const WRITES = ['create', 'update', 'delete']

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    raw: (key) => data.get(key),
  }
}

// Sign in, join with a code, close the app and open it again: the session a reload gives back
function joinAndReload(code, rawProfile = profile) {
  const storage = fakeStorage()
  const joined = joinTeam(code, createGitHubSession(rawProfile))
  expect(joined.ok).toBe(true)
  saveSession(joined.session, storage)
  return { storage, session: loadSession(storage) }
}

describe('T12: a student reaches only their own team, also after a reload', () => {
  const { session } = joinAndReload('ALPHA24')

  it('reads and writes their own team', () => {
    expect(session.role).toBe('student')
    expect(canRead(session, 'alpha24')).toBe(true)
    expect(canWrite(session, 'alpha24')).toBe(true)
  })

  it("gets 403 for another team's data, for reading and for every write", () => {
    expect(authorize(session, { action: 'read', teamId: 'sprint1' })).toMatchObject({ ok: false, status: 403 })
    for (const action of WRITES) {
      expect(authorize(session, { action, teamId: 'sprint1' })).toMatchObject({ ok: false, status: 403 })
    }
  })

  it('lists only their own team', () => {
    expect(visibleTeams(session, TEAMS).map((t) => t.id)).toEqual(['alpha24'])
  })

  it('cannot widen their access by editing the saved team to the all-teams marker', () => {
    const edited = { ...session, team: { id: '*', name: 'All teams' } }
    expect(canRead(edited, 'alpha24')).toBe(false)
    expect(canRead(edited, 'sprint1')).toBe(false)
  })

  it('gets 401 once the session is gone', () => {
    const storage = fakeStorage()
    saveSession(session, storage)
    saveSession(null, storage)
    expect(authorize(loadSession(storage), { action: 'read', teamId: 'alpha24' })).toMatchObject({ ok: false, status: 401 })
  })
})

describe('T7: TAs and instructors see every team but can only read, also after a reload', () => {
  for (const [label, code, role] of [
    ['a TA', 'TA6841', 'ta'],
    ['an instructor', 'PROF6841', 'instructor'],
  ]) {
    it(`${label} signs in, joins with the staff code and keeps the ${role} role after a reload`, () => {
      const { session } = joinAndReload(code)
      expect(session.role).toBe(role)
      expect(session.team).toEqual({ id: '*', name: 'All teams' })
      expect(visibleTeams(session, TEAMS).map((t) => t.id)).toEqual(['alpha24', 'sprint1'])
    })

    it(`${label} gets 403 for every create, update and delete in every team`, () => {
      const { session } = joinAndReload(code)
      for (const team of TEAMS) {
        expect(authorize(session, { action: 'read', teamId: team.id }).ok).toBe(true)
        for (const action of WRITES) {
          expect(authorize(session, { action, teamId: team.id })).toMatchObject({ ok: false, status: 403 })
        }
        expect(canWrite(session, team.id)).toBe(false)
      }
    })
  }

  it('a staff code needs a GitHub sign-in first, and a made-up code gives no role at all', () => {
    expect(joinTeam('TA6841', null)).toEqual({ ok: false, error: 'Sign in with GitHub before joining a team.' })
    expect(joinTeam('TA6842', createGitHubSession(profile)).ok).toBe(false)
  })
})

describe('T12: no token ends up in the browser', () => {
  const withToken = { ...profile, access_token: 'gho_secret123', token: 'gho_secret123' }

  it('keeps tokens out of the session built from a GitHub profile', () => {
    expect(hasSecrets(createGitHubSession(withToken))).toBe(false)
  })

  it('writes no token to storage, even when a session with one is saved', () => {
    const storage = fakeStorage()
    const session = { ...joinTeam('ALPHA24', createGitHubSession(profile)).session, accessToken: 'gho_secret123' }
    saveSession(session, storage)
    const stored = storage.raw(AUTH_STORAGE_KEY)
    expect(stored.includes('gho_secret123')).toBe(false)
    expect(/token/i.test(stored)).toBe(false)
  })

  it('drops a token that an older version of the app already saved', () => {
    const storage = fakeStorage()
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ githubId: '1', login: 'x', role: 'student', accessToken: 'gho_old' }))
    expect(hasSecrets(loadSession(storage))).toBe(false)
  })
})

describe('T11: a sprint with 500 commits is calculated well inside 3 seconds', () => {
  // 500 commits over Sprint 1, four authors, ten task keys; every fifth commit carries no key
  const commits = Array.from({ length: 500 }, (_, i) => ({
    sha: `c${String(i).padStart(7, '0')}`,
    authorId: (i % 4) + 1,
    message: i % 5 === 4 ? `tidy ${i}` : `SP-${(i % 10) + 1} change ${i}`,
    date: `2026-11-${String(9 + (i % 14)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00`,
  }))
  const sprint = SPRINTS[0]

  function everythingTheDashboardNeeds() {
    const work = linkWork(commits, [], SAMPLE_TASKS)
    const measures = MEMBERS.map((member) => memberMeasures({ member, sprint, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG }))
    const summary = sprintSummary({ sprint, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG })
    return { work, measures, summary, unlinked: unlinkedInSprint(work, sprint), counts: workCountsByTask(work) }
  }

  it('finishes the six measures, the team tiles and the unlinked list in under 3 seconds', () => {
    // This times the calculation only. The 3 s target in D3 also covers the API and the page.
    const start = performance.now()
    everythingTheDashboardNeeds()
    expect(performance.now() - start).toBeLessThan(3000)
  })

  it('still counts every commit exactly once, and every number matches the items behind it', () => {
    const { measures, summary, unlinked } = everythingTheDashboardNeeds()
    expect(measures.reduce((sum, m) => sum + m.commits.value, 0)).toBe(400)
    expect(summary.linkedCommits.value).toBe(400)
    expect(summary.unlinked.value).toBe(100)
    expect(unlinked).toHaveLength(100)
    for (const m of measures) expect(m.commits.items).toHaveLength(m.commits.value)
  })
})
