export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// A local demo session for when the API is not running (the seeded SprintProof team).
// It is never saved or sent anywhere, and it is not a real sign-in.
export const DEMO_SESSION = Object.freeze({
  githubId: 'demo',
  login: 'demo',
  name: 'Demo user',
  avatarUrl: null,
  role: 'student',
  team: Object.freeze({ id: 'sprintproof', name: 'SprintProof Team' }),
  demo: true,
})
