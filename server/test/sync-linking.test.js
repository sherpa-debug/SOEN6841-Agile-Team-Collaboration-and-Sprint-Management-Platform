import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findKeys, resolveKey } from '../src/sync/linking.js'

describe('finding the task key', () => {
  it('finds the key in a message, title or branch name, in any letter case', () => {
    assert.deepEqual(findKeys('SP-12 add chart'), ['SP-12'])
    assert.deepEqual(findKeys('fix sp-3 typo'), ['SP-3'])
    assert.deepEqual(findKeys('tanzir/SP-12_chart'), ['SP-12'])
  })

  it('does not take part of another word, or cut a number short', () => {
    assert.deepEqual(findKeys('ASP-4 and SP-'), [])
    assert.deepEqual(findKeys('SP-1234'), ['SP-1234'])
    assert.deepEqual(findKeys(null), [])
  })

  it('lists every key in order, so a known one can win over an unknown one', () => {
    assert.deepEqual(findKeys('SP-3 and sp-5'), ['SP-3', 'SP-5'])
    assert.equal(resolveKey(['SP-99 and SP-4'], new Set(['SP-4'])), 'SP-4')
  })

  it('uses the first text that has a known key, and returns null when none does', () => {
    const known = new Set(['SP-1', 'SP-2'])
    assert.equal(resolveKey(['ming/SP-2_board', 'SP-1 title'], known), 'SP-2')
    assert.equal(resolveKey(['no key', 'SP-1 title'], known), 'SP-1')
    assert.equal(resolveKey(['SP-77', 'tidy'], known), null)
  })
})
