import { describe, it, expect } from 'vitest'
import { checkinState, loadCheckins, myEntries, peerRating, saveCheckinForm, saveCheckins } from './checkin.js'
import { memberMeasures } from './contribution.js'

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

const members = [
  { id: 1, name: 'Moncef' },
  { id: 2, name: 'Ming' },
  { id: 3, name: 'Anusha' },
  { id: 4, name: 'Tanzir' },
]
const sprint = { id: 1, number: 1, start: '2026-11-09', end: '2026-11-22' }
const now = new Date('2026-11-19T12:00:00')
const teammatesOfMoncef = members.filter((m) => m.id !== 1)

const moncefForm = {
  2: { rating: 4, comment: 'Set up the repository' },
  3: { rating: 5, comment: 'Kept our tracking up to date' },
  4: { rating: 3, comment: 'Engine started, needs tests' },
}

describe('T8: ratings and comments are saved and feed the dashboard average', () => {
  it('saves each rating and comment and keeps them after a reload', () => {
    const storage = fakeStorage()
    const { checkins, errors } = saveCheckinForm([], {
      sprintId: 1, raterId: 1, teammates: teammatesOfMoncef, entries: moncefForm, submit: true, now,
    })
    expect(errors).toEqual({})
    saveCheckins(checkins, storage)

    const afterReload = loadCheckins([], storage)
    const mine = myEntries(afterReload, 1, 1)
    expect(mine[3]).toMatchObject({ rating: 5, comment: 'Kept our tracking up to date', status: 'submitted' })
    expect(Object.keys(mine)).toHaveLength(3)
  })

  it("averages a member's submitted ratings on the dashboard, with the check-ins behind it", () => {
    let { checkins } = saveCheckinForm([], {
      sprintId: 1, raterId: 1, teammates: teammatesOfMoncef, entries: moncefForm, submit: true, now,
    })
    ;({ checkins } = saveCheckinForm(checkins, {
      sprintId: 1,
      raterId: 2,
      teammates: members.filter((m) => m.id !== 2),
      entries: { 1: { rating: 5, comment: 'Built the board' }, 3: { rating: 4, comment: 'Ran stand-ups' }, 4: { rating: 4, comment: 'Helped with tests' } },
      submit: true,
      now,
    }))

    const m = memberMeasures({ member: members[2], sprint, tasks: [], work: [], aiLog: [], checkins })
    expect(m.peerRating.value).toBe(4.5) // Anusha: 5 and 4
    expect(m.peerRating.items.map((c) => c.comment)).toEqual(['Kept our tracking up to date', 'Ran stand-ups'])
  })
})

describe('Peer check-in rules (FR8)', () => {
  it('refuses to submit until every teammate has a rating and a comment', () => {
    const { checkins, errors } = saveCheckinForm([], {
      sprintId: 1, raterId: 1, teammates: teammatesOfMoncef, entries: { 2: { rating: 4, comment: 'Good' }, 3: { rating: 5 } }, submit: true, now,
    })
    expect(checkins).toEqual([])
    expect(Object.keys(errors)).toEqual(['3', '4'])
  })

  it('keeps drafts out of the average', () => {
    const { checkins } = saveCheckinForm([], {
      sprintId: 1, raterId: 1, teammates: teammatesOfMoncef, entries: { 2: { rating: 2 } }, submit: false, now,
    })
    expect(checkins[0].status).toBe('draft')
    expect(peerRating(checkins, 1, 2).value).toBe(null)
  })

  it('replaces the earlier check-in instead of adding a second one', () => {
    const first = saveCheckinForm([], { sprintId: 1, raterId: 1, teammates: teammatesOfMoncef, entries: moncefForm, submit: true, now })
    const changed = { ...moncefForm, 4: { rating: 4, comment: 'Engine tests added' } }
    const second = saveCheckinForm(first.checkins, { sprintId: 1, raterId: 1, teammates: teammatesOfMoncef, entries: changed, submit: true, now })
    expect(second.checkins).toHaveLength(3)
    expect(peerRating(second.checkins, 1, 4).value).toBe(4)
  })

  it('never lets a member rate themselves', () => {
    const { checkins } = saveCheckinForm([], {
      sprintId: 1, raterId: 1, teammates: members, entries: { ...moncefForm, 1: { rating: 5, comment: 'Me' } }, submit: true, now,
    })
    expect(checkins.some((c) => c.rateeId === 1)).toBe(false)
  })

  it('is open only during the sprint', () => {
    expect(checkinState(sprint, new Date('2026-11-08T12:00:00'))).toBe('not_open')
    expect(checkinState(sprint, now)).toBe('open')
    expect(checkinState(sprint, new Date('2026-11-23T08:00:00'))).toBe('closed')
  })
})
