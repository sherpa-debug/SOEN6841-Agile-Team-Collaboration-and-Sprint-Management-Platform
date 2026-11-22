import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GitHubError, createGitHubClient, nextLink, normalizeCommit, normalizePull } from '../src/sync/github.js'

const TOKEN = 'ghp_supersecret_token_value'
const json = (body, headers = {}, status = 200) => new Response(JSON.stringify(body), { status, headers })

// A fetch that serves the given responses in order and remembers what it was asked
function fetchFrom(...responses) {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), headers: options.headers })
    return responses[requests.length - 1]
  }
  return { fetchImpl, requests }
}

describe('pages', () => {
  it('follows the Link header to the last page and sends the token only in the Authorization header', async () => {
    const link = (n) => `<https://api.github.com/repos/o/r/commits?page=${n}>; rel="next"`
    const { fetchImpl, requests } = fetchFrom(
      json([{ sha: 'a1' }], { link: link(2), etag: '"first"' }),
      json([{ sha: 'b2' }], { link: link(3) }),
      json([{ sha: 'c3' }]),
    )
    const github = createGitHubClient({ token: TOKEN, fetchImpl })
    const result = await github.listCommits('o/r', { since: new Date('2026-11-15T00:00:00Z') })

    assert.deepEqual(result.items.map((c) => c.sha), ['a1', 'b2', 'c3'])
    assert.equal(requests.length, 3)
    assert.match(requests[0].url, /since=2026-11-15T00%3A00%3A00.000Z/)
    assert.match(requests[0].url, /per_page=100/)
    assert.equal(requests[0].headers.authorization, `Bearer ${TOKEN}`)
    assert.equal(requests.every((r) => !r.url.includes(TOKEN)), true)
  })

  it('stops with an error instead of paging forever', async () => {
    const endless = async () => json([{ sha: 'x' }], { link: '<https://api.github.com/next>; rel="next"' })
    const github = createGitHubClient({ token: TOKEN, fetchImpl: endless, maxPages: 3 })
    await assert.rejects(() => github.listCommits('o/r'), /Too many pages/)
  })

  it('reads the next link out of a header with several relations', () => {
    assert.equal(nextLink('<https://x/p?page=1>; rel="prev", <https://x/p?page=3>; rel="next"'), 'https://x/p?page=3')
    assert.equal(nextLink('<https://x/p?page=1>; rel="prev"'), null)
    assert.equal(nextLink(null), null)
  })
})

describe('conditional requests (NFR2: a 304 does not use up the rate limit)', () => {
  it('sends If-None-Match and reports "not modified" on a 304', async () => {
    const { fetchImpl, requests } = fetchFrom(new Response(null, { status: 304 }))
    const github = createGitHubClient({ token: TOKEN, fetchImpl })
    const result = await github.listPulls('o/r', { etag: '"abc"' })

    assert.equal(requests[0].headers['if-none-match'], '"abc"')
    assert.deepEqual(result, { notModified: true, items: [], etag: '"abc"' })
  })

  it('returns the new etag of the first page on a 200', async () => {
    const { fetchImpl } = fetchFrom(json([], { etag: '"new"' }))
    const result = await createGitHubClient({ token: TOKEN, fetchImpl }).listPulls('o/r', { etag: '"old"' })
    assert.equal(result.etag, '"new"')
  })
})

describe('errors', () => {
  it('reports a rate limit with the time it lifts, and never leaks the token', async () => {
    const reset = Math.floor(Date.now() / 1000) + 600
    const { fetchImpl } = fetchFrom(new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } }))
    const error = await createGitHubClient({ token: TOKEN, fetchImpl }).listCommits('o/r').catch((e) => e)

    assert.ok(error instanceof GitHubError)
    assert.equal(error.status, 403)
    assert.equal(error.resetAt.getTime(), reset * 1000)
    assert.equal(error.message.includes(TOKEN), false)
  })

  it('has plain messages for a bad token, a missing repository and other failures', async () => {
    for (const [status, pattern] of [[401, /rejected the token/], [404, /not found/], [500, /status 500/]]) {
      const { fetchImpl } = fetchFrom(new Response('{}', { status }))
      const error = await createGitHubClient({ token: TOKEN, fetchImpl }).listCommits('o/r').catch((e) => e)
      assert.match(error.message, pattern)
      assert.equal(error.message.includes(TOKEN), false)
    }
  })

  it('refuses a repository name that is not owner/name, before any request is made', async () => {
    const { fetchImpl, requests } = fetchFrom()
    const github = createGitHubClient({ token: TOKEN, fetchImpl })
    for (const name of ['../etc/passwd', 'only-one-part', 'a/b/c', '', null]) {
      await assert.rejects(() => github.listCommits(name), /owner\/name/)
    }
    assert.equal(requests.length, 0)
  })
})

describe('what GitHub sends is reduced to what the sync needs', () => {
  it('reads the author login, e-mail, message and the committer date of a commit', () => {
    const raw = {
      sha: 'abc',
      author: { login: 'ming-dev' },
      commit: { message: 'SP-1 schema', author: { email: 'a@x', date: '2026-11-15T10:00:00Z' }, committer: { date: '2026-11-15T11:00:00Z' } },
    }
    assert.deepEqual(normalizeCommit(raw), { sha: 'abc', message: 'SP-1 schema', authorLogin: 'ming-dev', authorEmail: 'a@x', committedAt: '2026-11-15T11:00:00Z' })
    assert.equal(normalizeCommit({ sha: 'z', commit: {} }).authorLogin, null)
  })

  it('calls a pull request merged only when it has a merge date', () => {
    const base = { number: 7, title: 'SP-4', head: { ref: 'a/SP-4' }, user: { login: 'u' }, updated_at: 't' }
    assert.equal(normalizePull({ ...base, state: 'closed', merged_at: '2026-11-18T00:00:00Z' }).state, 'merged')
    assert.equal(normalizePull({ ...base, state: 'closed', merged_at: null }).state, 'closed')
    assert.equal(normalizePull({ ...base, state: 'open', merged_at: null }).state, 'open')
    assert.equal(normalizePull({ ...base, state: 'open', merged_at: null }).branch, 'a/SP-4')
  })
})
