import { getUserFromEvent } from './lib/auth.js'
import { getFolderById, isFolderOwner, hasAcceptedCollaboration } from './lib/db.js'
import crypto from 'crypto'

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
      return { statusCode: 400, body: JSON.stringify({ error: 'folderId required' }) }
    }

    const folder = await getFolderById(folderId)
    if (!folder) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Folder not found' }) }
    }

    const owner = await isFolderOwner(folderId, user.userId)
    const collaborator = await hasAcceptedCollaboration(folderId, user.userId)
    if (!owner && !collaborator) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Access denied' }) }
    }

    // Generate a 8-character token
    const plainToken = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase()
    // In a real implementation, you'd store this in a table with expiry, but for simplicity we just return it.
    // You could store it in folder config as a temporary token, but better to have a separate table.
    // For now, we'll just return it and assume the owner shares it manually.
    
    // Option: store hashed token in folder config? That would allow single-use.
    // We'll keep it simple for this example.
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passpin: plainToken }),
    }
  } catch (error) {
    console.error('Error in generate-folder-passpin:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
