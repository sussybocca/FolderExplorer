import { getUserFromEvent } from './lib/auth.js'
import { getFolderById, isFolderOwner, hasAcceptedCollaboration, listFolderFiles } from './lib/db.js'

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

    const files = await listFolderFiles(folderId)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(files),
    }
  } catch (error) {
    console.error('Error in list-files:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
