import { useEffect } from 'react'
import { MEMBERS } from '../data/sampleData.js'

// "2026-11-17T18:30" -> "Nov 17, 18:30"
function formatWhen(value) {
  const d = new Date(value)
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return value.includes('T') ? `${day}, ${time}` : day
}

const memberName = (id) => MEMBERS.find((m) => m.id === id)?.name ?? 'Unknown'

function TaskItem({ task, criteria }) {
  const tags = criteria.filter((c) => (task.criteria ?? []).includes(c.id)).map((c) => c.name)
  return (
    <>
      <p className="drill-main">
        <strong>{task.key}</strong> · {task.title}
      </p>
      <p className="drill-meta">
        {task.points} pts · {memberName(task.assigneeId)}
        {tags.length > 0 && ` · ${tags.join(', ')}`}
      </p>
    </>
  )
}

function WorkItem({ item }) {
  return (
    <>
      <p className="drill-main">
        <span className={`work-kind work-kind--${item.kind}`}>{item.kind === 'pr' ? 'PR' : 'Commit'}</span>{' '}
        <code>{item.id}</code> {item.label}
      </p>
      <p className="drill-meta">
        {memberName(item.authorId)} · {formatWhen(item.date)} ·{' '}
        {item.taskKey ? `linked to ${item.taskKey}` : <span className="unlinked">not linked to a task</span>}
      </p>
    </>
  )
}

function AiItem({ entry }) {
  return (
    <>
      <p className="drill-main">
        <strong>{entry.tool}</strong> · {entry.purpose}
      </p>
      <p className="drill-meta">
        {entry.taskKey} · {memberName(entry.userId)} · {entry.verified ? `checked: ${entry.check || 'yes'}` : 'not checked yet'}
      </p>
    </>
  )
}

// Side panel listing exactly the items behind a number (NFR5, test T14)
export default function DrillDown({ drill, criteria, onClose }) {
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
        aria-labelledby="drill-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <span className="card-key">{drill.subtitle}</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" autoFocus>
            ×
          </button>
        </div>
        <h2 id="drill-title">{drill.title}</h2>
        <p className="muted drill-count">
          {drill.items.length} {drill.items.length === 1 ? 'item' : 'items'} counted
        </p>

        {drill.items.length === 0 ? (
          <p className="muted">Nothing counted yet.</p>
        ) : (
          <ul className="drill-list">
            {drill.items.map((item) => (
              <li key={`${drill.type}-${item.key ?? item.id}`} className="drill-item">
                {drill.type === 'task' && <TaskItem task={item} criteria={criteria} />}
                {drill.type === 'work' && <WorkItem item={item} />}
                {drill.type === 'ai' && <AiItem entry={item} />}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
