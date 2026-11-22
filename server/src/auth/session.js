import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_COOKIE = 'sprintproof_session'
const OAUTH_COOKIE = 'sprintproof_oauth'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7
const OAUTH_MAX_AGE = 60 * 10

function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function equal(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createSessionCookie(session, secret, secure = true, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    githubId: session.githubId,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl || null,
    team: session.team || null,
    role: session.role || 'student',
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE,
  })).toString('base64url')
  const value = `${payload}.${signature(payload, secret)}`
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? '; Secure' : ''}`
}

export function readSessionCookie(value, secret, now = Date.now()) {
  if (!value || !secret) return null
  const [payload, providedSignature, extra] = value.split('.')
  if (!payload || !providedSignature || extra || !equal(providedSignature, signature(payload, secret))) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data.githubId || !data.login || data.exp <= Math.floor(now / 1000)) return null
    return {
      githubId: data.githubId,
      login: data.login,
      name: data.name || data.login,
      avatarUrl: data.avatarUrl || null,
      team: data.team || null,
      role: data.role || 'student',
    }
  } catch {
    return null
  }
}

export function createOAuthStateCookie(returnTo, secret, secure = true) {
  const state = randomBytes(32).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    state,
    returnTo,
    exp: Math.floor(Date.now() / 1000) + OAUTH_MAX_AGE,
  })).toString('base64url')
  const value = `${payload}.${signature(payload, secret)}`
  return {
    state,
    cookie: `${OAUTH_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_MAX_AGE}${secure ? '; Secure' : ''}`,
  }
}

export function readOAuthStateCookie(value, secret) {
  if (!value || !secret) return null
  const [payload, providedSignature, extra] = value.split('.')
  if (!payload || !providedSignature || extra || !equal(providedSignature, signature(payload, secret))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof data.state === 'string'
      && typeof data.returnTo === 'string'
      && data.exp > Math.floor(Date.now() / 1000)
      ? data
      : null
  } catch {
    return null
  }
}

export function clearCookie(name, secure = true) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || ''
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim()
  }
  return null
}

export function sessionCookieName() {
  return SESSION_COOKIE
}

export function oauthCookieName() {
  return OAUTH_COOKIE
}

export function hashInviteCode(code) {
  return createHmac('sha256', 'sprintproof-team-invite').update(normalizeInviteCode(code)).digest('hex')
}

export function createInviteCode() {
  return randomBytes(24).toString('hex').toUpperCase()
}

export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}
