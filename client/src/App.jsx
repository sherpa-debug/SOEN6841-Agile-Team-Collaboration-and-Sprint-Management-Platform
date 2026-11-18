import { useEffect, useState } from 'react'
import './App.css'
import TopBar from './components/TopBar.jsx'
import Board from './components/Board.jsx'
import TaskPanel from './components/TaskPanel.jsx'
import NewTaskDialog from './components/NewTaskDialog.jsx'
import { SAMPLE_TASKS, SPRINTS } from './data/sampleData.js'
import { createTask, loadTasks, nextKey, saveTasks, updateTask } from './lib/tasks.js'

const BACKLOG = 'backlog'

// "2026-11-09" -> "Nov 9"
function formatDay(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks(SAMPLE_TASKS))
  const [sprintId, setSprintId] = useState(SPRINTS[0].id) // a sprint id, or 'backlog'
  const [openKey, setOpenKey] = useState(null) // task shown in the side panel
  const [isCreating, setIsCreating] = useState(false) // "New task" dialog open?

  // Save every change (T2: a task keeps its key and status after a reload)
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  const sprint = SPRINTS.find((s) => s.id === sprintId)
  const visibleTasks = tasks.filter((t) => (sprintId === BACKLOG ? t.sprintId == null : t.sprintId === sprintId))
  const totalPoints = visibleTasks.reduce((sum, t) => sum + t.points, 0)
  const donePoints = visibleTasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + t.points, 0)
  const openTask = tasks.find((t) => t.key === openKey)

  function handleCreate(fields) {
    setTasks((current) => createTask(current, { ...fields, sprintId: sprintId === BACKLOG ? null : sprintId }))
    setIsCreating(false)
  }

  function handleUpdate(key, changes) {
    setTasks((current) => updateTask(current, key, changes))
  }

  function handleSprintChange(id) {
    setSprintId(id)
    setOpenKey(null)
  }

  return (
    <>
      <TopBar sprintId={sprintId} onSprintChange={handleSprintChange} />

      <main className="page">
        <div className="page-head">
          <div className="page-title">
            <h1>{sprint ? `Sprint ${sprint.number}` : 'Backlog'}</h1>
            {sprint && (
              <span className="dates">
                {formatDay(sprint.start)} – {formatDay(sprint.end)}
              </span>
            )}
          </div>
          <span className="progress">
            {donePoints} / {totalPoints} pts done
          </span>
          <button type="button" className="primary-button new-task" onClick={() => setIsCreating(true)}>
            + New task
          </button>
        </div>

        <Board tasks={visibleTasks} onOpen={setOpenKey} onMove={(key, status) => handleUpdate(key, { status })} />
      </main>

      {openTask && (
        <TaskPanel
          task={openTask}
          onChange={(changes) => handleUpdate(openTask.key, changes)}
          onClose={() => setOpenKey(null)}
        />
      )}

      {isCreating && (
        <NewTaskDialog nextKey={nextKey(tasks)} onCreate={handleCreate} onCancel={() => setIsCreating(false)} />
      )}
    </>
  )
}
