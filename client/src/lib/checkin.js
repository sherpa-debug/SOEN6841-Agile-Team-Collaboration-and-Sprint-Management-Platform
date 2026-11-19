// Peer check-in (FR8, test T8): each member rates each teammate once per sprint,
// with a comment. Submitted ratings feed the "Peer rating" column of the dashboard.
import { loadJSON, saveJSON } from './storage.js'

const STORAGE_KEY = 'sprintproof.checkins.v1'
export const MAX_COMMENT = 200

export function loadCheckins(fallback, storage) {
  const saved = loadJSON(STORAGE_KEY, null, storage)
  return Array.isArray(saved) ? saved : fallback
}

export function saveCheckins(checkins, storage) {
  saveJSON(STORAGE_KEY, checkins, storage)
}

// 'not_open' before the sprint starts, 'open' during it, 'closed' after its last day
export function checkinState(sprint, now = new Date()) {
  if (now < new Date(`${sprint.start}T00:00:00`)) return 'not_open'
  if (now > new Date(`${sprint.end}T23:59:59`)) return 'closed'
  return 'open'
}

// Everyone on the team except the person filling in the form
export function teammatesOf(members, raterId) {
  return members.filter((m) => m.id !== raterId)
}

// What this member already wrote for a sprint: { [teammateId]: { rating, comment, status } }
export function myEntries(checkins, sprintId, raterId) {
  const entries = {}
  for (const c of checkins) {
    if (c.sprintId === sprintId && c.raterId === raterId) {
      entries[c.rateeId] = { rating: c.rating, comment: c.comment, status: c.status, updatedAt: c.updatedAt }
    }
  }
  return entries
}

// Problems in the form, as { [teammateId]: message }. Submitting needs a rating and a
// comment for every teammate; a draft may be incomplete.
export function validateEntries(entries, teammates, { submit }) {
  const errors = {}
  for (const mate of teammates) {
    const entry = entries[mate.id] ?? {}
    const comment = (entry.comment ?? '').trim()
    const hasRating = Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5
    if (comment.length > MAX_COMMENT) errors[mate.id] = `Keep the comment under ${MAX_COMMENT} characters.`
    else if (submit && !hasRating) errors[mate.id] = 'Choose a rating from 1 to 5.'
    else if (submit && !comment) errors[mate.id] = 'Write a short comment.'
  }
  return errors
}

// Save a draft or submit. There is one check-in per sprint, rater and teammate:
// saving again replaces the earlier one. Nobody can rate themselves.
export function saveCheckinForm(checkins, { sprintId, raterId, teammates, entries, submit, now = new Date() }) {
  const others = teammates.filter((mate) => mate.id !== raterId)
  const errors = validateEntries(entries, others, { submit })
  if (Object.keys(errors).length > 0) return { checkins, errors }

  const kept = checkins.filter((c) => !(c.sprintId === sprintId && c.raterId === raterId))
  const rows = others
    .filter((mate) => entries[mate.id]?.rating || (entries[mate.id]?.comment ?? '').trim())
    .map((mate) => ({
      id: `${sprintId}-${raterId}-${mate.id}`,
      sprintId,
      raterId,
      rateeId: mate.id,
      rating: entries[mate.id].rating ?? null,
      comment: (entries[mate.id].comment ?? '').trim(),
      status: submit ? 'submitted' : 'draft',
      updatedAt: now.toISOString(),
    }))
  return { checkins: [...kept, ...rows], errors: {} }
}

// Average rating a member received in a sprint, from submitted check-ins only,
// with the check-ins behind it (for the drill-down)
export function peerRating(checkins, sprintId, rateeId) {
  const items = checkins.filter((c) => c.sprintId === sprintId && c.rateeId === rateeId && c.status === 'submitted')
  if (items.length === 0) return { value: null, items }
  const average = items.reduce((sum, c) => sum + c.rating, 0) / items.length
  return { value: Math.round(average * 10) / 10, items }
}
