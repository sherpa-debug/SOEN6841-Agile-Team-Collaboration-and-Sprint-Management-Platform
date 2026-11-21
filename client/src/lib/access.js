// Access rules (NFR3, FR7, tests T7 and T12): students reach only their own team, and
// TAs and instructors can read every team but never create, update or delete.
//
// Stand-in for the API's role check until the Express server exists. Every function here is
// pure (a session and a team id in, a decision out), so the same rules can be called from the
// API on every request later. In the browser they only decide what to show: real enforcement
// has to happen on the server, because anyone can edit what the browser holds.

export const ROLES = Object.freeze(['student', 'ta', 'instructor'])
export const STAFF_ROLES = Object.freeze(['ta', 'instructor'])
export const ALL_TEAMS = '*' // a staff session is not tied to one team

// Demo codes that sign someone in as staff (the real app would take roles from the course roster)
export const STAFF_CODES = Object.freeze({
  TA6841: 'ta',
  PROF6841: 'instructor',
})

const ACTIONS = Object.freeze(['read', 'create', 'update', 'delete'])

// A session without a role is a student. An unknown role is kept as it is, so it gets no access.
export const roleOf = (session) => session?.role ?? 'student'
export const isStaff = (session) => STAFF_ROLES.includes(roleOf(session))

const deny = (status, error) => ({ ok: false, status, error })

// Decide one request. Returns { ok: true } or { ok: false, status, error }:
//   401  no signed-in user
//   403  signed in, but not allowed (another team, a write by staff, an unknown role or action)
export function authorize(session, { action, teamId } = {}) {
  if (!session?.githubId) return deny(401, 'Sign in with GitHub first.')
  if (!ACTIONS.includes(action)) return deny(403, 'Unknown action.')

  const role = roleOf(session)
  if (!ROLES.includes(role)) return deny(403, 'Unknown role.')

  if (role === 'student') {
    const own = session.team?.id
    if (!own || own === ALL_TEAMS || own !== teamId) return deny(403, 'Students can only reach their own team.')
    return { ok: true }
  }

  // ta or instructor
  if (action !== 'read') return deny(403, 'TAs and instructors have read-only access.')
  return { ok: true }
}

export const canRead = (session, teamId) => authorize(session, { action: 'read', teamId }).ok

// True when the session may create, update and delete in this team (the three actions go together)
export const canWrite = (session, teamId) =>
  ['create', 'update', 'delete'].every((action) => authorize(session, { action, teamId }).ok)

// The teams a session may see out of a list of { id, name }
export function visibleTeams(session, teams) {
  return teams.filter((team) => canRead(session, team.id))
}

// ---- Tokens never reach the browser (NFR3, T12) ----

const SECRET_KEY = /token|secret|password|authorization|credential/i

// A copy of the value without any field whose name looks like a secret, at any depth
export function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SECRET_KEY.test(key))
        .map(([key, inner]) => [key, stripSecrets(inner)]),
    )
  }
  return value
}

// True when the value has a field that looks like a secret, at any depth
export function hasSecrets(value) {
  if (Array.isArray(value)) return value.some(hasSecrets)
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, inner]) => SECRET_KEY.test(key) || hasSecrets(inner))
  }
  return false
}
