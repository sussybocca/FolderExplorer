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
  const plainToken = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase() // e.g., "A3F9B2C1"
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  await supabaseAdmin
    .from('passpin_tokens')
    .insert({ user_id: userId, token: hashed, expires_at: expiresAt })

  return plainToken
}

export async function verifyPassPin(username, plainToken) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex')

  // Find user
  const user = await getUserByUsername(username)
  if (!user) return null

  // Find valid token
  const { data } = await supabaseAdmin
    .from('passpin_tokens')
    .select('*')
    .eq('user_id', user.id)
    .eq('token', hashed)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) return null

  // Mark as used
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
  // First get user id
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

// ---------- Collaborations ----------
export async function requestCollaboration(folderId, userId) {
  const { error } = await supabaseAdmin
    .from('collaborations')
    .insert({ folder_id: folderId, user_id: userId })
  if (error && error.code !== '23505') throw error // ignore duplicate
}
