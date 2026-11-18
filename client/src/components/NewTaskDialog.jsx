import { useEffect, useState } from 'react'
import CriteriaPicker from './CriteriaPicker.jsx'
import { CURRENT_USER_ID, MEMBERS, POINT_OPTIONS, TASK_TYPES } from '../data/sampleData.js'

// Form to create a task. The key (SP-n) is given automatically.
export default function NewTaskDialog({ nextKey, criteria, onCreate, onCancel }) {
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState(3)
  const [assigneeId, setAssigneeId] = useState(CURRENT_USER_ID)
  const [type, setType] = useState('Implementation')
  const [tagged, setTagged] = useState([])
  const cleanTitle = title.trim()

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  function toggleTag(id) {
    setTagged((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!cleanTitle) return
    onCreate({ title: cleanTitle, points, assigneeId, type, criteria: tagged })
  }

  return (
    <div className="overlay dialog-overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="dialog-title">New task</h2>
        <p className="hint">
          This task will get the key <strong>{nextKey}</strong>.
        </p>

        <div className="field-grid">
          <label className="field full">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Task card component"
              maxLength={120}
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span>Assignee</span>
            <select
              value={assigneeId ?? ''}
              onChange={(e) => setAssigneeId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Unassigned</option>
              {MEMBERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Story points</span>
            <select value={points} onChange={(e) => setPoints(Number(e.target.value))}>
              {POINT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="field full">
            <span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div className="field full">
            <span>Rubric criteria</span>
            <CriteriaPicker criteria={criteria} selected={tagged} onToggle={toggleTag} />
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={!cleanTitle}>
            Create task
          </button>
        </div>
      </form>
    </div>
  )
}
