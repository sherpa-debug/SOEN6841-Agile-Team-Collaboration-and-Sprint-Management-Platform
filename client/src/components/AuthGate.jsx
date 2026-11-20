import { useState } from 'react'
import { createGitHubSession, joinTeam } from '../lib/auth.js'

export default function AuthGate({ session, onSessionChange }) {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('error')) {
      return 'GitHub sign-in was cancelled or could not be completed.'
    }
    if (params.has('code')) {
      return 'GitHub OAuth callback is not configured on this app. Use demo sign-in for now.'
    }
    return ''
  })

  function handleGitHubSignIn() {
    setError('')
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID

    if (clientId) {
      const redirectUri = `${window.location.origin}/auth/callback`
      const state = crypto.randomUUID()
      sessionStorage.setItem('github-oauth-state', state)
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'read:user read:org',
        state,
      })
      window.location.assign(`https://github.com/login/oauth/authorize?${params}`)
      return
    }

    const demoProfile = {
      id: 'demo-moncef',
      login: 'moncef',
      name: 'Moncef',
    }
    onSessionChange(createGitHubSession(demoProfile))
  }

  function handleJoin(event) {
    event.preventDefault()
    const result = joinTeam(inviteCode, session)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    onSessionChange(result.session)
  }

  function handleSignOut() {
    onSessionChange(null)
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-logo">SprintProof</div>
          <h1 id="auth-title">Welcome to SprintProof</h1>
          <p>Sign in with GitHub to track and manage your team's sprint work.</p>
          <button type="button" className="github-button" onClick={handleGitHubSignIn}>
            <span className="github-mark" aria-hidden="true">GH</span>
            Sign in with GitHub
          </button>
          {!import.meta.env.VITE_GITHUB_CLIENT_ID && (
            <p className="auth-hint">Demo mode — no GitHub credentials configured.</p>
          )}
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
          <h1 id="join-title">Join a team</h1>
          <p>Enter the invite code shared by a team member.</p>
          <form className="invite-form" onSubmit={handleJoin}>
            <label htmlFor="invite-code">Invite code</label>
            <input
              id="invite-code"
              name="inviteCode"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(event.target.value)
                setError('')
              }}
              placeholder="e.g. ALPHA24"
              autoComplete="off"
              autoCapitalize="characters"
              required
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button">Join team</button>
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
