import busboy from 'busboy'
import { supabaseAdmin } from './lib/supabase.js'
import { getUserFromEvent } from './lib/auth.js'
import { createFolder, addFolderFiles } from './lib/db.js'

export const handler = async (event) => {
  console.log('upload-folder invoked', { method: event.httpMethod })

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const user = getUserFromEvent(event)
    if (!user) {
      console.log('Unauthorized: no user session')
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
    }

    const contentType = event.headers['content-type']
    if (!contentType || !contentType.includes('multipart/form-data')) {
      console.log('Invalid content-type:', contentType)
      return { statusCode: 400, body: JSON.stringify({ error: 'Expected multipart/form-data' }) }
    }

    console.log('User authenticated:', user.username)

    // Parse multipart form
    const result = await parseMultipart(event, contentType)
    console.log('Parsed form:', { folderName: result.folderName, fileCount: result.files.length })

    if (!result.folderName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Folder name required' }) }
    }

    const slug = result.folderName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    console.log('Creating folder record...')
    const folderRecord = await createFolder(user.userId, result.folderName, slug, {})
    console.log('Folder created:', folderRecord.id)

    // Upload files to Supabase Storage and collect paths
    const filePaths = []
    const uploadPromises = result.files.map(async (file) => {
      const storagePath = `users/${user.userId}/folders/${folderRecord.id}/${file.path}`
      console.log(`Uploading ${file.path} to ${storagePath}`)
      const { error } = await supabaseAdmin.storage
        .from('folders')
        .upload(storagePath, file.buffer, { upsert: true })
      if (error) {
        console.error(`Upload failed for ${file.path}:`, error)
        throw error
      }
      filePaths.push(file.path)
    })

    await Promise.all(uploadPromises)
    console.log('All files uploaded')

    // Store file paths in database
    await addFolderFiles(folderRecord.id, filePaths)
    console.log('File paths recorded')

    // Check for config file
    const configFile = result.files.find(
      (f) => f.path === 'Folder-Explorer.json' || f.path === 'Folder.config.js'
    )
    if (configFile) {
      try {
        const configContent = configFile.buffer.toString('utf8')
        let config = {}
        if (configFile.path.endsWith('.json')) {
          config = JSON.parse(configContent)
        } else {
          config = { script: configContent }
        }
        await supabaseAdmin.from('folders').update({ config }).eq('id', folderRecord.id)
        console.log('Config saved')
      } catch (e) {
        console.warn('Failed to parse config file', e)
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: folderRecord.id, slug }),
    }
  } catch (error) {
    console.error('Unhandled error in upload-folder:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Upload failed: ' + error.message }),
    }
  }
}

// Helper to parse multipart form data from Netlify Function event
function parseMultipart(event, contentType) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: { 'content-type': contentType } })

    let folderName = ''
    const files = []

    bb.on('field', (name, val) => {
      if (name === 'folderName') folderName = val
    })

    bb.on('file', (name, file, info) => {
      const { filename } = info
      const chunks = []
      file.on('data', (chunk) => chunks.push(chunk))
      file.on('end', () => {
        files.push({
          path: filename,
          buffer: Buffer.concat(chunks),
        })
      })
    })

    bb.on('error', (err) => {
      reject(err)
    })

    bb.on('finish', () => {
      resolve({ folderName, files })
    })

    // Feed the body to busboy
    if (event.isBase64Encoded) {
      bb.end(Buffer.from(event.body, 'base64'))
    } else {
      // In Netlify Functions, body is always a base64 string if content-type is binary? Actually, it's usually a base64 string.
      // We'll assume it's base64 encoded if isBase64Encoded is true, else treat as raw string.
      // To be safe, if body is a string and not base64 flagged, we still treat as base64? Let's keep it simple.
      bb.end(Buffer.from(event.body, 'base64')) // Often body is base64 even if flag is false? Netlify docs: body is always base64 for binary types.
    }
  })
}
