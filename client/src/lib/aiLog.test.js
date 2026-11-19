import { describe, it, expect } from 'vitest'
import {
  addAiEntry,
  aiCount,
  aiCountByMember,
  aiCountByTask,
  entriesForTask,
  loadAiLog,
  removeAiEntry,
  saveAiLog,
} from './aiLog.js'

// A fake browser storage, so the test runs without a browser
function fakeStorage() {
  const data = {}
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
  }
}

const sprintTasks = ['SP-2', 'SP-6', 'SP-8']
const startLog = [
  { id: 1, taskKey: 'SP-2', userId: 1, tool: 'Claude', purpose: 'Board draft', verified: true, check: 'T2 passes', createdAt: '2026-11-17' },
]

describe('T6: a saved AI entry shows on its task and adds 1 to the count', () => {
  it("shows the new entry on its task and adds 1 to the member's count", () => {
    const before = aiCount(startLog, sprintTasks)
    const memberBefore = aiCountByMember(startLog)[1] ?? 0
    const log = addAiEntry(
      startLog,
      { taskKey: 'SP-6', userId: 1, tool: 'Claude', purpose: 'Rubric chips', verified: true, check: 'T3 passes' },
      '2026-11-18',
    )

    const onTask = entriesForTask(log, 'SP-6')
    expect(onTask).toHaveLength(1)
    expect(onTask[0].tool).toBe('Claude')
    expect(onTask[0].purpose).toBe('Rubric chips')
    expect(onTask[0].verified).toBe(true)
    expect(aiCountByMember(log)[1]).toBe(memberBefore + 1)
    expect(aiCount(log, sprintTasks)).toBe(before + 1)
    expect(aiCountByTask(log)['SP-6']).toBe(1)
  })

  it('keeps the entry after a reload', () => {
    const storage = fakeStorage()
    const log = addAiEntry(startLog, { taskKey: 'SP-8', tool: 'ChatGPT', purpose: 'Test ideas' })
    saveAiLog(log, storage)

    const afterReload = loadAiLog([], storage)
    expect(entriesForTask(afterReload, 'SP-8')).toHaveLength(1)
  })

  it('does not save an entry without a tool or a purpose', () => {
    expect(addAiEntry(startLog, { taskKey: 'SP-6', tool: '  ', purpose: 'Something' })).toHaveLength(1)
    expect(addAiEntry(startLog, { taskKey: 'SP-6', tool: 'Claude', purpose: '' })).toHaveLength(1)
  })

  it('lowers the count by 1 when an entry is removed', () => {
    expect(aiCount(removeAiEntry(startLog, 1), sprintTasks)).toBe(0)
  })
})
