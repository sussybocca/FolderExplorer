import { supabaseAdmin } from './lib/supabase.js'
import { getUserFromEvent } from './lib/auth.js'
import { getFolderById, isFolderOwner, hasAcceptedCollaboration } from './lib/db.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const user = getUserFromEvent(event)
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const { folderId, path, content } = JSON.parse(event.body)
    if (!folderId || !path || content === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: 'folderId, path, and content required' }) }
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

    const storagePath = `users/${folder.user_id}/folders/${folderId}/${path}`
    const { error } = await supabaseAdmin.storage
      .from('folders')
      .upload(storagePath, Buffer.from(content, 'utf-8'), {
        contentType: 'text/plain',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      throw error
    }

    // Update updated_at in folder_files (optional, but useful)
    await supabaseAdmin
      .from('folder_files')
      .update({ updated_at: new Date().toISOString() })
      .eq('folder_id', folderId)
      .eq('path', path)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  } catch (error) {
    console.error('Error in update-file:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
