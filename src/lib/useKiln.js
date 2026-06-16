import { useState, useEffect, useRef, useCallback } from 'react'
import JSZip from 'jszip'
import { ENVIRONMENTS, MATERIALS, MOTIONS } from './constants.js'
import { KilnRenderer } from './renderer.js'
import {
  exportFramePNG, exportFrameJPG, exportFrameWebP,
  exportStripPNG, exportStripJPG, exportStripWebP,
  exportGIF, exportMP4, exportFramesZIP, exportGLB, exportAll,
  buildSpriteSheet,
} from './export.js'
import { fetchLibrary, saveGeneration, deleteGeneration, loadFramesFromStorage } from './supabase.js'

const DEFAULT_ENV = ENVIRONMENTS.Natural[0]

export function useKiln(canvasRef, containerRef, userHash) {
  const rendererRef = useRef(null)

  const [svgString, setSvgString] = useState(null)
  const [svgName, setSvgName] = useState('')
  const [svgLoaded, setSvgLoaded] = useState(false)

  const [material, setMaterial] = useState('Chrome')
  const [motion, setMotion] = useState('Turntable')
  const [depth, setDepth] = useState(0.3)
  const [bevel, setBevel] = useState(0.02)
  const [frameCount, setFrameCount] = useState(36)
  const [frameSize, setFrameSize] = useState(256)
  const [environment, setEnvironment] = useState(DEFAULT_ENV)

  // frames: array of dataURL strings for current generation
  const [frames, setFrames] = useState([])
  const [scrubIndex, setScrubIndex] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const [baking, setBaking] = useState(false)
  const [bakeProgress, setBakeProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState(null)
  const [status, setStatus] = useState('Upload an SVG to begin')
  const [syncing, setSyncing] = useState(false)

  // Library comes from Supabase, metadata only (no frame data)
  const [library, setLibrary] = useState([])
  const [activeId, setActiveId] = useState(null)

  // Fetch library on mount / userHash change
  useEffect(() => {
    if (!userHash) return
    setSyncing(true)
    fetchLibrary(userHash)
      .then(data => setLibrary(data || []))
      .catch(e => setStatus(`Sync error: ${e.message}`))
      .finally(() => setSyncing(false))
  }, [userHash])

  // Init renderer
  useEffect(() => {
    if (!canvasRef.current) return
    const r = new KilnRenderer(canvasRef.current)
    rendererRef.current = r
    r.setEnvironment(DEFAULT_ENV)
    r.start()
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        if (width > 0 && height > 0) r.resize(width, height)
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => { ro.disconnect(); r.dispose() }
  }, [])

  useEffect(() => { rendererRef.current?.setEnvironment(environment) }, [environment])
  useEffect(() => { if (svgLoaded) rendererRef.current?.setMaterial(MATERIALS[material]) }, [material, svgLoaded])
  useEffect(() => { rendererRef.current?.setMotion(motion) }, [motion])

  const loadSVG = useCallback((str, name) => {
    setSvgString(str); setSvgName(name); setFrames([]); setScrubIndex(0); setIsScrubbing(false)
    if (rendererRef.current) {
      const ok = rendererRef.current.loadSVG(str, depth, bevel)
      if (ok) {
        rendererRef.current.setMaterial(MATERIALS[material])
        rendererRef.current.setMotion(motion)
        setSvgLoaded(true); setStatus(`Loaded: ${name}`)
      } else { setSvgLoaded(false); setStatus('Failed to parse SVG') }
    }
  }, [depth, bevel, material, motion])

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.svg')) { setStatus('Only .svg files supported'); return }
    const reader = new FileReader()
    reader.onload = e => loadSVG(e.target.result, file.name.replace('.svg', ''))
    reader.readAsText(file)
  }, [loadSVG])

  const applyGeometry = useCallback(() => {
    if (svgString && rendererRef.current) {
      rendererRef.current.loadSVG(svgString, depth, bevel)
      rendererRef.current.setMaterial(MATERIALS[material])
    }
  }, [svgString, depth, bevel, material])

  // Scrubber: stop live animation, seek renderer to this frame's position
  const scrub = useCallback((index) => {
    if (!frames.length) return
    const r = rendererRef.current
    if (!r) return
    if (!isScrubbing) {
      r.stop()
      setIsScrubbing(true)
    }
    setScrubIndex(index)
    const norm = index / Math.max(frames.length - 1, 1)
    r.seekAndRender(norm)
  }, [frames.length, isScrubbing])

  const resumePlayback = useCallback(() => {
    rendererRef.current?.start()
    setIsScrubbing(false)
    setScrubIndex(0)
  }, [])

  const bake = useCallback(async () => {
    if (!rendererRef.current || !svgLoaded) return
    setBaking(true); setBakeProgress(0); setStatus('Baking...')
    setIsScrubbing(false)

    const f = await rendererRef.current.bakeFrames(frameCount, frameSize, p => {
      setBakeProgress(p); setStatus(`Baking ${p}%`)
    })
    setFrames(f); setScrubIndex(0)

    const thumb = rendererRef.current.captureFrame(128)
    const id = Date.now()

    const entry = {
      id, name: svgName || 'untitled', thumb,
      frames: f, material, motion,
      environment: environment.id,
      depth, bevel, frameCount, frameSize, svgString,
    }

    // Build ZIP of frames for Supabase storage
    if (userHash) {
      setStatus('Uploading to library...')
      try {
        const zip = new JSZip()
        const folder = zip.folder('frames')
        f.forEach((src, i) => {
          folder.file(`frame_${String(i).padStart(3, '0')}.png`, src.split(',')[1], { base64: true })
        })
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } })
        await saveGeneration(userHash, entry, zipBlob)
        // Refresh library from Supabase
        const updated = await fetchLibrary(userHash)
        setLibrary(updated || [])
      } catch (e) {
        setStatus(`Saved locally (sync failed: ${e.message})`)
      }
    }

    setActiveId(id)
    setBaking(false)
    setStatus(`${frameCount} frames · ${frameSize}px`)
  }, [svgLoaded, frameCount, frameSize, svgName, material, motion, environment, depth, bevel, svgString, userHash])

  const loadLibraryItem = useCallback(async (item) => {
    setActiveId(item.id)
    setMaterial(item.material); setMotion(item.motion)
    setDepth(item.depth); setBevel(item.bevel)
    setFrameCount(item.frame_count || item.frameCount)
    setFrameSize(item.frame_size || item.frameSize)
    setScrubIndex(0); setIsScrubbing(false)

    // Resolve environment
    let env = DEFAULT_ENV
    const envId = item.environment_id || item.environment
    Object.values(ENVIRONMENTS).flat().forEach(e => { if (e.id === envId) env = e })
    setEnvironment(env)

    // Load frames from Supabase storage ZIP
    const fCount = item.frame_count || item.frameCount
    const fSize = item.frame_size || item.frameSize
    const svgStr = item.svg_string || item.svgString
    const name = item.name

    if (item.zip_path && userHash) {
      setStatus('Loading frames...')
      try {
        const loadedFrames = await loadFramesFromStorage(item.zip_path, fCount)
        setFrames(loadedFrames)
      } catch (e) {
        setStatus(`Failed to load frames: ${e.message}`)
      }
    }

    if (svgStr && rendererRef.current) {
      setSvgString(svgStr); setSvgName(name)
      rendererRef.current.loadSVG(svgStr, item.depth, item.bevel)
      rendererRef.current.setMaterial(MATERIALS[item.material])
      rendererRef.current.setMotion(item.motion)
      rendererRef.current.setEnvironment(env)
      setSvgLoaded(true)
    }
    setStatus(`Loaded: ${name}`)
  }, [userHash])

  const deleteLibraryItem = useCallback(async (id, e) => {
    e.stopPropagation()
    const item = library.find(i => i.id === id)
    if (!item) return
    try {
      if (userHash && item.zip_path) {
        await deleteGeneration(userHash, id, item.zip_path)
      }
      setLibrary(prev => prev.filter(i => i.id !== id))
      if (activeId === id) { setActiveId(null); setFrames([]) }
    } catch (e) {
      setStatus(`Delete failed: ${e.message}`)
    }
  }, [library, activeId, userHash])

  const clearLibrary = useCallback(async () => {
    if (!userHash) return
    try {
      await Promise.all(library.map(item =>
        item.zip_path ? deleteGeneration(userHash, item.id, item.zip_path) : Promise.resolve()
      ))
      setLibrary([]); setActiveId(null); setFrames([])
    } catch (e) {
      setStatus(`Clear failed: ${e.message}`)
    }
  }, [library, userHash])

  const getGLB = async () => {
    if (!rendererRef.current || !svgLoaded) return null
    try { return await rendererRef.current.exportGLB() } catch { return null }
  }

  const doExport = useCallback(async (type) => {
    const name = svgName || 'kiln'
    if (!frames.length && type !== 'glb') { setStatus('Bake first'); return }
    setExporting(true)
    try {
      const fi = Math.min(scrubIndex, frames.length - 1)
      switch (type) {
        case 'png':       await exportFramePNG(frames[fi], name, fi); break
        case 'jpg':       await exportFrameJPG(frames[fi], name, fi); break
        case 'webp':      await exportFrameWebP(frames[fi], name, fi); break
        case 'strip_png': await exportStripPNG(frames, frameSize, name); break
        case 'strip_jpg': await exportStripJPG(frames, frameSize, name); break
        case 'strip_webp':await exportStripWebP(frames, frameSize, name); break
        case 'gif':
          setExportStatus('Encoding GIF...')
          await exportGIF(frames, frameSize, name, p => setExportStatus(`GIF ${p}%`))
          break
        case 'mp4':
          setExportStatus('Encoding video...')
          await exportMP4(frames, frameSize, name, 24, p => setExportStatus(`Video ${p}%`))
          break
        case 'frames': await exportFramesZIP(frames, name); break
        case 'glb': {
          const buf = await getGLB()
          if (buf) await exportGLB(buf, name); else setStatus('No mesh')
          break
        }
        case 'all': {
          const buf = await getGLB()
          await exportAll(frames, frameSize, name, buf, msg => setExportStatus(msg))
          break
        }
      }
      setStatus(`Exported: ${type.toUpperCase().replace('_', ' ')}`)
    } catch (err) { setStatus(`Export failed: ${err.message}`) }
    setExporting(false); setExportStatus(null)
  }, [frames, scrubIndex, frameSize, svgName, svgLoaded])

  return {
    svgLoaded, svgName, material, motion, depth, bevel,
    frameCount, frameSize, environment, frames, scrubIndex, isScrubbing,
    baking, bakeProgress, exporting, exportStatus, status, syncing,
    library, activeId,
    setMaterial, setMotion, setDepth, setBevel,
    setFrameCount, setFrameSize, setEnvironment,
    handleFile, applyGeometry, bake, scrub, resumePlayback,
    loadLibraryItem, deleteLibraryItem, clearLibrary, doExport,
  }
}
