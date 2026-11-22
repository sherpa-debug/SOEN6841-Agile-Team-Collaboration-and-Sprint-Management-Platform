// Runs the sync on a timer (D3: every 10 minutes). A run that is still going when the next tick
// arrives makes that tick skip, so two syncs never overlap.
export const DEFAULT_INTERVAL_MS = 10 * 60 * 1000

export function startSyncSchedule({
  run,
  intervalMs = DEFAULT_INTERVAL_MS,
  runNow = true,
  onError = (error) => console.error('Scheduled sync failed:', error.message),
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
} = {}) {
  let running = false

  async function tick() {
    if (running) return { skipped: true }
    running = true
    try {
      return { skipped: false, result: await run() }
    } catch (error) {
      onError(error)
      return { skipped: false, error }
    } finally {
      running = false
    }
  }

  const timer = setIntervalImpl(tick, intervalMs)
  timer.unref?.() // an idle timer must not keep the process alive
  if (runNow) tick()
  return { tick, stop: () => clearIntervalImpl(timer) }
}
