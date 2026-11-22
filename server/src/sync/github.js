// A small GitHub REST client for the sync job (FR4, NFR2, NFR4). Read-only: it lists commits
// and pull requests. The token is only ever sent to GitHub in the Authorization header; it is
// never logged, put in an error message or returned (NFR3).

const API = 'https://api.github.com'
const REPO = /^[\w.-]+\/[\w.-]+$/

export class GitHubError extends Error {
  constructor(message, { status = null, resetAt = null } = {}) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
    this.resetAt = resetAt // when a rate limit lifts (a Date), if GitHub said
  }
}

// The URL after rel="next" in a Link header, or null on the last page
export function nextLink(header) {
  for (const part of String(header ?? '').split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/)
    if (match) return match[1]
  }
  return null
}

function errorFor(response) {
  const { status } = response
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  if ((status === 403 || status === 429) && (remaining === '0' || response.headers.has('retry-after'))) {
    return new GitHubError('GitHub rate limit reached.', { status, resetAt: reset ? new Date(reset * 1000) : null })
  }
  if (status === 401) return new GitHubError('GitHub rejected the token.', { status })
  if (status === 404) return new GitHubError('Repository not found, or the token cannot read it.', { status })
  return new GitHubError(`GitHub answered with status ${status}.`, { status })
}

export function normalizeCommit(raw) {
  return {
    sha: raw.sha,
    message: raw.commit?.message ?? '',
    authorLogin: raw.author?.login ?? null,
    authorEmail: raw.commit?.author?.email ?? null,
    committedAt: raw.commit?.committer?.date ?? raw.commit?.author?.date ?? null,
  }
}

export function normalizePull(raw) {
  return {
    number: raw.number,
    title: raw.title ?? '',
    branch: raw.head?.ref ?? '',
    authorLogin: raw.user?.login ?? null,
    state: raw.merged_at ? 'merged' : raw.state === 'open' ? 'open' : 'closed',
    mergedAt: raw.merged_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export function createGitHubClient({ token, fetchImpl = globalThis.fetch, baseUrl = API, maxPages = 100 } = {}) {
  async function getPages(path, { params = {}, etag = null } = {}) {
    const url = new URL(baseUrl + path)
    url.searchParams.set('per_page', '100')
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

    const items = []
    let firstEtag = null
    let next = url.toString()
    let pages = 0
    while (next) {
      if (pages >= maxPages) throw new GitHubError('Too many pages for one sync.')
      const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'sprintproof-sync' }
      if (token) headers.authorization = `Bearer ${token}`
      if (etag && pages === 0) headers['if-none-match'] = etag // a 304 does not use up the rate limit

      const response = await fetchImpl(next, { headers })
      if (response.status === 304) return { notModified: true, items: [], etag }
      if (!response.ok) throw errorFor(response)
      if (pages === 0) firstEtag = response.headers.get('etag')
      items.push(...(await response.json()))
      next = nextLink(response.headers.get('link'))
      pages += 1
    }
    return { notModified: false, items, etag: firstEtag }
  }

  const path = (repo, rest) => {
    if (!REPO.test(repo ?? '')) throw new GitHubError('The repository must look like owner/name.')
    return `/repos/${repo}${rest}`
  }

  return {
    // Commits on the default branch, newest first; `since` (a Date) is how a sync catches up
    async listCommits(repo, { since = null } = {}) {
      const params = since ? { since: since.toISOString() } : {}
      const result = await getPages(path(repo, '/commits'), { params })
      return { ...result, items: result.items.map(normalizeCommit) }
    },
    // Pull requests of any state, most recently updated first
    async listPulls(repo, { etag = null } = {}) {
      const result = await getPages(path(repo, '/pulls'), { params: { state: 'all', sort: 'updated', direction: 'desc' }, etag })
      return { ...result, items: result.items.map(normalizePull) }
    },
    // The commit hashes inside one pull request
    async listPullCommits(repo, number) {
      const result = await getPages(path(repo, `/pulls/${Number(number)}/commits`))
      return result.items.map((item) => item.sha)
    },
  }
}
