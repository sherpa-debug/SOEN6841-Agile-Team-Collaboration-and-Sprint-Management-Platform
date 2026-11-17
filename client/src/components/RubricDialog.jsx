import { useEffect, useState } from 'react'
import { nextCriterionId } from '../lib/rubric.js'

// Enter the course rubric once: add, rename or remove criteria.
export default function RubricDialog({ criteria, onSave, onCancel }) {
  const [list, setList] = useState(criteria)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  function rename(id, name) {
    setList((current) => current.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  function remove(id) {
    setList((current) => current.filter((c) => c.id !== id))
  }

  function add() {
    const name = newName.trim()
    if (!name) return
    setList((current) => [...current, { id: nextCriterionId(criteria, current), name }])
    setNewName('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave(list)
  }

  return (
    <div className="overlay dialog-overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rubric-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="rubric-title">Rubric criteria</h2>
        <p className="hint">Enter your course rubric once. Each task can then be tagged with these criteria.</p>

        <ul className="rubric-list">
          {list.map((criterion) => (
            <li key={criterion.id}>
              <input
                value={criterion.name}
                onChange={(e) => rename(criterion.id, e.target.value)}
                aria-label="Criterion name"
                maxLength={40}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => remove(criterion.id)}
                aria-label={`Remove ${criterion.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <div className="rubric-add">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="New criterion, e.g. Documentation"
            aria-label="New criterion"
            maxLength={40}
          />
          <button type="button" className="secondary-button" onClick={add} disabled={!newName.trim()}>
            Add
          </button>
        </div>

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Save rubric
          </button>
        </div>
      </form>
    </div>
  )
}
