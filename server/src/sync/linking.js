// Task-key linking for the sync job (FR4, test T4). These are the same rules as the screen's
// client/src/lib/contribution.js, so the server and the browser link work the same way.

// "SP-12" in a message, title or branch name. (?!\d) instead of a closing \b so that
// "tanzir/SP-12_chart" still matches ("_" is a word character and would break \b).
const keyPattern = () => /\bSP-(\d+)(?!\d)/gi

// Every key in a text, in order: "SP-3 and sp-5" -> ["SP-3", "SP-5"]
export function findKeys(text) {
  return [...String(text ?? '').matchAll(keyPattern())].map((match) => `SP-${match[1]}`)
}

// First key, over the texts in order, that belongs to a real task (or null).
// An unknown key (SP-99) does not stop the search: the next text may carry a known one.
export function resolveKey(texts, knownKeys) {
  for (const text of texts) {
    const hit = findKeys(text).find((key) => knownKeys.has(key))
    if (hit) return hit
  }
  return null
}
