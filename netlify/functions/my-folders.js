import { getUserFromEvent } from './lib/auth.js'
import { getUserFolders } from './lib/db.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const user = getUserFromEvent(event)
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const folders = await getUserFolders(user.userId)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(folders),
    }
  } catch (error) {
    console.error(error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
