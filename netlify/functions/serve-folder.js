import { supabaseAdmin } from './lib/supabase.js'
import { getFolderBySlug } from './lib/db.js'
import mime from 'mime-types'

export const handler = async (event) => {
  // Extract path: /u/username/slug/rest/of/path
  const pathParts = event.path.split('/').filter(p => p)
  // pathParts = ['u', username, slug, ...rest]
  if (pathParts.length < 3 || pathParts[0] !== 'u') {
    return { statusCode: 404, body: 'Not Found' }
  }

  const username = pathParts[1]
  const slug = pathParts[2]
  const filePath = pathParts.slice(3).join('/') || 'index.html' // default to index.html

  try {
    const folder = await getFolderBySlug(username, slug)
    if (!folder) {
      return { statusCode: 404, body: 'Folder not found' }
    }

    // Construct storage path
    const storagePath = `users/${folder.user_id}/folders/${folder.id}/${filePath}`

    // Download file from Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('folders')
      .download(storagePath)

    if (error) {
      // If file not found, try index.html in that directory
      if (error.statusCode === '404' && !filePath.endsWith('/index.html')) {
        // Try with index.html appended
        const indexPath = `users/${folder.user_id}/folders/${folder.id}/${filePath}/index.html`
        const { data: indexData, error: indexError } = await supabaseAdmin.storage
          .from('folders')
          .download(indexPath)
        if (!indexError) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=300',
            },
            body: await indexData.text(),
          }
        }
      }
      return { statusCode: 404, body: 'File not found' }
    }

    const contentType = mime.lookup(filePath) || 'application/octet-stream'
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
      },
      body: await data.text(), // for binary files we need base64; we'll handle based on type
      isBase64Encoded: !contentType.startsWith('text/') && !contentType.includes('javascript') && !contentType.includes('json'),
    }
  } catch (error) {
    console.error(error)
    return { statusCode: 500, body: 'Internal server error' }
  }
}
