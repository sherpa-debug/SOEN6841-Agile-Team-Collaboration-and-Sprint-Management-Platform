import { useState } from 'react'
import { AI_TOOLS, CURRENT_USER_ID, MEMBERS } from '../data/sampleData.js'

// "2026-11-17" -> "Nov 17"
function formatDay(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Small form to log one use of AI on this task
function AiEntryForm({ onSave, onCancel }) {
  const [tool, setTool] = useState('')
  const [purpose, setPurpose] = useState('')
  const [userId, setUserId] = useState(CURRENT_USER_ID)
  const [verified, setVerified] = useState(false)
  const [check, setCheck] = useState('')
  const canSave = tool.trim() && purpose.trim()

  function handleSubmit(event) {
    event.preventDefault()
    if (canSave) onSave({ tool, purpose, userId, verified, check })
  }

  return (
    <form className="ai-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Tool</span>
        <input
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          list="ai-tools"
          placeholder="e.g. Claude"
          maxLength={40}
          required
          autoFocus
        />
        <datalist id="ai-tools">
          {AI_TOOLS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>What for</span>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. First draft of the task card"
          maxLength={120}
          required
        />
      </label>

      <label className="field">
        <span>Who used it</span>
        <select value={userId} onChange={(e) => setUserId(Number(e.target.value))}>
          {MEMBERS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        The result was checked
      </label>

      {verified && (
        <label className="field">
          <span>How was it checked?</span>
          <input
            value={check}
            onChange={(e) => setCheck(e.target.value)}
            placeholder="e.g. Tests pass, reviewed by Ming"
            maxLength={120}
          />
        </label>
      )}

      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={!canSave}>
          Save entry
        </button>
      </div>
    </form>
  )
}

// The AI log of one task, shown in the task panel
export default function AiLogSection({ entries, readOnly = false, onAdd, onRemove }) {
  const [isAdding, setIsAdding] = useState(false)

  return (
    <div className="panel-section">
      <div className="section-head">
        <h3 className="section-label">
          AI log <span className="ai-count">{entries.length}</span>
        </h3>
        {!isAdding && !readOnly && (
          <button type="button" className="link-button" onClick={() => setIsAdding(true)}>
            + Log AI use
          </button>
        )}
      </div>

      {isAdding && !readOnly && (
        <AiEntryForm
          onSave={(fields) => {
            onAdd(fields)
            setIsAdding(false)
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {entries.length === 0 && !isAdding && <p className="muted">No AI use logged for this task.</p>}

      <ul className="ai-list">
        {entries.map((entry) => {
          const member = MEMBERS.find((m) => m.id === entry.userId)
          return (
            <li key={entry.id} className="ai-entry">
              <div className="ai-entry-head">
                <p>
                  <strong>{entry.tool}</strong> · {entry.purpose}
                </p>
                {!readOnly && (
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    onClick={() => onRemove(entry.id)}
                    aria-label={`Remove AI entry: ${entry.purpose}`}
                  >
                    ×
                  </button>
                )}
              </div>
              <p className={`ai-check ${entry.verified ? 'is-ok' : 'is-warn'}`}>
                {entry.verified ? `Checked: ${entry.check || 'yes'}` : 'Not checked yet'}
              </p>
              <p className="ai-meta">
                {member ? member.name : 'Unknown'} · {formatDay(entry.createdAt)}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
