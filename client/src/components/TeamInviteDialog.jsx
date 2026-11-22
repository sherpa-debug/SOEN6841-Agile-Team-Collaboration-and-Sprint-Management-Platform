import { useState } from 'react'
import { apiRequest } from '../lib/api.js'

export default function TeamInviteDialog({ teamName, onClose }) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function createInvite() {
    setIsCreating(true)
    setError('')
    setCopied(false)
    try {
      const { code, expiresAt: expiry } = await apiRequest('/api/teams/invites', { method: 'POST' })
      const link = new URL('/', window.location.origin)
      link.searchParams.set('invite', code)
      setInviteUrl(link.toString())
      setExpiresAt(expiry)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsCreating(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setError('')
    } catch {
      setError('Could not copy the invitation. Select and copy the link instead.')
    }
  }

  return (
    <div className="overlay invite-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="dialog invite-dialog" role="dialog" aria-modal="true" aria-labelledby="team-invite-title">
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="team-invite-title">Invite to {teamName}</h2>
        <p>Invitation links expire after seven days. Anyone with the link can join.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!inviteUrl ? (
          <button type="button" className="primary-button" onClick={createInvite} disabled={isCreating}>
            {isCreating ? 'Creating link…' : 'Create invitation link'}
          </button>
        ) : (
          <div className="invite-link">
            <label htmlFor="generated-invite">Invitation link</label>
            <input id="generated-invite" value={inviteUrl} readOnly onFocus={(event) => event.target.select()} />
            <p>Expires {new Date(expiresAt).toLocaleString()}</p>
            <button type="button" className="primary-button" onClick={copyInvite}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="secondary-button" onClick={createInvite} disabled={isCreating}>
              Create another link
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
