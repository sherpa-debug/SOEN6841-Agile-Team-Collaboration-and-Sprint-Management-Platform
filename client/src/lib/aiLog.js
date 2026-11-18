// AI log on tasks (FR6, test T6): which tool, what for, and whether the result was checked.
import { loadJSON, saveJSON } from './storage.js'

const STORAGE_KEY = 'sprintproof.ai.v1'

export function loadAiLog(fallback, storage) {
  const saved = loadJSON(STORAGE_KEY, null, storage)
  return Array.isArray(saved) ? saved : fallback
}

export function saveAiLog(log, storage) {
  saveJSON(STORAGE_KEY, log, storage)
}

// Today's date as "2026-11-17" (local time)
export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Add one entry. An entry needs a task, a tool and a purpose; otherwise nothing is added.
export function addAiEntry(log, fields, date = today()) {
  const tool = (fields.tool ?? '').trim()
  const purpose = (fields.purpose ?? '').trim()
  if (!fields.taskKey || !tool || !purpose) return log

  const id = Math.max(0, ...log.map((entry) => entry.id)) + 1
  const verified = Boolean(fields.verified)
  const entry = {
    id,
    taskKey: fields.taskKey,
    userId: fields.userId ?? null,
    tool,
    purpose,
    verified,
    check: verified ? (fields.check ?? '').trim() : '',
    createdAt: date,
  }
  return [...log, entry]
}

export function removeAiEntry(log, id) {
  return log.filter((entry) => entry.id !== id)
}

// Entries for one task
export function entriesForTask(log, taskKey) {
  return log.filter((entry) => entry.taskKey === taskKey)
}

// Number of entries for a group of tasks (for example, the tasks of one sprint)
export function aiCount(log, taskKeys) {
  const keys = new Set(taskKeys)
  return log.filter((entry) => keys.has(entry.taskKey)).length
}

// { 'SP-2': 1, 'SP-6': 2, ... } for the badges on the cards
export function aiCountByTask(log) {
  const counts = {}
  for (const entry of log) counts[entry.taskKey] = (counts[entry.taskKey] ?? 0) + 1
  return counts
}
