import { loadJSON, saveJSON } from './storage.js'

export const AUTH_STORAGE_KEY = 'sprintproof.auth.v1'
export const INVITE_CODES = Object.freeze({
  ALPHA24: 'Team Alpha',
  SPRINT1: 'SprintProof Team',
})

export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function loadSession(storage = globalThis.localStorage) {
  return loadJSON(AUTH_STORAGE_KEY, null, storage)
}

export function saveSession(session, storage = globalThis.localStorage) {
  if (session) {
    saveJSON(AUTH_STORAGE_KEY, session, storage)
  } else {
    try {
      storage?.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Storage blocked or unavailable; the app keeps the in-memory session.
    }
  }
  return session
}

export function joinTeam(inviteCode, session, teams = INVITE_CODES) {
  const code = normalizeInviteCode(inviteCode)
  const teamName = teams[code]
  if (!teamName) {
    return { ok: false, error: 'Invalid or expired invite code.' }
  }
  if (!session?.githubId) {
    return { ok: false, error: 'Sign in with GitHub before joining a team.' }
  }
  return {
    ok: true,
    session: {
      ...session,
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
