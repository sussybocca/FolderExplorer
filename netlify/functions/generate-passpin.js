import { createUser, getUserByUsername, createPassPin, setUserPassword, verifyUserPassword } from './lib/db.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { username, password } = JSON.parse(event.body)
    if (!username || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Username and password required' }) }
    }

    let user = await getUserByUsername(username)
    if (!user) {
      // First-time user: create and set password
      user = await createUser(username)
      await setUserPassword(user.id, password)
    } else {
      // Existing user: verify password
      const valid = await verifyUserPassword(user.id, password)
      if (!valid) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid password' }) }
      }
    }

    const pin = await createPassPin(user.id)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }
  } catch (error) {
    console.error('Error in generate-passpin:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
