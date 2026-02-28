import jwt from 'jsonwebtoken'
import cookie from 'cookie'

const JWT_SECRET = process.env.JWT_SECRET

export function createSessionToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  })
}

export function getUserFromEvent(event) {
  const cookies = cookie.parse(event.headers.cookie || '')
  const token = cookies.session
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded
  } catch {
    return null
  }
}

export function setSessionCookie(token) {
  return cookie.serialize('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}
