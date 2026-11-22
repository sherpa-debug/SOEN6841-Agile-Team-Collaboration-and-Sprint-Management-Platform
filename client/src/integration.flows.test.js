import { describe, it, expect } from 'vitest'
import { MEMBERS, SAMPLE_AI_LOG, SAMPLE_CRITERIA, SAMPLE_TASKS, SPRINTS } from './data/sampleData.js'
import { SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS } from './data/sampleWork.js'
import { addAiEntry, aiCountByMember, aiCountByTask } from './lib/aiLog.js'
import { checkinState, myEntries, saveCheckinForm } from './lib/checkin.js'
import { LATE_FLAG_AT, linkWork, memberMeasures, sprintSummary } from './lib/contribution.js'
import { describeWork, unlinkedInSprint, workCountsByTask, workForTask } from './lib/linkedWork.js'
import { rubricCoverage, toggleCriterion } from './lib/rubric.js'
import { createTask, loadTasks, saveTasks, updateTask } from './lib/tasks.js'

// SP-14: end-to-end flows that cross several modules, run on the seeded demo team.
// Each test uses its own copy of the data, so the tests do not depend on each other.

const sprint1 = SPRINTS[0]
const anusha = MEMBERS.find((m) => m.name === 'Anusha')
const moncef = MEMBERS.find((m) => m.name === 'Moncef')

// A tiny stand-in for localStorage
function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

const measuresFor = (member, { tasks = SAMPLE_TASKS, work, aiLog = SAMPLE_AI_LOG, checkins = [] } = {}) =>
  memberMeasures({
    member,
    sprint: sprint1,
    tasks,
    work: work ?? linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, tasks),
    aiLog,
    checkins,
  })

describe('task lifecycle: create, update, save, reload, dashboard', () => {
  it('keeps a new task and its changes after a reload, and the key never changes', () => {
    const storage = fakeStorage()
    let tasks = createTask(SAMPLE_TASKS, { title: 'Usability script', points: 3, assigneeId: 3, type: 'Testing', sprintId: 1 })
    const key = tasks[tasks.length - 1].key
    expect(tasks.find((t) => t.key === key).status).toBe('todo')

    tasks = updateTask(tasks, key, { status: 'done', key: 'SP-999' })
    saveTasks(tasks, storage)
    const reloaded = loadTasks(SAMPLE_TASKS, storage)

    expect(reloaded.find((t) => t.key === key).status).toBe('done')
    expect(reloaded.some((t) => t.key === 'SP-999')).toBe(false)
  })

  it('uses the fallback when nothing is saved', () => {
    expect(loadTasks(SAMPLE_TASKS, fakeStorage())).toBe(SAMPLE_TASKS)
  })

  it('moving a task to Done adds its points to the member and to the team totals', () => {
    const before = measuresFor(anusha)
    const summaryBefore = sprintSummary({
      sprint: sprint1,
      tasks: SAMPLE_TASKS,
      work: linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, SAMPLE_TASKS),
      aiLog: SAMPLE_AI_LOG,
    })

    // SP-17 (3 points, Anusha, Sprint 1) is still in progress in the seed data
    const tasks = updateTask(SAMPLE_TASKS, 'SP-17', { status: 'done' })
    const after = measuresFor(anusha, { tasks })
    const summaryAfter = sprintSummary({
      sprint: sprint1,
      tasks,
      work: linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, tasks),
      aiLog: SAMPLE_AI_LOG,
    })

    expect(after.storyPoints.value).toBe(before.storyPoints.value + 3)
    expect(after.rubricTasks.value).toBe(before.rubricTasks.value + 1)
    expect(summaryAfter.pointsDone.value).toBe(summaryBefore.pointsDone.value + 3)
    expect(summaryAfter.pointsDone.total).toBe(summaryBefore.pointsDone.total)
  })

  it('a task moved to the next sprint stops counting in Sprint 1', () => {
    const before = measuresFor(anusha)
    const tasks = updateTask(SAMPLE_TASKS, 'SP-5', { sprintId: 2 })
    const after = measuresFor(anusha, { tasks })
    expect(after.storyPoints.value).toBe(before.storyPoints.value - 3)
  })
})

describe('rubric tagging feeds coverage and the dashboard', () => {
  it('shows every criterion as covered in the seed data', () => {
    const coverage = rubricCoverage(SAMPLE_TASKS, SAMPLE_CRITERIA)
    expect(coverage.every((c) => c.covered)).toBe(true)
  })

  it('removing the only tag of a criterion uncovers it and lowers the finished-and-tagged count', () => {
    const testing = SAMPLE_CRITERIA.find((c) => c.name === 'Testing')
    const taggedTesting = SAMPLE_TASKS.filter((t) => t.criteria.includes(testing.id)).map((t) => t.key)

    let tasks = SAMPLE_TASKS
    for (const key of taggedTesting) tasks = toggleCriterion(tasks, key, testing.id)

    const uncovered = rubricCoverage(tasks, SAMPLE_CRITERIA).find((c) => c.criterion.id === testing.id)
    expect(uncovered.covered).toBe(false)
    expect(uncovered.taskKeys).toEqual([])
    // SP-5 is Anusha's only finished task in Sprint 1 and was tagged Testing only
    expect(measuresFor(anusha, { tasks }).rubricTasks.value).toBe(0)
    expect(measuresFor(anusha).rubricTasks.value).toBe(1)
  })

  it('tagging a task again brings the coverage and the count back', () => {
    const testing = SAMPLE_CRITERIA.find((c) => c.name === 'Testing')
    const untagged = toggleCriterion(SAMPLE_TASKS, 'SP-5', testing.id)
    const retagged = toggleCriterion(untagged, 'SP-5', testing.id)
    expect(retagged.find((t) => t.key === 'SP-5').criteria).toEqual([testing.id])
  })
})

describe('AI log entries feed the badges and the dashboard', () => {
  it('a new entry raises the task badge, the member count and the team total', () => {
    const summaryOf = (aiLog) =>
      sprintSummary({ sprint: sprint1, tasks: SAMPLE_TASKS, work: linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, SAMPLE_TASKS), aiLog })

    const beforeMember = measuresFor(anusha).aiEntries.value
    const beforeTeam = summaryOf(SAMPLE_AI_LOG).aiEntries.value
    const beforeBadge = aiCountByTask(SAMPLE_AI_LOG)['SP-17'] ?? 0

    const log = addAiEntry(
      SAMPLE_AI_LOG,
      { taskKey: 'SP-17', userId: anusha.id, tool: 'Claude', purpose: 'Draft the D4 table', verified: true, check: 'Recomputed SPI by hand' },
      '2026-11-20',
    )

    expect(aiCountByTask(log)['SP-17']).toBe(beforeBadge + 1)
    expect(aiCountByMember(log)[anusha.id]).toBe(aiCountByMember(SAMPLE_AI_LOG)[anusha.id] + 1)
    expect(measuresFor(anusha, { aiLog: log }).aiEntries.value).toBe(beforeMember + 1)
    expect(summaryOf(log).aiEntries.value).toBe(beforeTeam + 1)
  })

  it('an entry without a purpose, a tool or a task is not added', () => {
    expect(addAiEntry(SAMPLE_AI_LOG, { taskKey: 'SP-17', userId: 3, tool: 'Claude', purpose: '  ' })).toBe(SAMPLE_AI_LOG)
    expect(addAiEntry(SAMPLE_AI_LOG, { taskKey: 'SP-17', userId: 3, tool: '', purpose: 'x' })).toBe(SAMPLE_AI_LOG)
    expect(addAiEntry(SAMPLE_AI_LOG, { userId: 3, tool: 'Claude', purpose: 'x' })).toBe(SAMPLE_AI_LOG)
  })

  it('an entry on a Sprint 2 task does not count in Sprint 1', () => {
    // SP-14 belongs to Sprint 2, so the seed entry for it is not a Sprint 1 entry
    expect(measuresFor(anusha).aiEntries.items.map((e) => e.taskKey)).toEqual(['SP-5'])
  })

  it('an entry that is not marked as checked keeps no check text', () => {
    const log = addAiEntry(SAMPLE_AI_LOG, { taskKey: 'SP-5', userId: 3, tool: 'Claude', purpose: 'Notes', verified: false, check: 'ignored' }, '2026-11-20')
    expect(log[log.length - 1]).toMatchObject({ verified: false, check: '' })
  })
})

describe('peer check-in feeds the peer rating on the dashboard', () => {
  const others = MEMBERS.filter((m) => m.id !== anusha.id)
  const now = new Date('2026-11-20T12:00:00')
  const entries = {
    1: { rating: 4, comment: 'Reviewed my PRs quickly' },
    2: { rating: 5, comment: 'Great API work' },
    4: { rating: 3, comment: 'Needs earlier commits' },
  }

  it('the check-in is open during Sprint 1, closed after it and not open before it', () => {
    expect(checkinState(sprint1, new Date('2026-11-08T12:00:00'))).toBe('not_open')
    expect(checkinState(sprint1, now)).toBe('open')
    expect(checkinState(sprint1, new Date('2026-11-23T00:00:01'))).toBe('closed')
  })

  it('submitted check-ins become each member\'s average peer rating', () => {
    const first = saveCheckinForm([], { sprintId: 1, raterId: anusha.id, teammates: MEMBERS, entries, submit: true, now })
    expect(first.errors).toEqual({})

    // Ming also rates Moncef, with a 2
    const second = saveCheckinForm(first.checkins, {
      sprintId: 1,
      raterId: 2,
      teammates: MEMBERS,
      entries: { 1: { rating: 2, comment: 'Late merges' }, 3: { rating: 5, comment: 'CI saved us' }, 4: { rating: 4, comment: 'Solid' } },
      submit: true,
      now,
    })

    expect(measuresFor(moncef, { checkins: second.checkins }).peerRating.value).toBe(3) // (4 + 2) / 2
    expect(measuresFor(anusha, { checkins: second.checkins }).peerRating.value).toBe(5) // only Ming rated Anusha
    expect(measuresFor(moncef, { checkins: second.checkins }).peerRating.items).toHaveLength(2)
  })

  it('drafts do not count until they are submitted, and submitting again replaces the earlier ratings', () => {
    const draft = saveCheckinForm([], { sprintId: 1, raterId: anusha.id, teammates: others, entries: { 1: { rating: 4, comment: '' } }, submit: false, now })
    expect(draft.errors).toEqual({})
    expect(measuresFor(moncef, { checkins: draft.checkins }).peerRating.value).toBeNull()

    const submitted = saveCheckinForm(draft.checkins, { sprintId: 1, raterId: anusha.id, teammates: others, entries, submit: true, now })
    expect(measuresFor(moncef, { checkins: submitted.checkins }).peerRating.value).toBe(4)
    expect(Object.keys(myEntries(submitted.checkins, 1, anusha.id))).toHaveLength(3)

    const changed = saveCheckinForm(submitted.checkins, {
      sprintId: 1,
      raterId: anusha.id,
      teammates: others,
      entries: { ...entries, 1: { rating: 2, comment: 'Changed my mind' } },
      submit: true,
      now,
    })
    expect(changed.checkins.filter((c) => c.raterId === anusha.id && c.rateeId === 1)).toHaveLength(1)
    expect(measuresFor(moncef, { checkins: changed.checkins }).peerRating.value).toBe(2)
  })

  it('refuses to submit with a missing rating or comment and changes nothing', () => {
    const result = saveCheckinForm([], {
      sprintId: 1,
      raterId: anusha.id,
      teammates: others,
      entries: { 1: { rating: 4, comment: 'ok' }, 2: { rating: 5, comment: '' }, 4: { comment: 'no rating' } },
      submit: true,
      now,
    })
    expect(result.errors).toEqual({ 2: 'Write a short comment.', 4: 'Choose a rating from 1 to 5.' })
    expect(result.checkins).toEqual([])
  })

  it('nobody can rate themselves', () => {
    const result = saveCheckinForm([], {
      sprintId: 1,
      raterId: anusha.id,
      teammates: MEMBERS,
      entries: { ...entries, [anusha.id]: { rating: 5, comment: 'I am great' } },
      submit: true,
      now,
    })
    expect(result.checkins.some((c) => c.rateeId === anusha.id)).toBe(false)
  })
})

describe('linked work on cards, the task panel and the unlinked badge', () => {
  const work = linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, SAMPLE_TASKS)

  it('counts the commits and PRs behind a card and words them for the card', () => {
    expect(workCountsByTask(work)['SP-5']).toEqual({ commits: 3, prs: 1 })
    expect(describeWork(workCountsByTask(work)['SP-5'])).toBe('3 commits · 1 PR')
    expect(describeWork(workCountsByTask(work)['SP-7'])).toBe('')
  })

  it('lists a task\'s work newest first in the task panel', () => {
    const items = workForTask(work, 'SP-5')
    expect(items).toHaveLength(4)
    const dates = items.map((w) => new Date(w.date).getTime())
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
  })

  it('the unlinked badge and the dashboard tile show the same items', () => {
    const summary = sprintSummary({ sprint: sprint1, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG })
    const badge = unlinkedInSprint(work, sprint1)
    expect(badge).toHaveLength(summary.unlinked.value)
    expect(badge.map((w) => w.id).sort()).toEqual(summary.unlinked.items.map((w) => w.id).sort())
  })

  it('a commit that names an unknown key stays unlinked until the task exists', () => {
    const commit = { sha: 'feed1234', authorId: 3, message: 'SP-99 spike for later', date: '2026-11-20T09:00' }
    const early = linkWork([commit], [], SAMPLE_TASKS)
    expect(early[0].taskKey).toBeNull()

    const tasks = [...SAMPLE_TASKS, { key: 'SP-99', title: 'Spike', sprintId: 1, assigneeId: 3, type: 'Design', points: 1, criteria: [], status: 'todo' }]
    expect(linkWork([commit], [], tasks)[0].taskKey).toBe('SP-99')
  })
})

describe('late work flag on the dashboard', () => {
  const lateCommits = Array.from({ length: 8 }, (_, i) => ({
    sha: `1a7e00${i}0`,
    authorId: 3,
    message: `SP-17 report part ${i + 1}`,
    date: '2026-11-22T20:00',
  }))

  it('flags a member whose activity is mostly in the last 20% of the sprint', () => {
    const work = linkWork([...SAMPLE_COMMITS, ...lateCommits], SAMPLE_PULL_REQUESTS, SAMPLE_TASKS)
    const late = measuresFor(anusha, { work }).lateShare
    expect(late.value).toBeGreaterThanOrEqual(LATE_FLAG_AT)
    expect(late.flagged).toBe(true)
    expect(late.items.length).toBeGreaterThan(0)
  })

  it('does not flag the seed data, where the work was spread out', () => {
    expect(measuresFor(anusha).lateShare.flagged).toBe(false)
    expect(measuresFor(moncef).lateShare.flagged).toBe(false)
  })
})
