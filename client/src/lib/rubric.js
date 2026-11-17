// Rubric criteria and task tagging (FR3, test T3).
import { loadJSON, saveJSON } from './storage.js'

const STORAGE_KEY = 'sprintproof.criteria.v1'

export function loadCriteria(fallback, storage) {
  const saved = loadJSON(STORAGE_KEY, null, storage)
  return Array.isArray(saved) ? saved : fallback
}

export function saveCriteria(criteria, storage) {
  saveJSON(STORAGE_KEY, criteria, storage)
}

// Tag a task with a criterion, or remove the tag if it is already there.
export function toggleCriterion(tasks, key, criterionId) {
  return tasks.map((task) => {
    if (task.key !== key) return task
    const current = task.criteria ?? []
    const criteria = current.includes(criterionId)
      ? current.filter((id) => id !== criterionId)
      : [...current, criterionId]
    return { ...task, criteria }
  })
}

// For each criterion: the tasks tagged with it, and whether it is covered.
export function rubricCoverage(tasks, criteria) {
  return criteria.map((criterion) => {
    const taskKeys = tasks.filter((task) => (task.criteria ?? []).includes(criterion.id)).map((task) => task.key)
    return { criterion, taskKeys, covered: taskKeys.length > 0 }
  })
}

// After a criterion is deleted, remove its tags from every task.
export function removeMissingCriteria(tasks, criteria) {
  const ids = new Set(criteria.map((c) => c.id))
  return tasks.map((task) => {
    const current = task.criteria ?? []
    const kept = current.filter((id) => ids.has(id))
    return kept.length === current.length ? task : { ...task, criteria: kept }
  })
}

// Tidy a rubric typed by the user: trim names, drop empty and repeated names.
export function cleanCriteria(list) {
  const seen = new Set()
  const result = []
  for (const item of list) {
    const name = item.name.trim()
    const id = name.toLowerCase()
    if (!name || seen.has(id)) continue
    seen.add(id)
    result.push({ ...item, name })
  }
  return result
}

// Next free criterion id (never reuses an id still used by old tags).
export function nextCriterionId(...lists) {
  const ids = lists.flat().map((c) => c.id)
  return Math.max(0, ...ids) + 1
}
