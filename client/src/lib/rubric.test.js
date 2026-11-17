import { describe, it, expect } from 'vitest'
import { cleanCriteria, nextCriterionId, removeMissingCriteria, rubricCoverage, toggleCriterion } from './rubric.js'

const criteria = [
  { id: 1, name: 'Requirements' },
  { id: 2, name: 'Design' },
  { id: 3, name: 'Implementation' },
  { id: 4, name: 'Testing' },
]

describe('T3: tag a task with 2 of 4 criteria → coverage shows those 2', () => {
  it('shows exactly the 2 tagged criteria as covered', () => {
    let tasks = [{ key: 'SP-1', title: 'Board', status: 'todo' }]
    tasks = toggleCriterion(tasks, 'SP-1', 2)
    tasks = toggleCriterion(tasks, 'SP-1', 3)

    const coverage = rubricCoverage(tasks, criteria)
    const covered = coverage.filter((c) => c.covered).map((c) => c.criterion.name)

    expect(covered).toEqual(['Design', 'Implementation'])
    expect(coverage[1].taskKeys).toEqual(['SP-1'])
    expect(coverage[0].covered).toBe(false)
    expect(coverage[3].covered).toBe(false)
  })

  it('removes a tag when it is clicked a second time', () => {
    let tasks = [{ key: 'SP-1', criteria: [] }]
    tasks = toggleCriterion(tasks, 'SP-1', 4)
    tasks = toggleCriterion(tasks, 'SP-1', 4)
    expect(tasks[0].criteria).toEqual([])
  })

  it('removes the tags of a deleted criterion', () => {
    const tasks = [{ key: 'SP-1', criteria: [1, 4] }]
    const withoutTesting = criteria.filter((c) => c.id !== 4)
    expect(removeMissingCriteria(tasks, withoutTesting)[0].criteria).toEqual([1])
  })

  it('tidies the rubric: trims names, drops empty and repeated ones', () => {
    const typed = [
      { id: 1, name: '  Design ' },
      { id: 2, name: '' },
      { id: 3, name: 'design' },
      { id: 4, name: 'Testing' },
    ]
    expect(cleanCriteria(typed).map((c) => c.name)).toEqual(['Design', 'Testing'])
  })

  it('never reuses an old criterion id', () => {
    expect(nextCriterionId(criteria, [{ id: 2, name: 'Design' }])).toBe(5)
  })
})
