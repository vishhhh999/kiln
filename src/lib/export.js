import { saveAs } from 'file-saver'
import JSZip from 'jszip'

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

// Single frame PNG (the scrubbed frame)
export async function exportFramePNG(frameDataURL, name, frameIndex) {
  const link = document.createElement('a')
  link.download = `${name}_f${String(frameIndex).padStart(3, '0')}.png`
  link.href = frameDataURL
  link.click()
}

// Single frame JPG
export async function exportFrameJPG(frameDataURL, name, frameIndex) {
  const img = new Image()
  img.src = frameDataURL
  await new Promise(r => { img.onload = r })
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_f${String(frameIndex).padStart(3, '0')}.jpg`), 'image/jpeg', 0.95)
}

// Single frame WebP
export async function exportFrameWebP(frameDataURL, name, frameIndex) {
  const link = document.createElement('a')
  // Convert to webp via canvas
  const img = new Image()
  img.src = frameDataURL
  await new Promise(r => { img.onload = r })
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_f${String(frameIndex).padStart(3, '0')}.webp`), 'image/webp', 0.95)
}

// Sprite strip exports (all formats)
export async function exportStripPNG(frames, frameSize, name) {
  const canvas = await buildSpriteSheet(frames, frameSize)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.png`), 'image/png')
}

export async function exportStripJPG(frames, frameSize, name) {
  const src = await buildSpriteSheet(frames, frameSize)
  const canvas = document.createElement('canvas')
  canvas.width = src.width; canvas.height = src.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(src, 0, 0)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.jpg`), 'image/jpeg', 0.95)
}

export async function exportStripWebP(frames, frameSize, name) {
  const canvas = await buildSpriteSheet(frames, frameSize)
  canvas.toBlob(blob => saveAs(blob, `${name}_strip.webp`), 'image/webp', 0.95)
}

// GIF
export async function exportGIF(frames, frameSize, name, onProgress) {
  return new Promise((resolve, reject) => {
    const GIF = window.GIF
    if (!GIF) { exportFramesZIP(frames, name).then(resolve).catch(reject); return }
    const gif = new GIF({ workers: 2, quality: 6, width: frameSize, height: frameSize, workerScript: '/gif.worker.js' })
    let loaded = 0
    frames.forEach(src => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = frameSize; c.height = frameSize
        c.getContext('2d').drawImage(img, 0, 0)
        gif.addFrame(c, { delay: Math.round(1000 / 24), copy: true })
        if (++loaded === frames.length) gif.render()
      }
      img.src = src
    })
    gif.on('progress', p => { if (onProgress) onProgress(Math.round(p * 100)) })
    gif.on('finished', blob => { saveAs(blob, `${name}.gif`); resolve() })
    gif.on('error', reject)
  })
}

// MP4 -- high quality, 2x canvas then downscale
export async function exportMP4(frames, frameSize, name, fps = 24, onProgress) {
  return new Promise((resolve, reject) => {
    const SCALE = 2
    const canvas = document.createElement('canvas')
    canvas.width = frameSize * SCALE
    canvas.height = frameSize * SCALE
    const ctx = canvas.getContext('2d')

    const outCanvas = document.createElement('canvas')
    outCanvas.width = frameSize; outCanvas.height = frameSize
    const outCtx = outCanvas.getContext('2d')

    const stream = outCanvas.captureStream(fps)
    const mime = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E"')
      ? 'video/mp4; codecs="avc1.42E01E"'
      : MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm'

    // Push bitrate up significantly
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 40_000_000, // 40Mbps
    })
    const chunks = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
      saveAs(new Blob(chunks, { type: mime }), `${name}.${ext}`)
      resolve()
    }

    recorder.start()
    let i = 0
    const drawFrame = () => {
      if (i >= frames.length) { recorder.stop(); return }
      const img = new Image()
      img.onload = () => {
        // Draw at 2x
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // Downscale to output
        outCtx.clearRect(0, 0, frameSize, frameSize)
        outCtx.drawImage(canvas, 0, 0, frameSize, frameSize)
        if (onProgress) onProgress(Math.round((i / frames.length) * 100))
        i++
        setTimeout(drawFrame, 1000 / fps)
      }
      img.src = frames[i]
    }
    drawFrame()
  })
}

export async function exportFramesZIP(frames, name) {
  const zip = new JSZip()
  const folder = zip.folder(`${name}_frames`)
  frames.forEach((src, i) => {
    folder.file(`frame_${String(i).padStart(3, '0')}.png`, src.split(',')[1], { base64: true })
  })
  saveAs(await zip.generateAsync({ type: 'blob' }), `${name}_frames.zip`)
}

export async function exportGLB(glbBuffer, name) {
  saveAs(new Blob([glbBuffer], { type: 'model/gltf-binary' }), `${name}.glb`)
}

export async function exportAll(frames, frameSize, name, glbBuffer, onProgress) {
  const zip = new JSZip()
  onProgress('Building strips...')
  const sheet = await buildSpriteSheet(frames, frameSize)
  zip.file(`${name}_strip.png`, await new Promise(r => sheet.toBlob(r, 'image/png')))
  zip.file(`${name}_strip.webp`, await new Promise(r => sheet.toBlob(r, 'image/webp', 0.95)))
  const jpgC = document.createElement('canvas'); jpgC.width = sheet.width; jpgC.height = sheet.height
  const jpgCtx = jpgC.getContext('2d'); jpgCtx.fillStyle = '#fff'; jpgCtx.fillRect(0, 0, jpgC.width, jpgC.height); jpgCtx.drawImage(sheet, 0, 0)
  zip.file(`${name}_strip.jpg`, await new Promise(r => jpgC.toBlob(r, 'image/jpeg', 0.95)))
  const folder = zip.folder('frames')
  frames.forEach((src, i) => folder.file(`frame_${String(i).padStart(3, '0')}.png`, src.split(',')[1], { base64: true }))
  if (glbBuffer) zip.file(`${name}.glb`, glbBuffer)
  onProgress('Compressing...')
  saveAs(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }), `${name}_kiln.zip`)
  onProgress(null)
}
