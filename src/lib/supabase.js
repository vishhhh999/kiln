import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Hash an Anthropic API key → stable user ID. Key never leaves the client.
export async function hashKey(apiKey) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── LIBRARY ──────────────────────────────────────────────────────────────────

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

  const { error: uploadError } = await supabase.storage
    .from('kiln-frames')
    .upload(zipPath, zipBlob, { contentType: 'application/zip', upsert: true })
  if (uploadError) throw uploadError

  const { error } = await supabase
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
}

export async function deleteGeneration(userHash, generationId, zipPath) {
  await supabase.storage.from('kiln-frames').remove([zipPath])
  const { error } = await supabase
    .from('kiln_generations')
    .delete()
    .eq('id', generationId)
    .eq('user_hash', userHash)
  if (error) throw error
}

export async function loadFramesFromStorage(zipPath, frameCount) {
  const { data, error } = await supabase.storage
    .from('kiln-frames')
    .download(zipPath)
  if (error) throw error

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
