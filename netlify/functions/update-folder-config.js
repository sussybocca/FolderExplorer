import { getUserFromEvent } from './lib/auth.js'
import { getFolderById, isFolderOwner, hasAcceptedCollaboration, updateFolderConfig } from './lib/db.js'
import bcrypt from 'bcryptjs'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const user = getUserFromEvent(event)
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const { folderId, config } = JSON.parse(event.body)
    if (!folderId || !config) {
      return { statusCode: 400, body: JSON.stringify({ error: 'folderId and config required' }) }
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

    // If password is being set, hash it
    if (config.adminPassword && !config.adminPassword.startsWith('$2a$')) {
      config.adminPassword = await bcrypt.hash(config.adminPassword, 10)
    }

    // Merge with existing config
    const newConfig = { ...(folder.config || {}), ...config }
    await updateFolderConfig(folderId, newConfig)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, config: newConfig }),
    }
  } catch (error) {
    console.error('Error in update-folder-config:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}
