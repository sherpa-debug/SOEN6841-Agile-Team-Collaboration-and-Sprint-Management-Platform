import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_INTERVAL_MS, startSyncSchedule } from '../src/sync/scheduler.js'

// A timer we control: it remembers the callback and the interval, and fires on demand
function fakeTimer() {
  const timer = { callback: null, interval: null, cleared: false, unref() { timer.unrefd = true } }
  return {
    timer,
    setIntervalImpl: (callback, interval) => {
      timer.callback = callback
      timer.interval = interval
      return timer
    },
    clearIntervalImpl: (handle) => {
      handle.cleared = true
    },
  }
}

describe('the sync schedule', () => {
  it('runs once at start and then every 10 minutes by default, without keeping the process alive', async () => {
    const { timer, setIntervalImpl, clearIntervalImpl } = fakeTimer()
    let runs = 0
    const schedule = startSyncSchedule({ run: async () => (runs += 1), setIntervalImpl, clearIntervalImpl })
    await new Promise((resolve) => setImmediate(resolve)) // let the first run finish
    await schedule.tick()

    assert.equal(DEFAULT_INTERVAL_MS, 10 * 60 * 1000)
    assert.equal(timer.interval, 10 * 60 * 1000)
    assert.equal(timer.unrefd, true)
    assert.equal(runs, 2)
  })

  it('can start without an immediate run, and stops when asked', () => {
    const { timer, setIntervalImpl, clearIntervalImpl } = fakeTimer()
    let runs = 0
    const schedule = startSyncSchedule({ run: async () => (runs += 1), runNow: false, intervalMs: 1000, setIntervalImpl, clearIntervalImpl })
    assert.equal(runs, 0)
    assert.equal(timer.interval, 1000)
    schedule.stop()
    assert.equal(timer.cleared, true)
  })

  it('skips a tick while the last run is still going, so two syncs never overlap', async () => {
    const { setIntervalImpl, clearIntervalImpl } = fakeTimer()
    let release
    let runs = 0
    const schedule = startSyncSchedule({
      run: () => new Promise((resolve) => { runs += 1; release = resolve }),
      runNow: false,
      setIntervalImpl,
      clearIntervalImpl,
    })
    const first = schedule.tick()
    assert.deepEqual(await schedule.tick(), { skipped: true })
    release()
    await first
    schedule.tick()
    assert.equal(runs, 2)
  })

  it('reports a failed run and keeps going', async () => {
    const { setIntervalImpl, clearIntervalImpl } = fakeTimer()
    const errors = []
    let calls = 0
    const schedule = startSyncSchedule({
      run: async () => {
        calls += 1
        if (calls === 1) throw new Error('boom')
        return 'fine'
      },
      runNow: false,
      onError: (error) => errors.push(error.message),
      setIntervalImpl,
      clearIntervalImpl,
    })
    await schedule.tick()
    const next = await schedule.tick()

    assert.deepEqual(errors, ['boom'])
    assert.equal(next.result, 'fine')
  })
})
