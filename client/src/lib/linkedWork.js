// Linked work (FR4, D3 Fig. 4): the commits and pull requests whose message or title
// carries a task's key, and the work in a sprint that carries no known key.
import { sprintWindow } from './contribution.js'

const newestFirst = (a, b) => new Date(b.date) - new Date(a.date)

// Commits and PRs linked to one task, newest first (shown in the task panel)
export function workForTask(work, taskKey) {
  return work.filter((w) => w.taskKey === taskKey).sort(newestFirst)
}

// { 'SP-2': { commits: 2, prs: 1 }, ... } for the line on each card
export function workCountsByTask(work) {
  const counts = {}
  for (const w of work) {
    if (!w.taskKey) continue
    counts[w.taskKey] ??= { commits: 0, prs: 0 }
    if (w.kind === 'pr') counts[w.taskKey].prs += 1
    else counts[w.taskKey].commits += 1
  }
  return counts
}

// Commits and PRs made during a sprint that no task key links to (the "Unlinked work" badge)
export function unlinkedInSprint(work, sprint) {
  const window = sprintWindow(sprint)
  return work
    .filter((w) => !w.taskKey && new Date(w.date) >= window.start && new Date(w.date) <= window.end)
    .sort(newestFirst)
}

// "2 commits · 1 PR" (or an empty string when nothing is linked)
export function describeWork(count) {
  if (!count) return ''
  const parts = []
  if (count.commits) parts.push(`${count.commits} ${count.commits === 1 ? 'commit' : 'commits'}`)
  if (count.prs) parts.push(`${count.prs} ${count.prs === 1 ? 'PR' : 'PRs'}`)
  return parts.join(' · ')
}
