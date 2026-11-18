import Avatar from './Avatar.jsx'
import { MEMBERS } from '../data/sampleData.js'

// One task card. Click (or Enter) opens the task; drag moves it to another column.
export default function TaskCard({ task, criteria, onOpen }) {
  const assignee = MEMBERS.find((m) => m.id === task.assigneeId)
  const tags = criteria.filter((c) => (task.criteria ?? []).includes(c.id))

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(task.key)
    }
  }

  function handleDragStart(event) {
    event.dataTransfer.setData('text/plain', task.key)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <article
      className="card"
      role="button"
      tabIndex={0}
      draggable
      aria-label={`${task.key}: ${task.title}`}
      data-key={task.key}
      onClick={() => onOpen(task.key)}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
    >
      <span className="card-key">{task.key}</span>
      <h3 className="card-title">{task.title}</h3>
      <div className="card-footer">
        {tags.length === 0 && <span className="tag tag--empty">No rubric tag</span>}
        {tags.slice(0, 2).map((c) => (
          <span key={c.id} className="tag">
            {c.name}
          </span>
        ))}
        {tags.length > 2 && <span className="tag tag--more">+{tags.length - 2}</span>}
        <span className="points">{task.points} pts</span>
        <Avatar member={assignee} />
      </div>
    </article>
  )
}
