// Task logic, kept apart from the screens so it is easy to test (T2).
import { loadJSON, saveJSON } from './storage.js'

const STORAGE_KEY = 'sprintproof.tasks.v3'

// Read saved tasks. If nothing is saved (or it is unreadable), use the fallback.
export function loadTasks(fallback, storage) {
  const saved = loadJSON(STORAGE_KEY, null, storage)
  return Array.isArray(saved) ? saved : fallback
}

// Save tasks so they survive a page reload.
export function saveTasks(tasks, storage) {
  saveJSON(STORAGE_KEY, tasks, storage)
}

// Next free key: SP-1, SP-2 ... (one more than the highest number used)
export function nextKey(tasks) {
  const numbers = tasks.map((task) => Number(task.key.split('-')[1]) || 0)
  return `SP-${Math.max(0, ...numbers) + 1}`
}

// Add a new task with its own key. New tasks start in "To do".
export function createTask(tasks, fields) {
  const task = { status: 'todo', criteria: [], ...fields, key: nextKey(tasks) }
  return [...tasks, task]
}

// Change some fields of one task. The key can never change.
export function updateTask(tasks, key, changes) {
  return tasks.map((task) => (task.key === key ? { ...task, ...changes, key: task.key } : task))
}
