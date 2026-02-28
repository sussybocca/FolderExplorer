import { supabaseAdmin } from './lib/supabase.js'
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
  const filePath = event.queryStringParameters?.path
  if (!folderId || !filePath) {
    return { statusCode: 400, body: JSON.stringify({ error: 'folderId and path required' }) }
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

    const storagePath = `users/${folder.user_id}/folders/${folderId}/${filePath}`
    const { data, error } = await supabaseAdmin.storage
      .from('folders')
      .download(storagePath)

    if (error) {
      console.error('Download error:', error)
      return { statusCode: 404, body: JSON.stringify({ error: 'File not found' }) }
    }

    const content = await data.text()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  } catch (error) {
    console.error('Error in get-file:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
