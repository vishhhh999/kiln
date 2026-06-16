import { hashKey, validateAnthropicKey } from './supabase.js'

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

export async function login(apiKey) {
  const trimmed = apiKey.trim()
  if (!trimmed.startsWith('sk-ant-')) {
    return { success: false, error: 'Key must start with sk-ant-' }
  }
  const result = await validateAnthropicKey(trimmed)
  if (!result.valid) return { success: false, error: result.error }
  const userHash = await hashKey(trimmed)
  saveSession(trimmed, userHash)
  return { success: true, userHash }
}
