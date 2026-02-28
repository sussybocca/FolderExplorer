import { supabaseAdmin } from './supabase.js'
import crypto from 'crypto'

// ---------- Users ----------
export async function getUserByUsername(username) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  return data
}

export async function createUser(username) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ username })
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- PassPin ----------
export async function createPassPin(userId) {
  const plainToken = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase()
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('passpin_tokens')
    .insert({ user_id: userId, token: hashed, expires_at: expiresAt })

  return plainToken
}

export async function verifyPassPin(username, plainToken) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex')

  const user = await getUserByUsername(username)
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('passpin_tokens')
    .select('*')
    .eq('user_id', user.id)
    .eq('token', hashed)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) return null

  await supabaseAdmin
    .from('passpin_tokens')
    .update({ used: true })
    .eq('id', data.id)

  return user
}

// ---------- Folders ----------
export async function createFolder(userId, name, slug, config) {
  const { data, error } = await supabaseAdmin
    .from('folders')
    .insert({ user_id: userId, name, slug, config })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getFolders(limit = 50) {
  const { data } = await supabaseAdmin
    .from('folders')
    .select('*, users(username)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function getFolderBySlug(username, slug) {
  const user = await getUserByUsername(username)
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('folders')
    .select('*')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .maybeSingle()
  return data
}

export async function getFolderById(folderId) {
  const { data } = await supabaseAdmin
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .maybeSingle()
  return data
}

// ---------- Folder Files ----------
export async function addFolderFiles(folderId, filePaths) {
  const inserts = filePaths.map(path => ({ folder_id: folderId, path }))
  const { error } = await supabaseAdmin
    .from('folder_files')
    .insert(inserts, { onConflict: 'folder_id,path' })
  if (error) throw error
}

export async function listFolderFiles(folderId) {
  const { data } = await supabaseAdmin
    .from('folder_files')
    .select('path, updated_at')
    .eq('folder_id', folderId)
    .order('path')
  return data || []
}

// ---------- Collaborations ----------
export async function requestCollaboration(folderId, userId) {
  const { error } = await supabaseAdmin
    .from('collaborations')
    .insert({ folder_id: folderId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function isFolderOwner(folderId, userId) {
  const folder = await getFolderById(folderId)
  return folder && folder.user_id === userId
}

export async function hasAcceptedCollaboration(folderId, userId) {
  const { data } = await supabaseAdmin
    .from('collaborations')
    .select('*')
    .eq('folder_id', folderId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle()
  return !!data
}

// ---------- User's folders (owned + collaborated) ----------
export async function getUserFolders(userId) {
  // Folders where user is owner
  const { data: owned } = await supabaseAdmin
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  // Folders where user is accepted collaborator
  const { data: collabFolders } = await supabaseAdmin
    .from('collaborations')
    .select('folder_id, folders(*)')
    .eq('user_id', userId)
    .eq('status', 'accepted')

  const collaborated = collabFolders?.map(c => c.folders) || []
  const allFolders = [...(owned || []), ...collaborated]
  // Remove duplicates if any (shouldn't happen)
  const unique = Array.from(new Map(allFolders.map(f => [f.id, f])).values())
  return unique
}

// ---------- Collaboration requests for folders owned by user ----------
export async function getPendingCollaborationRequests(userId) {
  const { data } = await supabaseAdmin
    .from('collaborations')
    .select('*, users(username), folders(name, slug)')
    .eq('status', 'pending')
    .in('folder_id', 
      supabaseAdmin
        .from('folders')
        .select('id')
        .eq('user_id', userId)
    )
  return data || []
}

// ---------- Accept or reject collaboration ----------
export async function updateCollaborationStatus(collabId, status) {
  const { error } = await supabaseAdmin
    .from('collaborations')
    .update({ status })
    .eq('id', collabId)
  if (error) throw error
}
