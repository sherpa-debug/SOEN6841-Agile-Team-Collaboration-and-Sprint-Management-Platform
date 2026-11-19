// Contribution measures per member and sprint (FR5, FR9), with the exact items behind
// each number (NFR5, test T14). Stand-in for the server's contribution engine (SP-4)
// until its API is ready: the screen will then read the same shape from the API.
import { peerRating } from './checkin.js'

const KEY_PATTERN = /\bSP-(\d+)\b/i
export const LATE_WINDOW = 0.2 // the last 20% of the sprint
export const LATE_FLAG_AT = 0.5 // flag a member when half or more of their activity is late

// "SP-12 add chart" -> "SP-12" (or null when there is no key)
export function findKey(text) {
  const match = KEY_PATTERN.exec(text ?? '')
  return match ? `SP-${match[1]}` : null
}

// Sprint start, end, and the moment the "last 20%" begins
export function sprintWindow(sprint) {
  const start = new Date(`${sprint.start}T00:00:00`)
  const end = new Date(`${sprint.end}T23:59:59`)
  const lateFrom = new Date(end.getTime() - (end.getTime() - start.getTime()) * LATE_WINDOW)
  return { start, end, lateFrom }
}

function inWindow(date, window) {
  const d = new Date(date)
  return d >= window.start && d <= window.end
}

const sumPoints = (tasks) => tasks.reduce((sum, t) => sum + (t.points ?? 0), 0)

// Commits and PRs become work items, linked to a task by the key in their message or title
export function linkWork(commits, pullRequests, tasks) {
  const keys = new Set(tasks.map((t) => t.key))
  const items = [
    ...commits.map((c) => ({ kind: 'commit', id: c.sha.slice(0, 7), label: c.message, authorId: c.authorId, date: c.date })),
    ...pullRequests.map((p) => ({ kind: 'pr', id: `#${p.number}`, label: p.title, authorId: p.authorId, date: p.date })),
  ]
  return items.map((item) => {
    const key = findKey(item.label)
    return { ...item, taskKey: key && keys.has(key) ? key : null }
  })
}

// The six measures of one member in one sprint. Each measure keeps the items it counted.
export function memberMeasures({ member, sprint, tasks, work, aiLog, checkins = [] }) {
  const window = sprintWindow(sprint)
  const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id)
  const sprintKeys = new Set(sprintTasks.map((t) => t.key))

  const done = sprintTasks.filter((t) => t.assigneeId === member.id && t.status === 'done')
  const myWork = work.filter((w) => w.authorId === member.id && inWindow(w.date, window))
  const linked = myWork.filter((w) => w.taskKey)
  const lateItems = myWork.filter((w) => new Date(w.date) >= window.lateFrom)
  const lateShare = myWork.length ? lateItems.length / myWork.length : 0

  return {
    // 1. Story points of the member's finished tasks
    storyPoints: { value: sumPoints(done), items: done },
    // 2. Commits and PRs linked to a task
    commits: { value: linked.filter((w) => w.kind === 'commit').length, items: linked.filter((w) => w.kind === 'commit') },
    prs: { value: linked.filter((w) => w.kind === 'pr').length, items: linked.filter((w) => w.kind === 'pr') },
    // 3. Finished tasks tagged with at least one rubric criterion
    rubricTasks: { value: done.filter((t) => (t.criteria ?? []).length > 0).length, items: done.filter((t) => (t.criteria ?? []).length > 0) },
    // 4. AI log entries on this sprint's tasks
    aiEntries: {
      value: aiLog.filter((e) => e.userId === member.id && sprintKeys.has(e.taskKey)).length,
      items: aiLog.filter((e) => e.userId === member.id && sprintKeys.has(e.taskKey)),
    },
    // 5. Average peer rating from submitted check-ins (FR8)
    peerRating: peerRating(checkins, sprint.id, member.id),
    // 6. Share of commits and PRs made in the last 20% of the sprint (FR9)
    lateShare: {
      value: lateShare,
      items: lateItems,
      total: myWork.length,
      flagged: myWork.length > 0 && lateShare >= LATE_FLAG_AT,
    },
  }
}

// Team totals for the four tiles at the top
export function sprintSummary({ sprint, tasks, work, aiLog }) {
  const window = sprintWindow(sprint)
  const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id)
  const sprintKeys = new Set(sprintTasks.map((t) => t.key))
  const done = sprintTasks.filter((t) => t.status === 'done')
  const sprintWork = work.filter((w) => inWindow(w.date, window))

  return {
    pointsDone: { value: sumPoints(done), total: sumPoints(sprintTasks), items: done },
    linkedCommits: {
      value: sprintWork.filter((w) => w.kind === 'commit' && w.taskKey).length,
      items: sprintWork.filter((w) => w.kind === 'commit' && w.taskKey),
    },
    unlinked: { value: sprintWork.filter((w) => !w.taskKey).length, items: sprintWork.filter((w) => !w.taskKey) },
    aiEntries: {
      value: aiLog.filter((e) => sprintKeys.has(e.taskKey)).length,
      items: aiLog.filter((e) => sprintKeys.has(e.taskKey)),
    },
  }
}
