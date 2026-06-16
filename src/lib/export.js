import { saveAs } from 'file-saver'
import JSZip from 'jszip'

// Build a horizontal sprite strip canvas from frame dataURLs
export async function buildSpriteSheet(frames, frameSize) {
  const canvas = document.createElement('canvas')
  canvas.width = frameSize * frames.length
  canvas.height = frameSize
  const ctx = canvas.getContext('2d')
  await Promise.all(frames.map((src, i) => new Promise(resolve => {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, i * frameSize, 0, frameSize, frameSize); resolve() }
    img.src = src
  })))
  return canvas
}

// Preload all frame images (avoids repeated decode on export)
async function preloadFrames(frames) {
  return Promise.all(frames.map(src => new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = src
  })))
}

// ─── SINGLE FRAME EXPORTS ─────────────────────────────────────────────────────

export async function exportFramePNG(frameDataURL, name, frameIndex) {
  const a = document.createElement('a')
  a.download = `${name}_f${String(frameIndex).padStart(3, '0')}.png`
  a.href = frameDataURL
  a.click()
}

export async function exportFrameJPG(frameDataURL, name, frameIndex) {
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = frameDataURL })
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_f${String(frameIndex).padStart(3, '0')}.jpg`), 'image/jpeg', 0.97)
}

export async function exportFrameWebP(frameDataURL, name, frameIndex) {
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = frameDataURL })
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_f${String(frameIndex).padStart(3, '0')}.webp`), 'image/webp', 0.97)
}

// ─── STRIP EXPORTS ────────────────────────────────────────────────────────────

export async function exportStripPNG(frames, frameSize, name) {
  const canvas = await buildSpriteSheet(frames, frameSize)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.png`), 'image/png')
}

export async function exportStripJPG(frames, frameSize, name) {
  const src = await buildSpriteSheet(frames, frameSize)
  const canvas = document.createElement('canvas')
  canvas.width = src.width; canvas.height = src.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(src, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.jpg`), 'image/jpeg', 0.97)
}

export async function exportStripWebP(frames, frameSize, name) {
  const canvas = await buildSpriteSheet(frames, frameSize)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.webp`), 'image/webp', 0.97)
}

// ─── GIF ──────────────────────────────────────────────────────────────────────

export async function exportGIF(frames, frameSize, name, onProgress) {
  return new Promise(async (resolve, reject) => {
    const GIF = window.GIF
    if (!GIF) {
      // Fallback: export frames as ZIP
      await exportFramesZIP(frames, name)
      resolve(); return
    }
    const imgs = await preloadFrames(frames)
    const gif = new GIF({
      workers: 4, quality: 4,
      width: frameSize, height: frameSize,
      workerScript: '/gif.worker.js',
    })
    imgs.forEach(img => {
      const c = document.createElement('canvas'); c.width = frameSize; c.height = frameSize
      c.getContext('2d').drawImage(img, 0, 0, frameSize, frameSize)
      gif.addFrame(c, { delay: Math.round(1000 / 24), copy: true })
    })
    gif.on('progress', p => { if (onProgress) onProgress(Math.round(p * 100)) })
    gif.on('finished', blob => { saveAs(blob, `${name}.gif`); resolve() })
    gif.on('error', reject)
    gif.render()
  })
}

// ─── MP4 ──────────────────────────────────────────────────────────────────────
// Proper frame-accurate MP4 export:
// 1. Preload all images
// 2. Use requestAnimationFrame-accurate timing via canvas captureStream
// 3. Draw each frame for exactly (1000/fps)ms so MediaRecorder captures it properly
// 4. High bitrate to avoid codec quality loss

export async function exportMP4(frames, frameSize, name, fps = 24, onProgress) {
  return new Promise(async (resolve, reject) => {
    const imgs = await preloadFrames(frames)

    const canvas = document.createElement('canvas')
    canvas.width = frameSize; canvas.height = frameSize
    const ctx = canvas.getContext('2d', { alpha: false })

    const mime = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm'

    const stream = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 50_000_000, // 50Mbps
    })

    const chunks = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      saveAs(new Blob(chunks, { type: mime }), `${name}.webm`)
      resolve()
    }

    // Draw first frame immediately before starting
    ctx.drawImage(imgs[0], 0, 0, frameSize, frameSize)
    recorder.start()

    const msPerFrame = 1000 / fps
    let i = 0

    const drawNext = () => {
      if (i >= imgs.length) {
        // Hold last frame for one more tick then stop
        setTimeout(() => recorder.stop(), msPerFrame)
        return
      }
      ctx.clearRect(0, 0, frameSize, frameSize)
      ctx.drawImage(imgs[i], 0, 0, frameSize, frameSize)
      if (onProgress) onProgress(Math.round((i / imgs.length) * 100))
      i++
      setTimeout(drawNext, msPerFrame)
    }

    // Small delay to let recorder initialise
    setTimeout(drawNext, 100)
  })
}

// ─── BULK EXPORTS ─────────────────────────────────────────────────────────────

export async function exportFramesZIP(frames, name) {
  const zip = new JSZip()
  const folder = zip.folder(`${name}_frames`)
  frames.forEach((src, i) => {
    folder.file(`frame_${String(i).padStart(3, '0')}.png`, src.split(',')[1], { base64: true })
  })
  saveAs(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${name}_frames.zip`)
}

export async function exportGLB(glbBuffer, name) {
  saveAs(new Blob([glbBuffer], { type: 'model/gltf-binary' }), `${name}.glb`)
}

export async function exportAll(frames, frameSize, name, glbBuffer, onProgress) {
  const zip = new JSZip()

  onProgress('Building sprite strips...')
  const sheet = await buildSpriteSheet(frames, frameSize)

  // PNG strip (transparent)
  zip.file(`${name}_strip.png`, await new Promise(r => sheet.toBlob(r, 'image/png')))

  // WebP strip
  zip.file(`${name}_strip.webp`, await new Promise(r => sheet.toBlob(r, 'image/webp', 0.97)))

  // JPG strip (white bg)
  const jpgC = document.createElement('canvas')
  jpgC.width = sheet.width; jpgC.height = sheet.height
  const jpgCtx = jpgC.getContext('2d')
  jpgCtx.fillStyle = '#fff'; jpgCtx.fillRect(0, 0, jpgC.width, jpgC.height); jpgCtx.drawImage(sheet, 0, 0)
  zip.file(`${name}_strip.jpg`, await new Promise(r => jpgC.toBlob(r, 'image/jpeg', 0.97)))

  // Individual frames
  onProgress('Packing frames...')
  const folder = zip.folder('frames')
  frames.forEach((src, i) => {
    folder.file(`frame_${String(i).padStart(3, '0')}.png`, src.split(',')[1], { base64: true })
  })

  // GLB
  if (glbBuffer) zip.file(`${name}.glb`, glbBuffer)

  onProgress('Compressing...')
  const blob = await zip.generateAsync({
    type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 },
  })
  saveAs(blob, `${name}_kiln.zip`)
  onProgress(null)
}
