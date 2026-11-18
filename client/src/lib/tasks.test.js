import { describe, it, expect } from 'vitest'
import { createTask, loadTasks, nextKey, saveTasks, updateTask } from './tasks.js'

// A fake browser storage, so the test runs without a browser
function fakeStorage() {
  const data = {}
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
  }
}

describe('T2: a task keeps its key and status after a reload', () => {
  it('saves a task and reads it back with the same key and status', () => {
    const storage = fakeStorage()
    let tasks = createTask([], { title: 'Task card', points: 3, assigneeId: 1, type: 'Design', sprintId: 1 })
    tasks = updateTask(tasks, 'SP-1', { status: 'in_progress' })
    saveTasks(tasks, storage)

    const afterReload = loadTasks([], storage) // a reload = reading the saved tasks again

    expect(afterReload).toHaveLength(1)
    expect(afterReload[0].key).toBe('SP-1')
    expect(afterReload[0].status).toBe('in_progress')
  })

  it('never changes a task key, even if an update tries to', () => {
    const tasks = createTask([], { title: 'Board' })
    const updated = updateTask(tasks, 'SP-1', { key: 'SP-99', status: 'done' })

    expect(updated[0].key).toBe('SP-1')
    expect(updated[0].status).toBe('done')
  })

  it('gives each new task the next key', () => {
    expect(nextKey([{ key: 'SP-1' }, { key: 'SP-15' }])).toBe('SP-16')
    expect(nextKey([])).toBe('SP-1')
  })

  it('uses the sample tasks when nothing is saved yet', () => {
    const sample = [{ key: 'SP-1', status: 'todo' }]
    expect(loadTasks(sample, fakeStorage())).toBe(sample)
  })
})