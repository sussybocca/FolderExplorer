import { getUserFromEvent } from './lib/auth.js'
import { getFolderById, isFolderOwner, hasAcceptedCollaboration } from './lib/db.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const user = getUserFromEvent(event)
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const folderId = event.queryStringParameters?.folderId
  if (!folderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'folderId required' }) }
  }

  try {
    const folder = await getFolderById(folderId)
    if (!folder) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Folder not found' }) }
    }

    const owner = await isFolderOwner(folderId, user.userId)
    const collaborator = await hasAcceptedCollaboration(folderId, user.userId)
    if (!owner && !collaborator) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Access denied' }) }
    }

    // Return config (or empty object if none)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(folder.config || {}),
    }
  } catch (error) {
    console.error('Error in get-folder-config:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
