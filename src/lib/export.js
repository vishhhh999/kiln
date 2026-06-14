import { saveAs } from 'file-saver'
import JSZip from 'jszip'

// Build a horizontal sprite strip canvas from frame dataURLs
export async function buildSpriteSheet(frames, frameSize) {
  const canvas = document.createElement('canvas')
  canvas.width = frameSize * frames.length
  canvas.height = frameSize
  const ctx = canvas.getContext('2d')

  await Promise.all(
    frames.map((src, i) =>
      new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, i * frameSize, 0, frameSize, frameSize)
          resolve()
        }
        img.src = src
      })
    )
  )

  return canvas
}

// PNG sprite strip (transparent)
export async function exportPNG(frames, frameSize, name) {
  const canvas = await buildSpriteSheet(frames, frameSize)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.png`), 'image/png')
}

// JPG sprite strip (white bg)
export async function exportJPG(frames, frameSize, name) {
  const src = await buildSpriteSheet(frames, frameSize)
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(src, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.jpg`), 'image/jpeg', 0.92)
}

// WebP sprite strip
export async function exportWebP(frames, frameSize, name) {
  const canvas = await buildSpriteSheet(frames, frameSize)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.webp`), 'image/webp', 0.92)
}

// GIF using gif.js worker
export async function exportGIF(frames, frameSize, name, onProgress) {
  return new Promise((resolve, reject) => {
    // Dynamically import gif.js
    const GIF = window.GIF
    if (!GIF) {
      // Fallback: export frames as ZIP if gif.js not available
      exportFramesZIP(frames, name).then(resolve).catch(reject)
      return
    }

    const gif = new GIF({
      workers: 2,
      quality: 8,
      width: frameSize,
      height: frameSize,
      workerScript: '/gif.worker.js',
      transparent: 0x00000000,
    })

    let loaded = 0
    frames.forEach(src => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = frameSize
        canvas.height = frameSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        gif.addFrame(canvas, { delay: Math.round(1000 / 24), copy: true })
        loaded++
        if (loaded === frames.length) gif.render()
      }
      img.src = src
    })

    gif.on('progress', p => { if (onProgress) onProgress(Math.round(p * 100)) })
    gif.on('finished', blob => {
      saveAs(blob, `${name}.gif`)
      resolve()
    })
    gif.on('error', reject)
  })
}

// MP4 via MediaRecorder (canvas stream)
export async function exportMP4(frames, frameSize, name, fps = 24, onProgress) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = frameSize
    canvas.height = frameSize
    const ctx = canvas.getContext('2d')

    const stream = canvas.captureStream(fps)
    const mime = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1"')
      ? 'video/mp4; codecs="avc1"'
      : MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    const chunks = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunks, { type: mime })
      saveAs(blob, `${name}.${ext}`)
      resolve()
    }

    recorder.start()

    let i = 0
    const drawFrame = () => {
      if (i >= frames.length) {
        recorder.stop()
        return
      }
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, frameSize, frameSize)
        ctx.drawImage(img, 0, 0)
        if (onProgress) onProgress(Math.round((i / frames.length) * 100))
        i++
        setTimeout(drawFrame, 1000 / fps)
      }
      img.src = frames[i]
    }

    drawFrame()
  })
}

// ZIP of all frames as individual PNGs
export async function exportFramesZIP(frames, name) {
  const zip = new JSZip()
  const folder = zip.folder(`${name}_frames`)

  frames.forEach((src, i) => {
    const b64 = src.split(',')[1]
    folder.file(`frame_${String(i).padStart(3, '0')}.png`, b64, { base64: true })
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `${name}_frames.zip`)
}

// GLB export
export async function exportGLB(glbBuffer, name) {
  const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' })
  saveAs(blob, `${name}.glb`)
}

// Export all formats as a ZIP bundle
export async function exportAll(frames, frameSize, name, glbBuffer, onProgress) {
  const zip = new JSZip()

  onProgress('Building sprite strip...')

  // PNG strip
  const sheet = await buildSpriteSheet(frames, frameSize)
  const pngBlob = await new Promise(r => sheet.toBlob(r, 'image/png'))
  zip.file(`${name}_strip.png`, pngBlob)

  // WebP strip
  const webpBlob = await new Promise(r => sheet.toBlob(r, 'image/webp', 0.92))
  zip.file(`${name}_strip.webp`, webpBlob)

  // JPG strip
  const jpgCanvas = document.createElement('canvas')
  jpgCanvas.width = sheet.width; jpgCanvas.height = sheet.height
  const jpgCtx = jpgCanvas.getContext('2d')
  jpgCtx.fillStyle = '#ffffff'; jpgCtx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height)
  jpgCtx.drawImage(sheet, 0, 0)
  const jpgBlob = await new Promise(r => jpgCanvas.toBlob(r, 'image/jpeg', 0.92))
  zip.file(`${name}_strip.jpg`, jpgBlob)

  // Individual frames
  const framesFolder = zip.folder('frames')
  frames.forEach((src, i) => {
    const b64 = src.split(',')[1]
    framesFolder.file(`frame_${String(i).padStart(3, '0')}.png`, b64, { base64: true })
  })

  // GLB
  if (glbBuffer) {
    zip.file(`${name}.glb`, glbBuffer)
  }

  onProgress('Compressing...')
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  saveAs(blob, `${name}_kiln_export.zip`)
  onProgress(null)
}
