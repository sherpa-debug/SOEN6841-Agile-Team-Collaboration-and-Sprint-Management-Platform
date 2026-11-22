import { describe, expect, it } from 'vitest'
import { MEMBERS, SAMPLE_AI_LOG, SAMPLE_TASKS, SPRINTS } from './data/sampleData.js'
import { ALL_TEAMS, canRead } from './lib/access.js'
import { linkWork, memberMeasures, sprintSummary } from './lib/contribution.js'
import { unlinkedInSprint, workCountsByTask } from './lib/linkedWork.js'

describe('team access decisions', () => {
  it('limits student sessions to their team and allows staff sessions across teams', () => {
    const alphaStudent = { githubId: '7', role: 'student', team: { id: 'alpha24' } }
    const ta = { githubId: '8', role: 'ta', team: { id: ALL_TEAMS } }
    const instructor = { githubId: '9', role: 'instructor', team: { id: ALL_TEAMS } }

    expect(canRead(alphaStudent, 'alpha24')).toBe(true)
    expect(canRead(alphaStudent, 'sprint1')).toBe(false)
    expect(canRead(ta, 'sprint1')).toBe(true)
    expect(canRead(instructor, 'sprint1')).toBe(true)
  })
})

describe('T11: a sprint with 500 commits is calculated well inside 3 seconds', () => {
  const commits = Array.from({ length: 500 }, (_, i) => ({
    sha: `c${String(i).padStart(7, '0')}`,
    authorId: (i % 4) + 1,
    message: i % 5 === 4 ? `tidy ${i}` : `SP-${(i % 10) + 1} change ${i}`,
    date: `2026-11-${String(9 + (i % 14)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00`,
  }))
  const sprint = SPRINTS[0]

  function everythingTheDashboardNeeds() {
    const work = linkWork(commits, [], SAMPLE_TASKS)
    const measures = MEMBERS.map((member) => memberMeasures({ member, sprint, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG }))
    const summary = sprintSummary({ sprint, tasks: SAMPLE_TASKS, work, aiLog: SAMPLE_AI_LOG })
    return { measures, summary, unlinked: unlinkedInSprint(work, sprint), counts: workCountsByTask(work) }
  }

  it('finishes dashboard calculations in under 3 seconds', () => {
    const start = performance.now()
    everythingTheDashboardNeeds()
    expect(performance.now() - start).toBeLessThan(3000)
  })

  it('counts every commit exactly once and keeps summaries consistent', () => {
    const { measures, summary, unlinked } = everythingTheDashboardNeeds()
    expect(measures.reduce((sum, measure) => sum + measure.commits.value, 0)).toBe(400)
    expect(summary.linkedCommits.value).toBe(400)
    expect(summary.unlinked.value).toBe(100)
    expect(unlinked).toHaveLength(100)
    for (const measure of measures) expect(measure.commits.items).toHaveLength(measure.commits.value)
  })
})
