import { describe, it, expect } from 'vitest'
import { MEMBERS, SAMPLE_AI_LOG, SAMPLE_CRITERIA, SAMPLE_TASKS, SPRINTS, STATUSES } from './sampleData.js'
import { SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS } from './sampleWork.js'

// The seeded demo team must stay consistent, because the demo and the end-to-end tests build on it.
describe('seeded demo team', () => {
  const memberIds = MEMBERS.map((m) => m.id)
  const taskKeys = SAMPLE_TASKS.map((t) => t.key)

  it('has 4 members and 2 sprints', () => {
    expect(MEMBERS).toHaveLength(4)
    expect(SPRINTS).toHaveLength(2)
  })

  it('gives every task a unique SP-n key, a real assignee, sprint, status and criteria', () => {
    expect(new Set(taskKeys).size).toBe(taskKeys.length)
    for (const task of SAMPLE_TASKS) {
      expect(task.key).toMatch(/^SP-\d+$/)
      expect(memberIds).toContain(task.assigneeId)
      expect(SPRINTS.map((s) => s.id)).toContain(task.sprintId)
      expect(STATUSES.map((s) => s.id)).toContain(task.status)
      for (const id of task.criteria) {
        expect(SAMPLE_CRITERIA.map((c) => c.id)).toContain(id)
      }
    }
  })

  it('points every AI log entry at an existing task and member', () => {
    for (const entry of SAMPLE_AI_LOG) {
      expect(taskKeys).toContain(entry.taskKey)
      expect(memberIds).toContain(entry.userId)
    }
  })

  it('has commits and pull requests written by team members', () => {
    for (const commit of SAMPLE_COMMITS) expect(memberIds).toContain(commit.authorId)
    for (const pr of SAMPLE_PULL_REQUESTS) expect(memberIds).toContain(pr.authorId)
  })
})
