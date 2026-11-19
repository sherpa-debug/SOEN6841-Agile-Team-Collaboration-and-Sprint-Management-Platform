import { describe, it, expect } from 'vitest'
import { findKey, linkWork, memberMeasures, sprintSummary } from './contribution.js'

// A small sprint whose numbers are easy to count by hand
const sprint = { id: 1, start: '2026-11-09', end: '2026-11-18' } // last 20% starts late on Nov 16
const moncef = { id: 1, name: 'Moncef' }
const ming = { id: 2, name: 'Ming' }

const tasks = [
  { key: 'SP-1', sprintId: 1, assigneeId: 1, points: 8, status: 'done', criteria: [2, 3] },
  { key: 'SP-2', sprintId: 1, assigneeId: 1, points: 3, status: 'done', criteria: [] },
  { key: 'SP-3', sprintId: 1, assigneeId: 1, points: 5, status: 'in_progress', criteria: [4] },
  { key: 'SP-4', sprintId: 1, assigneeId: 2, points: 5, status: 'done', criteria: [3] },
  { key: 'SP-9', sprintId: 2, assigneeId: 1, points: 13, status: 'done', criteria: [1] }, // other sprint
]
const commits = [
  { sha: 'a1aaaaaa', authorId: 1, message: 'SP-1 board columns', date: '2026-11-10T10:00' },
  { sha: 'a2aaaaaa', authorId: 1, message: 'SP-3 rubric chips', date: '2026-11-12T10:00' },
  { sha: 'a3aaaaaa', authorId: 1, message: 'fix typo', date: '2026-11-12T11:00' }, // no key: unlinked
  { sha: 'a4aaaaaa', authorId: 1, message: 'SP-77 unknown key', date: '2026-11-13T11:00' }, // unknown key: unlinked
  { sha: 'b1bbbbbb', authorId: 2, message: 'SP-4 engine', date: '2026-11-17T09:00' }, // late
  { sha: 'c1cccccc', authorId: 1, message: 'SP-1 too early', date: '2026-11-01T09:00' }, // before the sprint
]
const prs = [{ number: 1, authorId: 1, title: 'SP-1 Sprint board', date: '2026-11-14T10:00' }]
const aiLog = [
  { id: 1, taskKey: 'SP-1', userId: 1 },
  { id: 2, taskKey: 'SP-9', userId: 1 }, // other sprint
  { id: 3, taskKey: 'SP-4', userId: 2 },
]
const work = linkWork(commits, prs, tasks)

describe('Contribution measures (FR5) match hand-computed values', () => {
  it('finds the task key in a message or title', () => {
    expect(findKey('SP-12 add chart')).toBe('SP-12')
    expect(findKey('Merge sp-7 into main')).toBe('SP-7')
    expect(findKey('fix typo')).toBe(null)
  })

  it("computes Moncef's six measures for the sprint", () => {
    const m = memberMeasures({ member: moncef, sprint, tasks, work, aiLog })
    expect(m.storyPoints.value).toBe(11) // SP-1 (8) + SP-2 (3); SP-3 is not done
    expect(m.commits.value).toBe(2) // SP-1 and SP-3 commits; unlinked and pre-sprint ones excluded
    expect(m.prs.value).toBe(1)
    expect(m.rubricTasks.value).toBe(1) // only SP-1 is done and tagged
    expect(m.aiEntries.value).toBe(1) // the SP-9 entry belongs to another sprint
    expect(m.peerRating.value).toBe(null)
    expect(m.lateShare.value).toBe(0)
  })

  it('lists unlinked work in the team summary', () => {
    const s = sprintSummary({ sprint, tasks, work, aiLog })
    expect(s.unlinked.items.map((w) => w.id)).toEqual(['a3aaaaa', 'a4aaaaa'])
    expect(s.pointsDone.value).toBe(16)
    expect(s.pointsDone.total).toBe(21)
    expect(s.linkedCommits.value).toBe(3)
    expect(s.aiEntries.value).toBe(2)
  })
})

describe('T14: each drill-down lists exactly the items counted', () => {
  it('every number equals what its list contains', () => {
    for (const member of [moncef, ming]) {
      const m = memberMeasures({ member, sprint, tasks, work, aiLog })
      expect(m.storyPoints.value).toBe(m.storyPoints.items.reduce((s, t) => s + t.points, 0))
      for (const name of ['commits', 'prs', 'rubricTasks', 'aiEntries']) {
        expect(m[name].value).toBe(m[name].items.length)
      }
      expect(m.lateShare.items.length).toBe(Math.round(m.lateShare.value * m.lateShare.total))
    }
    const s = sprintSummary({ sprint, tasks, work, aiLog })
    for (const name of ['linkedCommits', 'unlinked', 'aiEntries']) {
      expect(s[name].value).toBe(s[name].items.length)
    }
  })
})

describe('Late-work share (FR9)', () => {
  it('8 of 10 events in the last 20% of the sprint gives 80% and shows the flag', () => {
    const tenCommits = Array.from({ length: 10 }, (_, i) => ({
      sha: `d${i}xxxxxx`,
      authorId: 2,
      message: 'SP-4 work',
      date: i < 2 ? '2026-11-10T10:00' : '2026-11-18T10:00',
    }))
    const m = memberMeasures({ member: ming, sprint, tasks, work: linkWork(tenCommits, [], tasks), aiLog })
    expect(m.lateShare.value).toBe(0.8)
    expect(m.lateShare.flagged).toBe(true)
  })
})
