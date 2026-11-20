import { useEffect } from 'react'
import CriteriaPicker from './CriteriaPicker.jsx'
import AiLogSection from './AiLogSection.jsx'
import LinkedWork from './LinkedWork.jsx'
import { MEMBERS, POINT_OPTIONS, SPRINTS, STATUSES, TASK_TYPES } from '../data/sampleData.js'

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

// Side panel with the details of one task. Every change is saved at once.
export default function TaskPanel({
  task,
  criteria,
  aiEntries,
  linkedWork,
  onChange,
  onToggleCriterion,
  onAddAi,
  onRemoveAi,
  onClose,
}) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <aside
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <span className="card-key">{task.key}</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" autoFocus>
            ×
          </button>
        </div>
        <h2 id="panel-title">{task.title}</h2>

        <div className="field-grid">
          <Field label="Status">
            <select value={task.status} onChange={(e) => onChange({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sprint">
            <select
              value={task.sprintId ?? 'backlog'}
              onChange={(e) => onChange({ sprintId: e.target.value === 'backlog' ? null : Number(e.target.value) })}
            >
              {SPRINTS.map((s) => (
                <option key={s.id} value={s.id}>
                  Sprint {s.number}
                </option>
              ))}
              <option value="backlog">Backlog</option>
            </select>
          </Field>

          <Field label="Assignee">
            <select
              value={task.assigneeId ?? ''}
              onChange={(e) => onChange({ assigneeId: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Unassigned</option>
              {MEMBERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Story points">
            <select value={task.points} onChange={(e) => onChange({ points: Number(e.target.value) })}>
              {POINT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type">
            <select value={task.type} onChange={(e) => onChange({ type: e.target.value })}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="panel-section">
          <h3 className="section-label">Rubric criteria</h3>
          <CriteriaPicker criteria={criteria} selected={task.criteria ?? []} onToggle={onToggleCriterion} />
        </div>

        <LinkedWork taskKey={task.key} items={linkedWork} />

        <AiLogSection entries={aiEntries} onAdd={onAddAi} onRemove={onRemoveAi} />
      </aside>
    </div>
  )
}
