import { useEffect, useState } from 'react'
import './App.css'
import TopBar from './components/TopBar.jsx'
import Board from './components/Board.jsx'
import RubricCoverage from './components/RubricCoverage.jsx'
import TaskPanel from './components/TaskPanel.jsx'
import NewTaskDialog from './components/NewTaskDialog.jsx'
import RubricDialog from './components/RubricDialog.jsx'
import Dashboard from './components/Dashboard.jsx'
import CheckIn from './components/CheckIn.jsx'
import { CURRENT_USER_ID, MEMBERS, SAMPLE_AI_LOG, SAMPLE_CRITERIA, SAMPLE_TASKS, SPRINTS } from './data/sampleData.js'
import { SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS } from './data/sampleWork.js'
import { linkWork } from './lib/contribution.js'
import { createTask, loadTasks, nextKey, saveTasks, updateTask } from './lib/tasks.js'
import {
  cleanCriteria,
  loadCriteria,
  removeMissingCriteria,
  rubricCoverage,
  saveCriteria,
  toggleCriterion,
} from './lib/rubric.js'
import { addAiEntry, aiCount, aiCountByTask, entriesForTask, loadAiLog, removeAiEntry, saveAiLog } from './lib/aiLog.js'
import { loadCheckins, saveCheckinForm, saveCheckins, teammatesOf } from './lib/checkin.js'

const BACKLOG = 'backlog'

// Which page to show, from the address: #board, #dashboard or #checkin
const VIEWS = ['board', 'dashboard', 'checkin']
function viewFromHash() {
  const view = window.location.hash.replace('#', '')
  return VIEWS.includes(view) ? view : 'board'
}

// "2026-11-09" -> "Nov 9"
function formatDay(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks(SAMPLE_TASKS))
  const [criteria, setCriteria] = useState(() => loadCriteria(SAMPLE_CRITERIA))
  const [aiLog, setAiLog] = useState(() => loadAiLog(SAMPLE_AI_LOG))
  const [checkins, setCheckins] = useState(() => loadCheckins([])) // peer check-ins (FR8)
  const [sprintId, setSprintId] = useState(SPRINTS[0].id) // a sprint id, or 'backlog'
  const [openKey, setOpenKey] = useState(null) // task shown in the side panel
  const [isCreating, setIsCreating] = useState(false) // "New task" dialog open?
  const [isEditingRubric, setIsEditingRubric] = useState(false) // "Edit rubric" dialog open?
  const [view, setView] = useState(viewFromHash) // 'board', 'dashboard' or 'checkin'

  // Follow the Board / Dashboard / Check-in links (and the browser's back button)
  useEffect(() => {
    const handleHash = () => {
      setView(viewFromHash())
      setOpenKey(null)
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // Save every change (T2: a task keeps its key and status after a reload)
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    saveCriteria(criteria)
  }, [criteria])

  useEffect(() => {
    saveAiLog(aiLog)
  }, [aiLog])

  useEffect(() => {
    saveCheckins(checkins)
  }, [checkins])

  const sprint = SPRINTS.find((s) => s.id === sprintId)
  const visibleTasks = tasks.filter((t) => (sprintId === BACKLOG ? t.sprintId == null : t.sprintId === sprintId))
  const totalPoints = visibleTasks.reduce((sum, t) => sum + t.points, 0)
  const donePoints = visibleTasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + t.points, 0)
  const openTask = tasks.find((t) => t.key === openKey)
  const coverage = rubricCoverage(tasks, criteria) // T3: which criteria have tasks
  const sprintAiCount = aiCount(aiLog, visibleTasks.map((t) => t.key)) // T6: the count
  const work = linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, tasks) // sample until GitHub sync (SP-9)

  function handleCreate(fields) {
    setTasks((current) => createTask(current, { ...fields, sprintId: sprintId === BACKLOG ? null : sprintId }))
    setIsCreating(false)
  }

  function handleUpdate(key, changes) {
    setTasks((current) => updateTask(current, key, changes))
  }

  function handleToggleCriterion(key, criterionId) {
    setTasks((current) => toggleCriterion(current, key, criterionId))
  }

  function handleAddAi(taskKey, fields) {
    setAiLog((current) => addAiEntry(current, { ...fields, taskKey }))
  }

  function handleRemoveAi(id) {
    setAiLog((current) => removeAiEntry(current, id))
  }

  // Save a draft or submit the check-in; returns the problems to show (none when saved)
  function handleSaveCheckin(entries, submit) {
    const result = saveCheckinForm(checkins, {
      sprintId: sprint.id,
      raterId: CURRENT_USER_ID, // from GitHub sign-in once it is connected
      teammates: teammatesOf(MEMBERS, CURRENT_USER_ID),
      entries,
      submit,
    })
    setCheckins(result.checkins)
    return result.errors
  }

  function handleSaveRubric(list) {
    const cleaned = cleanCriteria(list)
    setCriteria(cleaned)
    setTasks((current) => removeMissingCriteria(current, cleaned))
    setIsEditingRubric(false)
  }

  function handleSprintChange(id) {
    setSprintId(id)
    setOpenKey(null)
  }

  return (
    <>
      <TopBar view={view} sprintId={sprintId} onSprintChange={handleSprintChange} />

      {view === 'dashboard' && (
        <main className="page">
          <Dashboard sprint={sprint} tasks={tasks} work={work} aiLog={aiLog} criteria={criteria} checkins={checkins} />
        </main>
      )}

      {view === 'checkin' && (
        <main className="page">
          <CheckIn
            key={sprintId}
            sprint={sprint}
            members={MEMBERS}
            currentUserId={CURRENT_USER_ID}
            checkins={checkins}
            onSave={handleSaveCheckin}
          />
        </main>
      )}

      {view === 'board' && (
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
            <span className="pill pill--ai">
              {sprintAiCount} AI log {sprintAiCount === 1 ? 'entry' : 'entries'}
            </span>
            <button type="button" className="primary-button new-task" onClick={() => setIsCreating(true)}>
              + New task
            </button>
          </div>

          <RubricCoverage coverage={coverage} onEdit={() => setIsEditingRubric(true)} />

          <Board
            tasks={visibleTasks}
            criteria={criteria}
            aiCounts={aiCountByTask(aiLog)}
            onOpen={setOpenKey}
            onMove={(key, status) => handleUpdate(key, { status })}
          />
        </main>
      )}

      {openTask && (
        <TaskPanel
          task={openTask}
          criteria={criteria}
          onChange={(changes) => handleUpdate(openTask.key, changes)}
          onToggleCriterion={(criterionId) => handleToggleCriterion(openTask.key, criterionId)}
          aiEntries={entriesForTask(aiLog, openTask.key)}
          onAddAi={(fields) => handleAddAi(openTask.key, fields)}
          onRemoveAi={handleRemoveAi}
          onClose={() => setOpenKey(null)}
        />
      )}

      {isCreating && (
        <NewTaskDialog
          nextKey={nextKey(tasks)}
          criteria={criteria}
          onCreate={handleCreate}
          onCancel={() => setIsCreating(false)}
        />
      )}

      {isEditingRubric && (
        <RubricDialog criteria={criteria} onSave={handleSaveRubric} onCancel={() => setIsEditingRubric(false)} />
      )}
    </>
  )
}
