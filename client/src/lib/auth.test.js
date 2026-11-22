import { describe, expect, it } from 'vitest'
import { normalizeInviteCode } from './auth.js'

describe('team invitation code normalization', () => {
  it('trims whitespace, ignores separators, and uses uppercase', () => {
    expect(normalizeInviteCode(' alpha-24 ')).toBe('ALPHA24')
  })
})
