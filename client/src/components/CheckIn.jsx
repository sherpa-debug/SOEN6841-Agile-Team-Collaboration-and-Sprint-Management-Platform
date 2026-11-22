import { useState } from 'react'
import Avatar from './Avatar.jsx'
import { checkinState, MAX_COMMENT, myEntries, teammatesOf } from '../lib/checkin.js'

// "2026-11-22" -> "Nov 22"
function formatDay(value) {
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Five clickable stars (a radio group, so it also works with the keyboard)
function StarRating({ name, value, onChange, disabled }) {
  return (
    <div className="stars" role="radiogroup" aria-label={`Rating for ${name}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={`star${value >= n ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
          <input
            type="radio"
            className="visually-hidden"
            name={`rating-${name}`}
            value={n}
            checked={value === n}
            disabled={disabled}
            onChange={() => onChange(n)}
          />
          <span aria-hidden="true">★</span>
          <span className="visually-hidden">
            {n} out of 5
          </span>
        </label>
      ))}
    </div>
  )
}

// Peer check-in (FR8, D3 Fig. 7): one rating and one comment for each teammate, once per sprint
export default function CheckIn({ sprint, members, currentUserId, checkins, locked = false, onSave }) {
  const saved = sprint ? myEntries(checkins, sprint.id, currentUserId) : {}
  const [entries, setEntries] = useState(saved)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  if (!sprint) {
    return (
      <div className="dash-empty">
        <h1>Peer check-in</h1>
        <p className="muted">Choose a sprint in the top bar to fill in its check-in.</p>
      </div>
    )
  }

  const teammates = teammatesOf(members, currentUserId)
  const state = checkinState(sprint)
  const savedValues = Object.values(saved)
  const isSubmitted = savedValues.length > 0 && savedValues.every((e) => e.status === 'submitted')
  const submittedOn = isSubmitted ? savedValues[0].updatedAt : null
  const readOnly = locked || state !== 'open'

  function update(id, changes) {
    setEntries((current) => ({ ...current, [id]: { ...current[id], ...changes } }))
    setErrors((current) => ({ ...current, [id]: undefined }))
    setMessage('')
  }

  function save(submit) {
    const result = onSave(entries, submit)
    setErrors(result)
    if (Object.keys(result).length > 0) {
      setMessage('Please complete the highlighted rows.')
    } else {
      setMessage(submit ? 'Check-in submitted. Thank you!' : 'Draft saved.')
    }
  }

  return (
    <section className="checkin-card" aria-labelledby="checkin-title">
      <div className="checkin-head">
        <div>
          <h1 id="checkin-title">Sprint {sprint.number} peer check-in</h1>
          <p className="muted">
            One rating and one comment for each teammate. Closes at the end of Sprint {sprint.number} (
            {formatDay(sprint.end)}).
          </p>
        </div>
        <span className="time-pill">about 2 minutes</span>
      </div>

      {locked && (
        <p className="notice" role="note">
          TAs and instructors have read-only access, so they cannot fill in a check-in.
        </p>
      )}
      {state === 'not_open' && (
        <p className="notice" role="note">
          This check-in opens on {formatDay(sprint.start)}, when Sprint {sprint.number} starts.
        </p>
      )}
      {state === 'closed' && (
        <p className="notice" role="note">
          This check-in closed on {formatDay(sprint.end)}. It can no longer be changed.
        </p>
      )}
      {state === 'open' && isSubmitted && !message && (
        <p className="success-note" role="status">
          ✓ Submitted on {formatDay(submittedOn)}. You can update it until {formatDay(sprint.end)}.
        </p>
      )}

      <p className="muted checkin-privacy">
        Teammates see the average rating and the comments, not who wrote them.
      </p>

      <ul className="checkin-list">
        {teammates.map((mate) => {
          const entry = entries[mate.id] ?? {}
          const error = errors[mate.id]
          return (
            <li key={mate.id} className={`checkin-row${error ? ' has-error' : ''}`}>
              <span className="member-cell">
                <Avatar member={mate} />
                {mate.name}
              </span>
              <StarRating
                name={mate.name}
                value={entry.rating ?? 0}
                disabled={readOnly}
                onChange={(rating) => update(mate.id, { rating })}
              />
              <div className="checkin-comment">
                <input
                  value={entry.comment ?? ''}
                  onChange={(e) => update(mate.id, { comment: e.target.value })}
                  placeholder={`What did ${mate.name} contribute?`}
                  aria-label={`Comment for ${mate.name}`}
                  aria-invalid={Boolean(error)}
                  maxLength={MAX_COMMENT}
                  disabled={readOnly}
                />
                {error && <p className="field-error">{error}</p>}
              </div>
            </li>
          )
        })}
      </ul>

      {!readOnly && (
        <div className="checkin-actions">
          {message && (
            <p className={Object.keys(errors).some((k) => errors[k]) ? 'field-error' : 'success-text'} role="status">
              {message}
            </p>
          )}
          {!isSubmitted && (
            <button type="button" className="secondary-button" onClick={() => save(false)}>
              Save draft
            </button>
          )}
          <button type="button" className="primary-button" onClick={() => save(true)}>
            {isSubmitted ? 'Update check-in' : 'Submit check-in'}
          </button>
        </div>
      )}
    </section>
  )
}
