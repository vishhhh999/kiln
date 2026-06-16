import { useState, useEffect, useRef, useCallback } from 'react'
import { ENVIRONMENTS, MATERIALS, MOTIONS } from './constants.js'
import { KilnRenderer } from './renderer.js'
import { exportFramePNG, exportFrameJPG, exportFrameWebP, exportStripPNG, exportStripJPG, exportStripWebP, exportGIF, exportMP4, exportFramesZIP, exportGLB, exportAll } from './export.js'

const DEFAULT_ENV = ENVIRONMENTS.Natural[0]

export function useKiln(canvasRef, containerRef) {
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

  const [frames, setFrames] = useState([])
  const [scrubIndex, setScrubIndex] = useState(0)
  const [baking, setBaking] = useState(false)
  const [bakeProgress, setBakeProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState(null)
  const [status, setStatus] = useState('Upload an SVG to begin')

  const [library, setLibrary] = useState(() => {
    try { const s = localStorage.getItem('kiln_library'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    try { localStorage.setItem('kiln_library', JSON.stringify(library)) } catch {
      if (library.length > 1) setLibrary(prev => prev.slice(0, prev.length - 1))
    }
  }, [library])

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
    setSvgString(str); setSvgName(name); setFrames([]); setScrubIndex(0)
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

  // Scrubber -- seek renderer to specific normalised time
  const scrub = useCallback((index) => {
    if (!frames.length) return
    setScrubIndex(index)
    // Pause live animation and seek
    const r = rendererRef.current
    if (!r) return
    r.stop()
    // Draw the specific baked frame on a temp canvas, then let the main canvas show it
    // Actually seek the live renderer to same position
    const norm = index / Math.max(frames.length - 1, 1)
    r.seekAndRender(norm)
  }, [frames.length])

  const resumePlayback = useCallback(() => {
    rendererRef.current?.start()
    setScrubIndex(0)
  }, [])

  const bake = useCallback(async () => {
    if (!rendererRef.current || !svgLoaded) return
    setBaking(true); setBakeProgress(0); setStatus('Baking...')
    const f = await rendererRef.current.bakeFrames(frameCount, frameSize, p => { setBakeProgress(p); setStatus(`Baking ${p}%`) })
    setFrames(f); setScrubIndex(0)
    const thumb = rendererRef.current.captureFrame(128)
    const entry = { id: Date.now(), name: svgName || 'untitled', thumb, frames: f, material, motion, environment: environment.id, depth, bevel, frameCount, frameSize, svgString }
    setLibrary(prev => [entry, ...prev.slice(0, 49)])
    setActiveId(entry.id)
    setBaking(false); setStatus(`${frameCount} frames · ${frameSize}px`)
  }, [svgLoaded, frameCount, frameSize, svgName, material, motion, environment, depth, bevel, svgString])

  const loadLibraryItem = useCallback((item) => {
    setActiveId(item.id); setFrames(item.frames); setScrubIndex(0)
    setMaterial(item.material); setMotion(item.motion)
    setDepth(item.depth); setBevel(item.bevel)
    setFrameCount(item.frameCount); setFrameSize(item.frameSize)
    let env = DEFAULT_ENV
    Object.values(ENVIRONMENTS).flat().forEach(e => { if (e.id === item.environment) env = e })
    setEnvironment(env)
    if (item.svgString && rendererRef.current) {
      setSvgString(item.svgString); setSvgName(item.name)
      rendererRef.current.loadSVG(item.svgString, item.depth, item.bevel)
      rendererRef.current.setMaterial(MATERIALS[item.material])
      rendererRef.current.setMotion(item.motion)
      rendererRef.current.setEnvironment(env)
      setSvgLoaded(true)
    }
    setStatus(`Loaded: ${item.name}`)
  }, [])

  const deleteLibraryItem = useCallback((id, e) => {
    e.stopPropagation()
    setLibrary(prev => prev.filter(i => i.id !== id))
    if (activeId === id) setActiveId(null)
  }, [activeId])

  const clearLibrary = useCallback(() => {
    setLibrary([]); setActiveId(null); localStorage.removeItem('kiln_library')
  }, [])

  const getGLB = async () => {
    if (!rendererRef.current || !svgLoaded) return null
    try { return await rendererRef.current.exportGLB() } catch { return null }
  }

  const doExport = useCallback(async (type) => {
    const name = svgName || 'kiln'
    if (!frames.length && !['glb'].includes(type)) { setStatus('Bake first'); return }
    setExporting(true)
    try {
      switch (type) {
        // Single frame exports (use scrubbed frame)
        case 'png':  await exportFramePNG(frames[scrubIndex] || frames[0], name, scrubIndex); break
        case 'jpg':  await exportFrameJPG(frames[scrubIndex] || frames[0], name, scrubIndex); break
        case 'webp': await exportFrameWebP(frames[scrubIndex] || frames[0], name, scrubIndex); break
        // Strip exports
        case 'strip_png':  await exportStripPNG(frames, frameSize, name); break
        case 'strip_jpg':  await exportStripJPG(frames, frameSize, name); break
        case 'strip_webp': await exportStripWebP(frames, frameSize, name); break
        // Video / animated
        case 'gif':
          setExportStatus('Encoding GIF...')
          await exportGIF(frames, frameSize, name, p => setExportStatus(`GIF ${p}%`))
          break
        case 'mp4':
          setExportStatus('Encoding video...')
          await exportMP4(frames, frameSize, name, 24, p => setExportStatus(`Video ${p}%`))
          break
        // 3D / bulk
        case 'frames': await exportFramesZIP(frames, name); break
        case 'glb': { const buf = await getGLB(); if (buf) await exportGLB(buf, name); else setStatus('No mesh'); break }
        case 'all': { const buf = await getGLB(); await exportAll(frames, frameSize, name, buf, msg => setExportStatus(msg)); break }
      }
      setStatus(`Exported: ${type.toUpperCase()}`)
    } catch (err) { setStatus(`Export failed: ${err.message}`) }
    setExporting(false); setExportStatus(null)
  }, [frames, scrubIndex, frameSize, svgName, svgLoaded])

  return {
    svgLoaded, svgName, material, motion, depth, bevel,
    frameCount, frameSize, environment, frames, scrubIndex,
    baking, bakeProgress, exporting, exportStatus, status,
    library, activeId,
    setMaterial, setMotion, setDepth, setBevel,
    setFrameCount, setFrameSize, setEnvironment,
    handleFile, applyGeometry, bake, scrub, resumePlayback,
    loadLibraryItem, deleteLibraryItem, clearLibrary, doExport,
  }
}
