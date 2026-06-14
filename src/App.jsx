import { useState, useRef, useCallback } from 'react'
import { ENVIRONMENTS, MATERIALS, MOTIONS } from './lib/constants.js'
import { useKiln } from './lib/useKiln.js'

const T = {
  dark: {
    bg: '#0a0a0a', bg1: '#0d0d0d', bg2: '#111111', surface: '#161616',
    border: '#1e1e1e', border2: '#252525', text: '#f0f0f0',
    textMid: '#888888', textDim: '#444444', textFaint: '#2a2a2a',
    accent: '#c8b99a', accentBg: '#1e1c18', accentBorder: '#3a3020',
  },
  light: {
    bg: '#f2f1ef', bg1: '#ffffff', bg2: '#fafafa', surface: '#efefed',
    border: '#e2e2e0', border2: '#d5d5d3', text: '#0f0f0f',
    textMid: '#666666', textDim: '#aaaaaa', textFaint: '#cccccc',
    accent: '#8a7a6a', accentBg: '#f0ece6', accentBorder: '#d0c8bc',
  },
}

function Label({ children, t, style = {} }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textDim, fontFamily: "'Space Grotesk', sans-serif", ...style }}>
      {children}
    </span>
  )
}

function Chip({ active, onClick, children, t }) {
  return (
    <button onClick={onClick} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 3, border: `1px solid ${active ? t.accentBorder : t.border2}`, background: active ? t.accentBg : 'transparent', color: active ? t.accent : t.textDim, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', transition: 'all 0.1s' }}>
      {children}
    </button>
  )
}

function SliderRow({ label, value, min, max, step, onChange, onCommit, display, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label t={t}>{label}</Label>
        <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: t.textMid }}>{display || value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} onMouseUp={onCommit} onTouchEnd={onCommit} style={{ width: '100%', accentColor: t.accent, height: 2, cursor: 'pointer' }} />
    </div>
  )
}

function Section({ label, children, t, last = false }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: last ? 'none' : `1px solid ${t.border}` }}>
      <Label t={t} style={{ display: 'block', marginBottom: 10 }}>{label}</Label>
      {children}
    </div>
  )
}

function EnvChip({ env, active, onClick }) {
  return (
    <button onClick={onClick} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 3, border: `1px solid ${active ? env.key : '#1e1e1e'}`, background: active ? env.bg : 'transparent', color: active ? env.key : '#555', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', transition: 'all 0.15s', boxShadow: active ? `0 0 10px ${env.key}55` : 'none' }}>
      {env.label}
    </button>
  )
}

function ExportBtn({ label, onClick, t, accent = false }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: 42, padding: '5px 4px', background: accent ? t.accent : 'transparent', border: `1px solid ${accent ? t.accent : t.border2}`, borderRadius: 3, color: accent ? '#0a0a0a' : t.textDim, fontSize: 9, fontWeight: accent ? 700 : 400, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.07em', textAlign: 'center', textTransform: 'uppercase', transition: 'all 0.1s' }}>
      {label}
    </button>
  )
}

function DropZone({ onFile, t }) {
  const [hovering, setHovering] = useState(false)
  const inputRef = useRef(null)
  const handleDrop = useCallback(e => { e.preventDefault(); setHovering(false); const file = e.dataTransfer.files[0]; if (file) onFile(file) }, [onFile])
  return (
    <div onClick={() => inputRef.current?.click()} onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setHovering(true) }} onDragLeave={() => setHovering(false)} style={{ margin: '10px', border: `1px dashed ${hovering ? t.accent : t.border2}`, borderRadius: 6, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', color: hovering ? t.accent : t.textFaint, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.15s', background: hovering ? t.accentBg : 'transparent' }}>
      <input ref={inputRef} type="file" accept=".svg" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
      Drop SVG
    </div>
  )
}

function LibItem({ item, active, onLoad, onDelete, t }) {
  return (
    <div onClick={onLoad} style={{ position: 'relative', background: active ? t.accentBg : t.surface, border: `1px solid ${active ? t.accentBorder : t.border}`, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.1s' }}>
      <img src={item.thumb} alt={item.name} style={{ width: '100%', aspectRatio: '1', display: 'block', background: '#0a0a0a' }} />
      <div style={{ padding: '5px 6px', borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: active ? t.accent : t.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
        <div style={{ fontSize: 8, color: t.textFaint, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{item.frameCount}f · {item.material}</div>
      </div>
      <button onClick={onDelete} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 3, color: '#888', cursor: 'pointer', fontSize: 12, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(true)
  const t = T[dark ? 'dark' : 'light']
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const { svgLoaded, svgName, material, motion, depth, bevel, frameCount, frameSize, environment, frames, baking, bakeProgress, exporting, exportStatus, status, library, activeId, setMaterial, setMotion, setDepth, setBevel, setFrameCount, setFrameSize, setEnvironment, handleFile, applyGeometry, bake, loadLibraryItem, deleteLibraryItem, clearLibrary, doExport } = useKiln(canvasRef, containerRef)

  const handleGlobalDrop = useCallback(e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file?.name.endsWith('.svg')) handleFile(file) }, [handleFile])

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: t.bg, color: t.text, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onDrop={handleGlobalDrop} onDragOver={e => e.preventDefault()}>

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 46, flexShrink: 0, background: t.bg1, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.accent }}>KILN</span>
          <span style={{ fontSize: 9, letterSpacing: '0.08em', color: t.textFaint, textTransform: 'uppercase' }}>SVG to 3D</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.06em', color: t.textDim, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {exporting ? (exportStatus || 'Exporting...') : status}
          </span>
          <button onClick={() => setDark(!dark)} style={{ background: 'none', border: `1px solid ${t.border2}`, borderRadius: 3, color: t.textDim, cursor: 'pointer', padding: '3px 10px', fontSize: 9, letterSpacing: '0.1em', fontFamily: 'inherit', textTransform: 'uppercase' }}>
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: LIBRARY */}
        <div style={{ width: 200, flexShrink: 0, background: t.bg1, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <Label t={t}>Library</Label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: t.accent, fontFamily: "'DM Mono', monospace" }}>{library.length}</span>
              {library.length > 0 && <button onClick={clearLibrary} style={{ background: 'none', border: 'none', color: t.textFaint, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit' }}>clear</button>}
            </div>
          </div>
          <DropZone onFile={handleFile} t={t} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignContent: 'start' }}>
            {library.length === 0
              ? <div style={{ gridColumn: '1/-1', textAlign: 'center', color: t.textFaint, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', paddingTop: 20 }}>No generations</div>
              : library.map(item => <LibItem key={item.id} item={item} active={activeId === item.id} onLoad={() => loadLibraryItem(item)} onDelete={e => deleteLibraryItem(item.id, e)} t={t} />)
            }
          </div>
        </div>

        {/* CENTER: VIEWPORT */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#080808' }}>
          {!svgLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none', gap: 8 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1e1e1e' }}>Upload an SVG</span>
              <span style={{ fontSize: 9, letterSpacing: '0.08em', color: '#161616', textTransform: 'uppercase' }}>drop anywhere or use the library panel</span>
            </div>
          )}
          <canvas ref={canvasRef} style={{ flex: 1, display: 'block', width: '100%', height: '100%' }} />
          {baking && <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: `${bakeProgress}%`, background: t.accent, transition: 'width 0.1s' }} />}
          <div style={{ borderTop: '1px solid #1a1a1a', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d0d', flexShrink: 0, minHeight: 56 }}>
            {frames.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 2, overflowX: 'auto', flex: 1, alignItems: 'center' }}>
                  {frames.map((f, i) => <img key={i} src={f} style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 2, background: '#111', border: '1px solid #1e1e1e' }} alt={`f${i}`} />)}
                </div>
                <span style={{ fontSize: 9, color: '#444', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontFamily: "'DM Mono', monospace" }}>{frames.length}f · {frameSize}px</span>
              </>
            ) : (
              <span style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{baking ? `Baking ${bakeProgress}%` : 'Sprite strip — bake to generate'}</span>
            )}
          </div>
        </div>

        {/* RIGHT: CONTROLS */}
        <div style={{ width: 260, flexShrink: 0, background: t.bg1, borderLeft: `1px solid ${t.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          <Section label="Material" t={t}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(MATERIALS).map(m => <Chip key={m} active={material === m} onClick={() => setMaterial(m)} t={t}>{m}</Chip>)}
            </div>
          </Section>

          <Section label="Geometry" t={t}>
            <SliderRow label="Depth" value={depth} min={0.05} max={1} step={0.01} onChange={setDepth} onCommit={applyGeometry} display={depth.toFixed(2)} t={t} />
            <SliderRow label="Bevel" value={bevel} min={0} max={0.15} step={0.005} onChange={setBevel} onCommit={applyGeometry} display={bevel.toFixed(3)} t={t} />
          </Section>

          <Section label="Motion" t={t}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(MOTIONS).map(m => <Chip key={m} active={motion === m} onClick={() => setMotion(m)} t={t}>{m}</Chip>)}
            </div>
          </Section>

          <Section label="Environment" t={t}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(ENVIRONMENTS).map(([cat, envs]) => (
                <div key={cat}>
                  <Label t={t} style={{ display: 'block', marginBottom: 5, color: t.textFaint }}>{cat}</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {envs.map(env => <EnvChip key={env.id} env={env} active={environment.id === env.id} onClick={() => setEnvironment(env)} />)}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section label="Film" t={t}>
            <SliderRow label="Frames" value={frameCount} min={6} max={72} step={6} onChange={setFrameCount} onCommit={() => {}} t={t} />
            <SliderRow label="Frame Size" value={frameSize} min={64} max={512} step={64} onChange={setFrameSize} onCommit={() => {}} display={`${frameSize}px`} t={t} />
          </Section>

          <Section label="Bake" t={t}>
            <button onClick={bake} disabled={baking || !svgLoaded} style={{ width: '100%', padding: '10px', background: (baking || !svgLoaded) ? t.border2 : t.accent, color: (baking || !svgLoaded) ? t.textFaint : '#0a0a0a', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: (baking || !svgLoaded) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {baking ? `Baking ${bakeProgress}%` : 'Bake Strip'}
            </button>
          </Section>

          <Section label="Export" t={t} last>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <ExportBtn label="PNG" onClick={() => doExport('png')} t={t} />
              <ExportBtn label="JPG" onClick={() => doExport('jpg')} t={t} />
              <ExportBtn label="WebP" onClick={() => doExport('webp')} t={t} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <ExportBtn label="GIF" onClick={() => doExport('gif')} t={t} />
              <ExportBtn label="MP4" onClick={() => doExport('mp4')} t={t} />
              <ExportBtn label="GLB" onClick={() => doExport('glb')} t={t} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <ExportBtn label="All Frames" onClick={() => doExport('frames')} t={t} />
              <ExportBtn label="Export All" onClick={() => doExport('all')} t={t} accent />
            </div>
            <div style={{ marginTop: 8, fontSize: 9, color: t.textFaint, letterSpacing: '0.06em', lineHeight: 1.6 }}>
              GLB opens in Blender for FBX re-export. GIF falls back to frames ZIP if encoder unavailable.
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}
