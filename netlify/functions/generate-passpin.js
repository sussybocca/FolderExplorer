import { createUser, getUserByUsername, createPassPin } from './lib/db.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { username } = JSON.parse(event.body)
    if (!username || typeof username !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Username required' }) }
    }

    // Get or create user
    let user = await getUserByUsername(username)
    if (!user) {
      user = await createUser(username)
    }

    const pin = await createPassPin(user.id)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }
  } catch (error) {
    console.error(error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
