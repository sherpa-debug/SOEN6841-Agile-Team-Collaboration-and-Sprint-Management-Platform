import { loadJSON, saveJSON } from './storage.js'
import { ALL_TEAMS, STAFF_CODES, stripSecrets } from './access.js'

export const AUTH_STORAGE_KEY = 'sprintproof.auth.v1'
export const INVITE_CODES = Object.freeze({
  ALPHA24: 'Team Alpha',
  SPRINT1: 'SprintProof Team',
})

export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// A saved session never carries a token, even if an older version of the app saved one (T12)
export function loadSession(storage = globalThis.localStorage) {
  const saved = loadJSON(AUTH_STORAGE_KEY, null, storage)
  return saved ? stripSecrets(saved) : saved
}

export function saveSession(session, storage = globalThis.localStorage) {
  if (session) {
    saveJSON(AUTH_STORAGE_KEY, stripSecrets(session), storage)
  } else {
    try {
      storage?.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Storage blocked or unavailable; the app keeps the in-memory session.
    }
  }
  return session
}

export function joinTeam(inviteCode, session, teams = INVITE_CODES, staffCodes = STAFF_CODES) {
  const code = normalizeInviteCode(inviteCode)
  const teamName = teams[code]
  const staffRole = staffCodes[code]
  if (!teamName && !staffRole) {
    return { ok: false, error: 'Invalid or expired invite code.' }
  }
  if (!session?.githubId) {
    return { ok: false, error: 'Sign in with GitHub before joining a team.' }
  }
  // A staff code gives a read-only role over every team (FR7); a team code makes a student
  if (staffRole) {
    return {
      ok: true,
      session: { ...session, role: staffRole, team: { id: ALL_TEAMS, name: 'All teams' }, inviteCode: code },
    }
  }
  return {
    ok: true,
    session: {
      ...session,
      role: 'student',
      team: { id: code.toLowerCase(), name: teamName },
      inviteCode: code,
    },
  }
}

export function createGitHubSession(profile) {
  if (!profile?.id || !profile?.login) {
    throw new Error('A GitHub profile requires id and login.')
  }
  return {
    githubId: String(profile.id),
    login: profile.login,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url || null,
  }
}
