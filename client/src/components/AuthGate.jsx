import { useState } from 'react'
import { normalizeInviteCode } from '../lib/auth.js'
import { apiRequest } from '../lib/api.js'

export default function AuthGate({ session, onSessionChange, initialError = '' }) {
  const params = new URLSearchParams(window.location.search)
  const [inviteCode, setInviteCode] = useState(() => params.get('invite') || '')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState(() => initialError || (
    params.has('authError') ? 'GitHub sign-in was cancelled or could not be completed.' : ''
  ))
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleGitHubSignIn() {
    setError('')
    const returnTo = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`)
  }

  async function handleJoin(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const { session: nextSession } = await apiRequest('/api/teams/join', {
        method: 'POST',
        body: { code: normalizeInviteCode(inviteCode) },
      })
      onSessionChange(nextSession)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const { session: nextSession } = await apiRequest('/api/teams', {
        method: 'POST',
        body: { name: teamName },
      })
      onSessionChange(nextSession)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOut() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      onSessionChange(null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-logo">SprintProof</div>
          <h1 id="auth-title">Welcome to SprintProof</h1>
          <p>Sign in with GitHub to track and manage your team's sprint work.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="button" className="github-button" onClick={handleGitHubSignIn}>
            <span className="github-mark" aria-hidden="true">GH</span>
            Sign in with GitHub
          </button>
        </section>
      </main>
    )
  }

  if (!session.team) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="join-title">
          <div className="auth-user">
            {session.avatarUrl ? (
              <img src={session.avatarUrl} alt="" />
            ) : (
              <span>{session.name.slice(0, 2).toUpperCase() || 'GH'}</span>
            )}
            <div>
              <strong>{session.name}</strong>
              <small>@{session.login}</small>
            </div>
          </div>
          <h1 id="join-title">Join or create a team</h1>
          <p>Use an invitation shared by a teammate, or start a new team.</p>
          <form className="invite-form" onSubmit={handleJoin}>
            <label htmlFor="invite-code">Invitation code</label>
            <input
              id="invite-code"
              name="inviteCode"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(event.target.value)
                setError('')
              }}
              placeholder="Paste an invitation code"
              autoComplete="off"
              autoCapitalize="characters"
              required
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Joining…' : 'Join team'}
            </button>
          </form>
          <div className="auth-divider"><span>or create a team</span></div>
          <form className="invite-form" onSubmit={handleCreateTeam}>
            <label htmlFor="team-name">Team name</label>
            <input
              id="team-name"
              name="teamName"
              className="team-name-input"
              value={teamName}
              onChange={(event) => {
                setTeamName(event.target.value)
                setError('')
              }}
              minLength={2}
              maxLength={60}
              placeholder="e.g. Product team"
              required
            />
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create team'}
            </button>
          </form>
          <button type="button" className="link-button auth-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </section>
      </main>
    )
  }

  return null
}
