import { describe, it, expect } from 'vitest'
import { MEMBERS, SAMPLE_AI_LOG, SAMPLE_TASKS, SPRINTS } from './data/sampleData.js'
import { SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS } from './data/sampleWork.js'
import { linkWork, memberMeasures, sprintSummary } from './lib/contribution.js'
import { createTask } from './lib/tasks.js'

// SP-14 (started early): task -> commit -> measure on the seeded demo team.
// The TA view and the permission tests are added when SP-10 and SP-12 are merged.
const sprint1 = SPRINTS[0]
const work = linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, SAMPLE_TASKS)
const measures = (member) => memberMeasures({ member, sprint: sprint1, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG })
const summary = sprintSummary({ sprint: sprint1, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG })

describe('task -> commit -> measure, end to end on the seeded team', () => {
  it('links keyed commits and PRs to their task and lists the rest as unlinked', () => {
    const unlinked = work.filter((w) => !w.taskKey).map((w) => w.label)
    expect(unlinked).toEqual(['SP-16 add AI log file (course requirement)', 'fix typo in README', 'SP-16 AI log file'])
    const sp1 = work.filter((w) => w.taskKey === 'SP-1')
    expect(sp1.length).toBeGreaterThan(0)
    expect(sp1.every((w) => w.authorId === 2)).toBe(true)
  })

  it('gives each member the expected Sprint 1 measures', () => {
    const byName = Object.fromEntries(MEMBERS.map((m) => [m.name, measures(m)]))
    expect(byName.Moncef.storyPoints.value).toBe(14)
    expect(byName.Moncef.commits.value).toBe(4)
    expect(byName.Moncef.prs.value).toBe(3)
    expect(byName.Ming.storyPoints.value).toBe(5)
    expect(byName.Ming.commits.value).toBe(3)
    expect(byName.Anusha.commits.value).toBe(1)
    expect(byName.Tanzir.commits.value).toBe(2)
  })

  it('shows the same numbers on the member rows and in the team totals', () => {
    const all = MEMBERS.map(measures)
    const sum = (pick) => all.reduce((total, m) => total + pick(m), 0)
    expect(sum((m) => m.commits.value)).toBe(summary.linkedCommits.value)
    expect(sum((m) => m.storyPoints.value)).toBe(summary.pointsDone.value)
    expect(sum((m) => m.aiEntries.value)).toBe(summary.aiEntries.value)
  })

  it('opens exactly the items each number counted (drill-down)', () => {
    for (const member of MEMBERS) {
      const m = measures(member)
      expect(m.commits.items).toHaveLength(m.commits.value)
      expect(m.prs.items).toHaveLength(m.prs.value)
      expect(m.storyPoints.items.reduce((s, t) => s + t.points, 0)).toBe(m.storyPoints.value)
    }
    expect(summary.unlinked.items).toHaveLength(summary.unlinked.value)
  })

  it('counts a new task and a commit carrying its key right away', () => {
    const tasks = createTask(SAMPLE_TASKS, { title: 'Regression check', points: 2, assigneeId: 3, type: 'Testing', sprintId: 1 })
    const newKey = tasks[tasks.length - 1].key
    const commits = [...SAMPLE_COMMITS, { sha: 'abc1234def', authorId: 3, message: `${newKey} add regression test`, date: '2026-11-20T10:00' }]
    const linked = linkWork(commits, SAMPLE_PULL_REQUESTS, tasks)
    expect(linked.find((w) => w.id === 'abc1234').taskKey).toBe(newKey)
    const anusha = memberMeasures({ member: MEMBERS[2], sprint: sprint1, tasks, work: linked, aiLog: SAMPLE_AI_LOG })
    expect(anusha.commits.value).toBe(2)
  })
})
