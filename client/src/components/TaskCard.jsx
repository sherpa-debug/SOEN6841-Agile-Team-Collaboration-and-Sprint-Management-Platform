import Avatar from './Avatar.jsx'
import { MEMBERS } from '../data/sampleData.js'

// One task card. Click (or Enter) opens the task; drag moves it to another column.
export default function TaskCard({ task, onOpen }) {
  const assignee = MEMBERS.find((m) => m.id === task.assigneeId)

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
        <span className="tag">{task.type}</span>
        <span className="points">{task.points} pts</span>
        <Avatar member={assignee} />
      </div>
    </article>
  )
}
