// Small helpers to keep data in the browser (until Ming's API is ready).

export function loadJSON(key, fallback, storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key, value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked or full: the app keeps working in memory.
  }
}
