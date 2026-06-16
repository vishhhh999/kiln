import { hashKey } from './supabase.js'

const SESSION_KEY = 'kiln_session'

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveSession(apiKey, userHash) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ apiKey, userHash }))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

// Calls our own Vercel serverless proxy — avoids CORS block from browser
async function validateViaProxy(apiKey) {
  try {
    const res = await fetch('/api/verify-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    if (!res.ok) return { valid: false, error: `Server error (${res.status})` }
    return await res.json()
  } catch (e) {
    return { valid: false, error: `Network error: ${e.message}` }
  }
}

export async function login(apiKey) {
  const trimmed = apiKey.trim()

  if (!trimmed.startsWith('sk-ant-')) {
    return { success: false, error: 'Key must start with sk-ant-' }
  }

  const result = await validateViaProxy(trimmed)
  if (!result.valid) return { success: false, error: result.error }

  const userHash = await hashKey(trimmed)
  saveSession(trimmed, userHash)
  return { success: true, userHash }
}
