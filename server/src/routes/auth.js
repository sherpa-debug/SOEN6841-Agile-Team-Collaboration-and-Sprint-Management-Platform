import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import {
  clearCookie,
  createInviteCode,
  createOAuthStateCookie,
  createSessionCookie,
  getCookie,
  hashInviteCode,
  normalizeInviteCode,
  oauthCookieName,
  readOAuthStateCookie,
  readSessionCookie,
  sessionCookieName,
} from '../auth/session.js'
import { getDatabasePool } from '../database.js'

function isSecure(request) {
  return request.secure || process.env.NODE_ENV === 'production'
}

function appOrigin(request, env) {
  return (env.APP_ORIGIN || `${request.protocol}://${request.get('host')}`).replace(/\/+$/, '')
}

function safeReturnTo(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !/[\r\n]/.test(value)
    ? value
    : '/'
}

function getSession(request, secret) {
  const token = getCookie(request, sessionCookieName())
  return token ? readSessionCookie(token, secret) : null
}

function sendError(response, status, message) {
  return response.status(status).json({ error: message })
}

async function saveGitHubUser(pool, profile) {
  const found = await pool.query(
    `SELECT id FROM app_user WHERE github_id = $1 LIMIT 1`,
    [String(profile.id)],
  )
  const existing = found.rowCount ? found : await pool.query(
    `SELECT id FROM app_user WHERE lower(github_login) = lower($1) AND github_id IS NULL LIMIT 1`,
    [profile.login],
  )

  if (existing.rowCount) {
    const updated = await pool.query(
      `UPDATE app_user
       SET github_id = $1, github_login = $2, name = $3, avatar_url = $4
       WHERE id = $5
       RETURNING id, role`,
      [String(profile.id), profile.login, profile.name || profile.login, profile.avatar_url || null, existing.rows[0].id],
    )
    return updated.rows[0]
  }

  const inserted = await pool.query(
    `INSERT INTO app_user (github_id, github_login, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role`,
    [String(profile.id), profile.login, profile.name || profile.login, profile.avatar_url || null],
  )
  return inserted.rows[0]
}

export function createAuthRouter({
  pool,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const router = Router()
  const database = () => pool || getDatabasePool()

  router.use((request, response, next) => {
    if (request.method !== 'POST') return next()
    const origin = request.get('origin')
    const expectedOrigin = env.APP_ORIGIN
      ? env.APP_ORIGIN.replace(/\/+$/, '')
      : `${request.protocol}://${request.get('host')}`
    if (origin !== expectedOrigin) return sendError(response, 403, 'Request origin is not allowed.')
    return next()
  })

  router.get('/auth/github', (request, response) => {
    const clientId = env.GITHUB_CLIENT_ID
    const sessionSecret = env.SESSION_SECRET
    if (!clientId || !sessionSecret || sessionSecret.length < 32) {
      return sendError(response, 503, 'GitHub sign-in is not configured on the server.')
    }

    const origin = appOrigin(request, env)
    const { state, cookie } = createOAuthStateCookie(
      safeReturnTo(request.query.returnTo),
      sessionSecret,
      isSecure(request),
    )
    const authorize = new URL('https://github.com/login/oauth/authorize')
    authorize.searchParams.set('client_id', clientId)
    authorize.searchParams.set('redirect_uri', `${origin}/api/auth/callback`)
    authorize.searchParams.set('scope', 'read:user')
    authorize.searchParams.set('state', state)
    response.setHeader('Set-Cookie', cookie)
    return response.redirect(authorize.toString())
  })

  router.get('/auth/callback', async (request, response, next) => {
    const sessionSecret = env.SESSION_SECRET
    const clearOAuthCookie = clearCookie(oauthCookieName(), isSecure(request))
    const redirectError = () => response.redirect('/?authError=github')
    if (!sessionSecret || sessionSecret.length < 32 || request.query.error) {
      response.setHeader('Set-Cookie', clearOAuthCookie)
      return redirectError()
    }

    const oauth = readOAuthStateCookie(getCookie(request, oauthCookieName()), sessionSecret)
    if (!oauth || oauth.state !== request.query.state) {
      response.setHeader('Set-Cookie', clearOAuthCookie)
      return redirectError()
    }

    const clientId = env.GITHUB_CLIENT_ID
    const clientSecret = env.GITHUB_CLIENT_SECRET
    const code = request.query.code
    if (!clientId || !clientSecret || typeof code !== 'string') {
      response.setHeader('Set-Cookie', clearOAuthCookie)
      return redirectError()
    }

    try {
      const callbackUrl = `${appOrigin(request, env)}/api/auth/callback`
      const tokenResponse = await fetchImpl('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      })
      if (!tokenResponse.ok) throw new Error('GitHub token exchange failed.')
      const tokenData = await tokenResponse.json()
      if (!tokenData.access_token) throw new Error('GitHub did not return an access token.')

      const profileResponse = await fetchImpl('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${tokenData.access_token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (!profileResponse.ok) throw new Error('GitHub profile lookup failed.')
      const profile = await profileResponse.json()
      if (!profile.id || !profile.login) throw new Error('GitHub returned an incomplete profile.')

      const user = await saveGitHubUser(database(), profile)
      const session = {
        githubId: String(profile.id),
        login: profile.login,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url || null,
        role: user.role,
        team: user.role === 'student' ? null : { id: '*', name: 'All teams' },
      }
      response.setHeader('Set-Cookie', [
        clearOAuthCookie,
        createSessionCookie(session, sessionSecret, isSecure(request)),
      ])
      return response.redirect(safeReturnTo(oauth.returnTo))
    } catch (error) {
      console.error('GitHub OAuth callback failed:', error)
      response.setHeader('Set-Cookie', clearOAuthCookie)
      return redirectError()
    }
  })

  router.get('/auth/session', (request, response) => {
    const session = env.SESSION_SECRET ? getSession(request, env.SESSION_SECRET) : null
    return response.json({ session })
  })

  router.post('/auth/logout', (request, response) => {
    return response.status(200)
      .setHeader('Set-Cookie', clearCookie(sessionCookieName(), isSecure(request)))
      .json({ ok: true })
  })

  router.post('/teams', async (request, response, next) => {
    const session = env.SESSION_SECRET ? getSession(request, env.SESSION_SECRET) : null
    if (!session) return sendError(response, 401, 'Sign in with GitHub to create a team.')
    if (session.role !== 'student') return sendError(response, 403, 'Staff accounts cannot create teams.')
    if (session.team) return sendError(response, 409, 'You already belong to a team.')
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
    if (name.length < 2 || name.length > 60) {
      return sendError(response, 400, 'Team name must be between 2 and 60 characters.')
    }

    const client = await database().connect().catch(next)
    if (!client) return undefined
    try {
      await client.query('BEGIN')
      const membership = await client.query(
        'SELECT id FROM app_user WHERE github_id = $1 FOR UPDATE',
        [session.githubId],
      )
      if (!membership.rowCount) throw new Error('Signed-in user is missing from the database.')
      const existingMembership = await client.query(
        'SELECT 1 FROM team_member WHERE user_id = $1 LIMIT 1',
        [membership.rows[0].id],
      )
      if (existingMembership.rowCount) {
        await client.query('ROLLBACK')
        return sendError(response, 409, 'You already belong to a team.')
      }

      let course = await client.query('SELECT id FROM course ORDER BY id LIMIT 1')
      if (!course.rowCount) {
        course = await client.query(
          "INSERT INTO course (name, term) VALUES ('SprintProof', 'Current') RETURNING id",
        )
      }
      const team = await client.query(
        'INSERT INTO team (course_id, name, invite_code) VALUES ($1, $2, $3) RETURNING id, name',
        [course.rows[0].id, name, randomBytes(24).toString('hex')],
      )
      await client.query(
        'INSERT INTO team_member (team_id, user_id) VALUES ($1, $2)',
        [team.rows[0].id, membership.rows[0].id],
      )
      await client.query('COMMIT')

      const nextSession = {
        ...session,
        team: { id: String(team.rows[0].id), name: team.rows[0].name },
      }
      response.setHeader('Set-Cookie', createSessionCookie(nextSession, env.SESSION_SECRET, isSecure(request)))
      return response.status(201).json({ session: nextSession })
    } catch (error) {
      await client.query('ROLLBACK')
      return next(error)
    } finally {
      client.release()
    }
  })

  router.post('/teams/invites', async (request, response, next) => {
    const session = env.SESSION_SECRET ? getSession(request, env.SESSION_SECRET) : null
    if (!session?.team) return sendError(response, 401, 'Sign in and join a team before inviting members.')
    if (session.role !== 'student') return sendError(response, 403, 'Staff accounts cannot invite members.')

    try {
      const membership = await database().query(
        `SELECT tm.user_id
         FROM team_member tm
         JOIN app_user u ON u.id = tm.user_id
         WHERE tm.team_id = $1 AND u.github_id = $2`,
        [session.team.id, session.githubId],
      )
      if (!membership.rowCount) return sendError(response, 403, 'You are not a member of this team.')

      const code = createInviteCode()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await database().query(
        'INSERT INTO team_invite (code_hash, team_id, created_by, expires_at) VALUES ($1, $2, $3, $4)',
        [hashInviteCode(code), session.team.id, membership.rows[0].user_id, expiresAt],
      )
      return response.status(201).json({ code, expiresAt: expiresAt.toISOString() })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/teams/join', async (request, response, next) => {
    const session = env.SESSION_SECRET ? getSession(request, env.SESSION_SECRET) : null
    if (!session) return sendError(response, 401, 'Sign in with GitHub to join a team.')
    if (session.role !== 'student') return sendError(response, 403, 'Staff accounts cannot join student teams.')
    if (session.team) return sendError(response, 409, 'You already belong to a team.')
    const code = normalizeInviteCode(request.body?.code)
    if (code.length < 20 || code.length > 64) return sendError(response, 400, 'Enter a valid team invitation.')

    const client = await database().connect().catch(next)
    if (!client) return undefined
    try {
      await client.query('BEGIN')
      const user = await client.query(
        'SELECT id FROM app_user WHERE github_id = $1 FOR UPDATE',
        [session.githubId],
      )
      if (!user.rowCount) {
        await client.query('ROLLBACK')
        return sendError(response, 401, 'Your GitHub account is no longer available.')
      }
      const existingMembership = await client.query(
        'SELECT 1 FROM team_member WHERE user_id = $1 LIMIT 1',
        [user.rows[0].id],
      )
      if (existingMembership.rowCount) {
        await client.query('ROLLBACK')
        return sendError(response, 409, 'You already belong to a team.')
      }

      const invite = await client.query(
        `SELECT i.team_id, t.name AS team_name, u.id AS user_id
         FROM team_invite i
         JOIN team t ON t.id = i.team_id
         JOIN app_user u ON u.id = $2
         WHERE i.code_hash = $1 AND i.expires_at > now()
         FOR UPDATE OF i`,
        [hashInviteCode(code), user.rows[0].id],
      )
      if (!invite.rowCount) {
        await client.query('ROLLBACK')
        return sendError(response, 404, 'This invitation is invalid or has expired.')
      }
      await client.query(
        'INSERT INTO team_member (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [invite.rows[0].team_id, invite.rows[0].user_id],
      )
      await client.query('COMMIT')
      const nextSession = {
        ...session,
        team: { id: String(invite.rows[0].team_id), name: invite.rows[0].team_name },
      }
      response.setHeader('Set-Cookie', createSessionCookie(nextSession, env.SESSION_SECRET, isSecure(request)))
      return response.json({ session: nextSession })
    } catch (error) {
      await client.query('ROLLBACK')
      return next(error)
    } finally {
      client.release()
    }
  })

  return router
}

export default createAuthRouter
