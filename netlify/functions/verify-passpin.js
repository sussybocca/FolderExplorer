import { verifyPassPin } from './lib/db.js'
import { createSessionToken, setSessionCookie } from './lib/auth.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { username, pin } = JSON.parse(event.body)
    if (!username || !pin) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Username and pin required' }) }
    }

    const user = await verifyPassPin(username, pin)
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired pin' }) }
    }

    const token = createSessionToken(user)
    const cookie = setSessionCookie(token)

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, user: { id: user.id, username: user.username } }),
    }
  } catch (error) {
    console.error(error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
