import { describe, it, expect } from 'vitest'
import { linkWork, sprintSummary } from './contribution.js'
import { describeWork, unlinkedInSprint, workCountsByTask, workForTask } from './linkedWork.js'

const sprint = { id: 1, number: 1, start: '2026-11-09', end: '2026-11-22' }
const tasks = [
  { key: 'SP-2', sprintId: 1, assigneeId: 1, points: 8, status: 'done' },
  { key: 'SP-6', sprintId: 1, assigneeId: 1, points: 3, status: 'done' },
]
const commits = [
  { sha: 'a1aaaaaa', authorId: 1, message: 'SP-2 board columns', date: '2026-11-17T10:00' },
  { sha: 'a2aaaaaa', authorId: 1, message: 'SP-2 drag and drop', date: '2026-11-17T12:00' },
  { sha: 'a3aaaaaa', authorId: 1, message: 'SP-6 rubric chips', date: '2026-11-17T13:00' },
  { sha: 'a4aaaaaa', authorId: 3, message: 'fix typo', date: '2026-11-18T09:00' }, // no key
  { sha: 'a5aaaaaa', authorId: 1, message: 'SP-99 unknown task', date: '2026-11-18T10:00' }, // unknown key
  { sha: 'a6aaaaaa', authorId: 2, message: 'early setup', date: '2026-11-01T10:00' }, // before the sprint
]
const prs = [{ number: 1, authorId: 1, title: 'SP-2 Sprint board', date: '2026-11-17T14:00' }]
const work = linkWork(commits, prs, tasks)

describe('Linked work in the task panel (FR4, D3 Fig. 4)', () => {
  it("lists exactly the commits and PRs that carry the task's key, newest first", () => {
    expect(workForTask(work, 'SP-2').map((w) => w.id)).toEqual(['#1', 'a2aaaaa', 'a1aaaaa'])
    expect(workForTask(work, 'SP-6').map((w) => w.id)).toEqual(['a3aaaaa'])
  })

  it('counts commits and PRs per task for the cards', () => {
    const counts = workCountsByTask(work)
    expect(counts['SP-2']).toEqual({ commits: 2, prs: 1 })
    expect(describeWork(counts['SP-2'])).toBe('2 commits · 1 PR')
    expect(describeWork(counts['SP-6'])).toBe('1 commit')
    expect(describeWork(counts['SP-17'])).toBe('')
  })

  it('shows as unlinked only the keyless or unknown-key work made during the sprint', () => {
    expect(unlinkedInSprint(work, sprint).map((w) => w.id)).toEqual(['a5aaaaa', 'a4aaaaa'])
  })

  it('matches the "Unlinked work" tile of the dashboard', () => {
    const tile = sprintSummary({ sprint, tasks, work, aiLog: [] }).unlinked
    expect(unlinkedInSprint(work, sprint)).toHaveLength(tile.value)
  })

  it('links a new commit to its task as soon as its message carries the key', () => {
    const more = linkWork([...commits, { sha: 'b1bbbbbb', authorId: 1, message: 'SP-6 coverage bar', date: '2026-11-19T09:00' }], prs, tasks)
    expect(workForTask(more, 'SP-6').map((w) => w.id)).toEqual(['b1bbbbb', 'a3aaaaa'])
  })
})
