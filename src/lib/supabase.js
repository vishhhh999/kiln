import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// Hash an Anthropic API key to a stable user ID (never store the raw key in DB)
export async function hashKey(apiKey) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Validate key by making a real minimal API call
export async function validateAnthropicKey(apiKey) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    // 200 or 400 (bad request but auth passed) = valid key
    // 401 = invalid key
    if (res.status === 401) return { valid: false, error: 'Invalid API key' }
    return { valid: true }
  } catch (e) {
    return { valid: false, error: 'Network error — check connection' }
  }
}

// ─── LIBRARY (Supabase) ───────────────────────────────────────────────────────

export async function fetchLibrary(userHash) {
  const { data, error } = await supabase
    .from('kiln_generations')
    .select('id, name, material, motion, environment_id, depth, bevel, frame_count, frame_size, thumbnail, zip_path, svg_string, created_at')
    .eq('user_hash', userHash)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveGeneration(userHash, entry, zipBlob) {
  const zipPath = `${userHash}/${entry.id}.zip`

  // Upload ZIP to storage
  const { error: uploadError } = await supabase.storage
    .from('kiln-frames')
    .upload(zipPath, zipBlob, { contentType: 'application/zip', upsert: true })
  if (uploadError) throw uploadError

  // Save metadata row
  const { data, error } = await supabase
    .from('kiln_generations')
    .insert({
      id: entry.id,
      user_hash: userHash,
      name: entry.name,
      material: entry.material,
      motion: entry.motion,
      environment_id: entry.environment,
      depth: entry.depth,
      bevel: entry.bevel,
      frame_count: entry.frameCount,
      frame_size: entry.frameSize,
      thumbnail: entry.thumb,
      zip_path: zipPath,
      svg_string: entry.svgString,
    })
  if (error) throw error
  return data
}

export async function deleteGeneration(userHash, generationId, zipPath) {
  // Delete storage file
  await supabase.storage.from('kiln-frames').remove([zipPath])
  // Delete row
  const { error } = await supabase
    .from('kiln_generations')
    .delete()
    .eq('id', generationId)
    .eq('user_hash', userHash)
  if (error) throw error
}

// Download frames from ZIP in storage and reconstruct dataURLs
export async function loadFramesFromStorage(zipPath, frameCount, frameSize) {
  const { data, error } = await supabase.storage
    .from('kiln-frames')
    .download(zipPath)
  if (error) throw error

  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await data.arrayBuffer())
  const frames = []

  for (let i = 0; i < frameCount; i++) {
    const filename = `frames/frame_${String(i).padStart(3, '0')}.png`
    const file = zip.file(filename)
    if (!file) continue
    const b64 = await file.async('base64')
    frames.push(`data:image/png;base64,${b64}`)
  }

  return frames
}
