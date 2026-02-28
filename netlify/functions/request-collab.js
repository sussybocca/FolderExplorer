import { requestCollaboration, getFolderById } from './lib/db.js'
import { getUserFromEvent } from './lib/auth.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const user = getUserFromEvent(event)
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const { folderId } = JSON.parse(event.body)
    if (!folderId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Folder ID required' }) }
    }

    const folder = await getFolderById(folderId)
    if (!folder) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Folder not found' }) }
    }

    // Cannot request collaboration on own folder
    if (folder.user_id === user.userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cannot collaborate on own folder' }) }
    }

    await requestCollaboration(folderId, user.userId)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  } catch (error) {
    console.error(error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
