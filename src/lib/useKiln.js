import { useState, useEffect, useRef, useCallback } from 'react'
import { ENVIRONMENTS, MATERIALS, MOTIONS } from './constants.js'
import { KilnRenderer } from './renderer.js'
import { exportPNG, exportJPG, exportWebP, exportGIF, exportMP4, exportFramesZIP, exportGLB, exportAll } from './export.js'

const DEFAULT_ENV = ENVIRONMENTS.Natural[0]

export function useKiln(canvasRef, containerRef) {
  const rendererRef = useRef(null)

  // SVG state
  const [svgString, setSvgString] = useState(null)
  const [svgName, setSvgName] = useState('')
  const [svgLoaded, setSvgLoaded] = useState(false)

  // Settings
  const [material, setMaterial] = useState('Chrome')
  const [motion, setMotion] = useState('Turntable')
  const [depth, setDepth] = useState(0.3)
  const [bevel, setBevel] = useState(0.02)
  const [frameCount, setFrameCount] = useState(36)
  const [frameSize, setFrameSize] = useState(256)
  const [environment, setEnvironment] = useState(DEFAULT_ENV)

  // Output
  const [frames, setFrames] = useState([])
  const [baking, setBaking] = useState(false)
  const [bakeProgress, setBakeProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState(null)
  const [status, setStatus] = useState('Upload an SVG to begin')

  // Library (persisted in localStorage)
  const [library, setLibrary] = useState(() => {
    try {
      const stored = localStorage.getItem('kiln_library')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [activeId, setActiveId] = useState(null)

  // Persist library
  useEffect(() => {
    try {
      localStorage.setItem('kiln_library', JSON.stringify(library))
    } catch (e) {
      // Storage full - trim oldest
      if (library.length > 1) {
        const trimmed = library.slice(0, library.length - 1)
        setLibrary(trimmed)
      }
    }
  }, [library])

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

    return () => {
      ro.disconnect()
      r.dispose()
    }
  }, [])

  // Env
  useEffect(() => {
    rendererRef.current?.setEnvironment(environment)
  }, [environment])

  // Material
  useEffect(() => {
    if (svgLoaded) rendererRef.current?.setMaterial(MATERIALS[material])
  }, [material, svgLoaded])

  // Motion
  useEffect(() => {
    rendererRef.current?.setMotion(motion)
  }, [motion])

  const loadSVG = useCallback((str, name) => {
    setSvgString(str)
    setSvgName(name)
    setFrames([])
    if (rendererRef.current) {
      const ok = rendererRef.current.loadSVG(str, depth, bevel)
      if (ok) {
        rendererRef.current.setMaterial(MATERIALS[material])
        rendererRef.current.setMotion(motion)
        setSvgLoaded(true)
        setStatus(`Loaded: ${name}`)
      } else {
        setSvgLoaded(false)
        setStatus('Failed to parse SVG -- check the file')
      }
    }
  }, [depth, bevel, material, motion])

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.svg')) {
      setStatus('Only .svg files are supported')
      return
    }
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

  const bake = useCallback(async () => {
    if (!rendererRef.current || !svgLoaded) return
    setBaking(true)
    setBakeProgress(0)
    setStatus('Baking...')

    const f = await rendererRef.current.bakeFrames(frameCount, frameSize, p => {
      setBakeProgress(p)
      setStatus(`Baking ${p}%`)
    })

    setFrames(f)

    // Thumbnail for library
    const thumb = rendererRef.current.captureFrame(128)

    const entry = {
      id: Date.now(),
      name: svgName || 'untitled',
      thumb,
      frames: f,
      material,
      motion,
      environment: environment.id,
      depth,
      bevel,
      frameCount,
      frameSize,
      svgString,
    }

    setLibrary(prev => [entry, ...prev.slice(0, 49)]) // cap at 50
    setActiveId(entry.id)
    setBaking(false)
    setStatus(`${frameCount} frames · ${frameSize}px`)
  }, [svgLoaded, frameCount, frameSize, svgName, material, motion, environment, depth, bevel, svgString])

  const loadLibraryItem = useCallback((item) => {
    setActiveId(item.id)
    setFrames(item.frames)
    setMaterial(item.material)
    setMotion(item.motion)
    setDepth(item.depth)
    setBevel(item.bevel)
    setFrameCount(item.frameCount)
    setFrameSize(item.frameSize)

    // Find environment
    let env = DEFAULT_ENV
    Object.values(ENVIRONMENTS).flat().forEach(e => { if (e.id === item.environment) env = e })
    setEnvironment(env)

    if (item.svgString && rendererRef.current) {
      setSvgString(item.svgString)
      setSvgName(item.name)
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
    setLibrary(prev => prev.filter(item => item.id !== id))
    if (activeId === id) setActiveId(null)
  }, [activeId])

  const clearLibrary = useCallback(() => {
    setLibrary([])
    setActiveId(null)
    localStorage.removeItem('kiln_library')
  }, [])

  // Export helpers
  const getGLB = async () => {
    if (!rendererRef.current || !svgLoaded) return null
    try { return await rendererRef.current.exportGLB() } catch { return null }
  }

  const doExport = useCallback(async (type) => {
    if (!frames.length && type !== 'glb') { setStatus('Bake first'); return }
    setExporting(true)
    const name = svgName || 'kiln_export'
    try {
      switch (type) {
        case 'png':  await exportPNG(frames, frameSize, name); break
        case 'jpg':  await exportJPG(frames, frameSize, name); break
        case 'webp': await exportWebP(frames, frameSize, name); break
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
          if (buf) await exportGLB(buf, name)
          else setStatus('No mesh to export')
          break
        }
        case 'all': {
          const buf = await getGLB()
          await exportAll(frames, frameSize, name, buf, msg => setExportStatus(msg))
          break
        }
      }
      setStatus(`Exported: ${type.toUpperCase()}`)
    } catch (err) {
      setStatus(`Export failed: ${err.message}`)
    }
    setExporting(false)
    setExportStatus(null)
  }, [frames, frameSize, svgName, svgLoaded])

  return {
    // State
    svgLoaded, svgName, material, motion, depth, bevel,
    frameCount, frameSize, environment, frames,
    baking, bakeProgress, exporting, exportStatus, status,
    library, activeId,
    // Setters
    setMaterial, setMotion, setDepth, setBevel,
    setFrameCount, setFrameSize, setEnvironment,
    // Actions
    handleFile, applyGeometry, bake,
    loadLibraryItem, deleteLibraryItem, clearLibrary,
    doExport,
  }
}
