import { describe, it, expect } from 'vitest'
import { SAMPLE_TASKS } from '../data/sampleData.js'
import { SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS } from '../data/sampleWork.js'
import { findKey, findKeys, linkWork, resolveKey } from './contribution.js'

// T4 (FR4, SP-7): on the seeded repository, keyed commits and PRs link to the right task;
// unkeyed ones are unlinked.

describe('finding the task key', () => {
  it('finds the key in a message, title or branch name, in any letter case', () => {
    expect(findKey('SP-12 add chart')).toBe('SP-12')
    expect(findKey('Merge sp-7 into main')).toBe('SP-7')
    expect(findKey('feature/SP-12-add-chart')).toBe('SP-12')
    expect(findKey('tanzir/sp-12_chart')).toBe('SP-12') // "_" after the number used to break the match
    expect(findKey('fix SP-12.')).toBe('SP-12')
  })

  it('does not take part of another word or number for a key', () => {
    expect(findKey('fix typo')).toBe(null)
    expect(findKey(null)).toBe(null)
    expect(findKey(undefined)).toBe(null)
    expect(findKey('FOOSP-12')).toBe(null)
    expect(findKey('SP-')).toBe(null)
    expect(findKey('SP-x')).toBe(null)
  })

  it('does not cut a long number short', () => {
    expect(findKey('SP-123 big')).toBe('SP-123')
    expect(findKey('SP-1234')).toBe('SP-1234')
  })

  it('lists every key in order, so a known one can win over an unknown one', () => {
    expect(findKeys('SP-3 and sp-5, then SP-3 again')).toEqual(['SP-3', 'SP-5', 'SP-3'])
    expect(resolveKey(['SP-99 and SP-4'], new Set(['SP-4']))).toBe('SP-4')
    expect(resolveKey(['SP-99', 'feature/SP-4'], new Set(['SP-4']))).toBe('SP-4')
    expect(resolveKey(['SP-99', 'nothing'], new Set(['SP-4']))).toBe(null)
  })
})

describe('T4: the seeded repository', () => {
  const work = linkWork(SAMPLE_COMMITS, SAMPLE_PULL_REQUESTS, SAMPLE_TASKS)
  const keyOf = Object.fromEntries(work.map((w) => [w.id, w.taskKey]))

  it('links every keyed commit and PR to the right task', () => {
    expect(keyOf).toEqual({
      '3f1c2a9': 'SP-1',
      '8b7d4e2': 'SP-1',
      c42e9f0: 'SP-1',
      '1a9b7c5': 'SP-2',
      '5d0e6f1': 'SP-6',
      '9e3a1b7': 'SP-8',
      '04d6aa3': 'SP-8',
      '04d67f2': null, // SP-16 is not a task on the board
      e7f20c4: 'SP-4',
      a8c3d91: 'SP-4',
      '3340b65': 'SP-5',
      '18db216': 'SP-5',
      '6865347': 'SP-5',
      '876fc57': 'SP-14',
      '6c1d0b2': null, // no key at all
      '#1': 'SP-2',
      '#2': 'SP-6',
      '#3': 'SP-8',
      '#4': null, // SP-16 again
      '#5': 'SP-1',
      '#7': 'SP-5',
      '#8': 'SP-14',
    })
  })

  it('keeps the unkeyed and unknown-key work as unlinked, never dropped', () => {
    expect(work).toHaveLength(SAMPLE_COMMITS.length + SAMPLE_PULL_REQUESTS.length)
    expect(work.filter((w) => !w.taskKey).map((w) => w.label)).toEqual([
      'SP-16 add AI log file (course requirement)',
      'fix typo in README',
      'SP-16 AI log file',
    ])
  })

  it('keeps the author, date and label of every item', () => {
    const first = work.find((w) => w.id === '3f1c2a9')
    expect(first).toEqual({
      kind: 'commit',
      id: '3f1c2a9',
      label: 'SP-1 add README and pull request rules',
      authorId: 2,
      date: '2026-11-18T14:10',
      taskKey: 'SP-1',
    })
  })
})

describe('T4: keys in branch names and pull requests', () => {
  const tasks = [{ key: 'SP-4' }, { key: 'SP-7' }, { key: 'SP-12' }]
  const prs = [
    { number: 10, authorId: 1, title: 'Add the chart', branch: 'tanzir/SP-12_chart', date: '2026-11-18T10:00' },
    { number: 11, authorId: 1, title: 'SP-7 key linking', branch: 'key-linking', date: '2026-11-18T11:00' },
    { number: 12, authorId: 1, title: 'Cleanup', branch: 'cleanup', date: '2026-11-18T12:00' },
  ]
  const commits = [
    { sha: 'aaaaaaa1', authorId: 1, message: 'wip', prNumber: 10, date: '2026-11-18T09:00' },
    { sha: 'bbbbbbb1', authorId: 1, message: 'SP-4 own key wins', prNumber: 10, date: '2026-11-18T09:30' },
    { sha: 'ccccccc1', authorId: 1, message: 'fix it', prNumber: 11, date: '2026-11-18T10:30' },
    { sha: 'ddddddd1', authorId: 1, message: 'tidy', prNumber: 12, date: '2026-11-18T11:30' },
    { sha: 'eeeeeee1', authorId: 1, message: 'SP-99 unknown', prNumber: 10, date: '2026-11-18T09:45' },
    { sha: 'fffffff1', authorId: 1, message: 'wip', branch: 'feature/SP-4-engine', date: '2026-11-18T08:00' },
    { sha: '1111111a', authorId: 1, message: 'wip', date: '2026-11-18T07:00' }, // no PR, no branch
  ]
  const work = linkWork(commits, prs, tasks)
  const keyOf = Object.fromEntries(work.map((w) => [w.id, w.taskKey]))

  it('takes the key from the PR branch before its title', () => {
    expect(keyOf['#10']).toBe('SP-12')
    expect(keyOf['#11']).toBe('SP-7') // branch has no key, the title does
    expect(keyOf['#12']).toBe(null)
  })

  it('lets a commit without a key inherit the key of its PR', () => {
    expect(keyOf.aaaaaaa).toBe('SP-12')
    expect(keyOf.ccccccc).toBe('SP-7')
  })

  it("prefers the commit's own key over the PR's", () => {
    expect(keyOf.bbbbbbb).toBe('SP-4')
  })

  it('falls back to the PR when the commit carries an unknown key', () => {
    expect(keyOf.eeeeeee).toBe('SP-12')
  })

  it('uses the commit branch when there is no PR, and leaves the rest unlinked', () => {
    expect(keyOf.fffffff).toBe('SP-4')
    expect(keyOf['1111111']).toBe(null)
    expect(keyOf.ddddddd).toBe(null) // its PR has no key either
  })

  it('does not link a commit to a PR number that does not exist', () => {
    const lone = linkWork([{ sha: '9999999z', authorId: 1, message: 'wip', prNumber: 404, date: '2026-11-18' }], prs, tasks)
    expect(lone[0].taskKey).toBe(null)
  })

  it('links again when a task is created after its commits were fetched', () => {
    const late = linkWork(commits, prs, [{ key: 'SP-4' }, { key: 'SP-7' }]) // SP-12 not created yet
    expect(late.find((w) => w.id === 'aaaaaaa').taskKey).toBe(null)
    expect(linkWork(commits, prs, tasks).find((w) => w.id === 'aaaaaaa').taskKey).toBe('SP-12')
  })
})
