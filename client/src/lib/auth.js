import { ALL_TEAMS, STAFF_CODES } from './access.js'

export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Demo mode, for when the API is not running (for example the static GitHub Pages site).
// Nothing here is saved or sent anywhere, and it is not a real sign-in.
export const DEMO_TEAM_CODES = Object.freeze({
  ALPHA24: 'Team Alpha',
  SPRINT1: 'SprintProof Team',
})

// "Sign in with GitHub" in demo mode: a signed-in user who has not joined a team yet
export const DEMO_SESSION = Object.freeze({
  githubId: 'demo',
  login: 'demo',
  name: 'Demo user',
  avatarUrl: null,
  demo: true,
})

// Join with a demo code: a team code makes a student of that team, a staff code a read-only role
// over every team (FR7). Returns { ok, session } or { ok: false, error }.
export function joinDemoTeam(inviteCode, session, teams = DEMO_TEAM_CODES, staffCodes = STAFF_CODES) {
  const code = normalizeInviteCode(inviteCode)
  const teamName = teams[code]
  const staffRole = staffCodes[code]
  if (!teamName && !staffRole) return { ok: false, error: 'Invalid or expired invite code.' }
  if (!session?.githubId) return { ok: false, error: 'Sign in with GitHub before joining a team.' }
  if (staffRole) {
    return { ok: true, session: { ...session, role: staffRole, team: { id: ALL_TEAMS, name: 'All teams' } } }
  }
  return { ok: true, session: { ...session, role: 'student', team: { id: code.toLowerCase(), name: teamName } } }
}
