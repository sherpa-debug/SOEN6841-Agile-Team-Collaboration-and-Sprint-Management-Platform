// Contribution measures per member and sprint (FR5, FR9), with the exact items behind
// each number (NFR5, test T14). Stand-in for the server's contribution engine (SP-4)
// until its API is ready: the screen will then read the same shape from the API.
import { peerRating } from './checkin.js'

// "SP-12" in a message, title or branch name. (?!\d) instead of a closing \b so that
// "tanzir/SP-12_chart" still matches: "_" counts as a word character and would break \b.
const keyPattern = () => /\bSP-(\d+)(?!\d)/gi
export const LATE_WINDOW = 0.2 // the last 20% of the sprint
export const LATE_FLAG_AT = 0.5 // flag a member when half or more of their activity is late

// Every key in a text, in order: "SP-3 and sp-5" -> ["SP-3", "SP-5"]
export function findKeys(text) {
  return [...String(text ?? '').matchAll(keyPattern())].map((m) => `SP-${m[1]}`)
}

// "SP-12 add chart" -> "SP-12" (or null when there is no key)
export function findKey(text) {
  return findKeys(text)[0] ?? null
}

// First key, over the texts in order, that belongs to a real task (or null).
// An unknown key (SP-99) does not stop the search: the next text may carry a known one.
export function resolveKey(texts, knownKeys) {
  for (const text of texts) {
    const hit = findKeys(text).find((key) => knownKeys.has(key))
    if (hit) return hit
  }
  return null
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

// Commits and PRs become work items, linked to a task by a key (FR4, T4).
// Where the key is looked for, in order (the first key that belongs to a real task wins):
//   PR:     branch name, then title
//   commit: its own message, then the PR it belongs to (prNumber: that PR's branch and
//           title), then its own branch name
// `branch` and `prNumber` are optional, so data without them (the sample data) links
// exactly as before. A commit with no known key anywhere stays in "unlinked work".
export function linkWork(commits, pullRequests, tasks) {
  const keys = new Set(tasks.map((t) => t.key))
  const prTexts = new Map(pullRequests.map((p) => [p.number, [p.branch, p.title]]))
  const items = [
    ...commits.map((c) => ({
      kind: 'commit',
      id: c.sha.slice(0, 7),
      label: c.message,
      authorId: c.authorId,
      date: c.date,
      texts: [c.message, ...(prTexts.get(c.prNumber) ?? []), c.branch],
    })),
    ...pullRequests.map((p) => ({
      kind: 'pr',
      id: `#${p.number}`,
      label: p.title,
      authorId: p.authorId,
      date: p.date,
      texts: [p.branch, p.title],
    })),
  ]
  return items.map(({ texts, ...item }) => ({ ...item, taskKey: resolveKey(texts, keys) }))
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
