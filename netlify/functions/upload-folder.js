import busboy from 'busboy'
import { supabaseAdmin } from './lib/supabase.js'
import { getUserFromEvent } from './lib/auth.js'
import { createFolder } from './lib/db.js'
import { v4 as uuidv4 } from 'uuid'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const user = getUserFromEvent(event)
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const contentType = event.headers['content-type']
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Expected multipart/form-data' }) }
  }

  return new Promise((resolve) => {
    const bb = busboy({ headers: { 'content-type': contentType } })

    let folderName = ''
    const files = [] // { path, buffer, mimeType }

    bb.on('field', (name, val) => {
      if (name === 'folderName') folderName = val
    })

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info
      const chunks = []
      file.on('data', (chunk) => chunks.push(chunk))
      file.on('end', () => {
        files.push({
          path: filename, // includes relative path (browser gives full relative path)
          buffer: Buffer.concat(chunks),
          mimeType,
        })
      })
    })

    bb.on('finish', async () => {
      try {
        if (!folderName) {
          return resolve({ statusCode: 400, body: JSON.stringify({ error: 'Folder name required' }) })
        }

        // Create folder record
        const slug = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const folderRecord = await createFolder(user.userId, folderName, slug, {})

        // Upload files to Supabase Storage
        const uploadPromises = files.map(async (file) => {
          const storagePath = `users/${user.userId}/folders/${folderRecord.id}/${file.path}`
          const { error } = await supabaseAdmin.storage
            .from('folders')
            .upload(storagePath, file.buffer, {
              contentType: file.mimeType,
              upsert: true,
            })
          if (error) throw error
        })

        await Promise.all(uploadPromises)

        // Check for config file
        const configFile = files.find(f => f.path === 'Folder-Explorer.json' || f.path === 'Folder.config.js')
        if (configFile) {
          try {
            const configContent = configFile.buffer.toString('utf8')
            // If it's a .js file, we cannot execute it; we'll just store the raw content
            // For JSON, parse and store
            let config = {}
            if (configFile.path.endsWith('.json')) {
              config = JSON.parse(configContent)
            } else {
              // For .js, just store as string (could be evaluated later if needed)
              config = { script: configContent }
            }
            await supabaseAdmin
              .from('folders')
              .update({ config })
              .eq('id', folderRecord.id)
          } catch (e) {
            console.warn('Failed to parse config file', e)
          }
        }

        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: folderRecord.id, slug }),
        })
      } catch (error) {
        console.error(error)
        resolve({ statusCode: 500, body: JSON.stringify({ error: 'Upload failed' }) })
      }
    })

    bb.end(Buffer.from(event.body, 'base64')) // event.body is base64 when using binary support? In Netlify, body is raw buffer if binary set. We'll rely on default.
    // Actually, Netlify Functions receive body as base64 if binary content types. We'll handle both.
    // For simplicity, we assume event.isBase64Encoded = true for multipart.
    if (event.isBase64Encoded) {
      bb.end(Buffer.from(event.body, 'base64'))
    } else {
      bb.end(event.body)
    }
  })
}
