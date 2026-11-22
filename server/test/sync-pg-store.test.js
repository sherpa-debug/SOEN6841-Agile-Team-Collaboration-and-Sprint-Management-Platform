import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPgStore } from '../src/sync/pg-store.js'

// There is no database in the tests: a fake `query` records each statement, so these tests
// check the shape of the SQL (parameters only, upsert by key, chunking), not a live PostgreSQL.
function recorder(reply = () => []) {
  const calls = []
  return { calls, query: async (sql, params = []) => (calls.push({ sql, params }), reply(sql, params)) }
}
const row = (n, extra = {}) => ({ sha: `sha${n}`, message: `SP-1 change ${n}`, committedAt: '2026-11-15T10:00:00Z', authorId: 11, taskId: 101, ...extra })

describe('saving commits', () => {
  it('upserts by sha, passes every value as a parameter and never replaces a saved link with none', async () => {
    const { calls, query } = recorder(() => [{ inserted: true }, { inserted: false }])
    const result = await createPgStore(query).upsertCommits(1, [row(1, { message: "x'); DROP TABLE commits;--" }), row(2)])

    assert.equal(calls.length, 1)
    assert.match(calls[0].sql, /ON CONFLICT \(sha\) DO UPDATE/)
    assert.match(calls[0].sql, /task_id = COALESCE\(EXCLUDED\.task_id, commits\.task_id\)/)
    assert.match(calls[0].sql, /author_id = COALESCE\(EXCLUDED\.author_id, commits\.author_id\)/)
    assert.match(calls[0].sql, /VALUES \(\$1,\$2,\$3,\$4,\$5,\$6\),\(\$7,\$8,\$9,\$10,\$11,\$12\)/)
    assert.equal(calls[0].sql.includes('DROP TABLE'), false)
    assert.equal(calls[0].params.length, 12)
    assert.equal(calls[0].params[4], "x'); DROP TABLE commits;--")
    assert.deepEqual(result, { inserted: 1 })
  })

  it('saves a large sync in chunks, and a repeated sha only once per statement', async () => {
    const { calls, query } = recorder((sql, params) => Array.from({ length: params.length / 6 }, () => ({ inserted: true })))
    const rows = [...Array.from({ length: 450 }, (_, i) => row(i)), row(0)] // sha0 appears twice
    const result = await createPgStore(query).upsertCommits(1, rows)

    assert.deepEqual(calls.map((c) => c.params.length / 6), [200, 200, 50])
    assert.equal(result.inserted, 450)
  })
})

describe('saving pull requests and links', () => {
  it('upserts a pull request by team and number, keeping a saved task or author', async () => {
    const { calls, query } = recorder()
    await createPgStore(query).upsertPullRequests(1, [{ number: 7, taskId: 104, authorId: 12, state: 'merged', mergedAt: '2026-11-18T00:00:00Z' }])

    assert.match(calls[0].sql, /ON CONFLICT \(team_id, number\) DO UPDATE/)
    assert.match(calls[0].sql, /task_id = COALESCE\(EXCLUDED\.task_id, pull_request\.task_id\)/)
    assert.deepEqual(calls[0].params, [1, 7, 104, 12, 'merged', '2026-11-18T00:00:00Z'])
  })

  it('sets the task of commits that had none, and only those', async () => {
    const { calls, query } = recorder()
    await createPgStore(query).setCommitTasks(1, [{ sha: 'a', taskId: 101 }, { sha: 'b', taskId: 102 }])

    assert.match(calls[0].sql, /c\.task_id IS NULL/)
    assert.deepEqual(calls[0].params, [1, ['a', 'b'], [101, 102]])
  })
})

describe('reading', () => {
  it('turns task rows into a key -> id map, a later sprint winning a repeated key', async () => {
    const { query } = recorder(() => [{ key: 'SP-1', id: '1' }, { key: 'SP-2', id: '2' }, { key: 'SP-1', id: '9' }])
    const ids = await createPgStore(query).loadTaskIds(1)
    assert.deepEqual([...ids], [['SP-1', '9'], ['SP-2', '2']])
  })

  it('reads the sync state, and starts from "never" for a team that has none', async () => {
    const saved = recorder(() => [{ last_sync_at: new Date('2026-11-15T10:00:00Z'), pulls_etag: '"e"', status: 'ok', last_error: null }])
    assert.deepEqual(await createPgStore(saved.query).getSyncState(1), { lastSyncAt: new Date('2026-11-15T10:00:00Z'), pullsEtag: '"e"', status: 'ok', error: null })
    assert.deepEqual(await createPgStore(recorder().query).getSyncState(2), { lastSyncAt: null, pullsEtag: null, status: 'never', error: null })
  })

  it('writes the sync state as one upsert per team', async () => {
    const { calls, query } = recorder()
    await createPgStore(query).saveSyncState(1, { lastSyncAt: new Date('2026-11-15T10:00:00Z'), pullsEtag: '"e"', status: 'ok', error: null })
    assert.match(calls[0].sql, /ON CONFLICT \(team_id\) DO UPDATE/)
    assert.equal(calls[0].params[3], 'ok')
  })
})
