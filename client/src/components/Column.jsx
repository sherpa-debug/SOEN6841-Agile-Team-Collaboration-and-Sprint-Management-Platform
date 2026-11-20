import { useState } from 'react'
import TaskCard from './TaskCard.jsx'

// One column. Cards can be dragged and dropped here to change their status.
export default function Column({ status, tasks, criteria, aiCounts, workCounts, onOpen, onMove }) {
  const [isOver, setIsOver] = useState(false)

  function handleDragOver(event) {
    event.preventDefault()
    setIsOver(true)
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOver(false)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsOver(false)
    const key = event.dataTransfer.getData('text/plain')
    if (key) onMove(key, status.id)
  }

  return (
    <section
      className={`column${isOver ? ' is-over' : ''}`}
      aria-label={status.label}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="column-header">
        <span className={`status-dot status-${status.id}`} aria-hidden="true" />
        <h2>{status.label}</h2>
        <span className="count">{tasks.length}</span>
      </header>

      <div className="column-body">
        {tasks.length === 0 ? (
          <p className="empty">No tasks</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.key}
              task={task}
              criteria={criteria}
              aiCount={aiCounts[task.key] ?? 0}
              workCount={workCounts[task.key]}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  )
}
