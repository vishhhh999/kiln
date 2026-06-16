import { useState, useRef, useCallback } from 'react'
import { ENVIRONMENTS, MATERIALS, MOTIONS } from './lib/constants.js'
import { useKiln } from './lib/useKiln.js'

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #0e0e0e; }

  :root {
    --bg-base:       #0e0e0e;
    --bg-surface:    #151515;
    --bg-elevated:   #1c1c1c;
    --border:        #2a2a2a;
    --border-strong: #3d3d3d;
    --text-primary:  #f0ece4;
    --text-secondary:#9a9489;
    --text-tertiary: #5c5751;
    --accent:        #c8b99a;
    --accent-dim:    rgba(200,185,154,0.12);
    --accent-border: rgba(200,185,154,0.25);
    --error:         #eb5757;
    --radius-sm:     4px;
    --radius-md:     8px;
    --font-ui:       'DM Sans', sans-serif;
    --font-display:  'Space Grotesk', sans-serif;
  }

  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

  input[type=range] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    background: var(--border);
    border-radius: 1px;
    cursor: pointer;
    outline: none;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    transition: transform 0.15s;
  }
  input[type=range]:hover::-webkit-slider-thumb { transform: scale(1.3); }

  button { font-family: var(--font-ui); cursor: pointer; border: none; background: none; }
  button:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }

  .chip {
    font-size: 11px; font-weight: 500; letter-spacing: 0.02em;
    padding: 4px 10px; border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    color: var(--text-tertiary);
    background: transparent;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .chip:hover { border-color: var(--border-strong); color: var(--text-secondary); }
  .chip.active {
    border-color: var(--accent-border);
    background: var(--accent-dim);
    color: var(--accent);
  }

  .env-chip {
    font-size: 10px; font-weight: 500; letter-spacing: 0.02em;
    padding: 3px 8px; border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    color: var(--text-tertiary);
    background: transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .section-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-tertiary);
    font-family: var(--font-ui);
  }

  .bake-btn {
    width: 100%; padding: 10px 16px;
    background: var(--accent); color: #0e0e0e;
    border-radius: var(--radius-md); font-size: 12px;
    font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    transition: opacity 0.15s, transform 0.1s;
  }
  .bake-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .bake-btn:active:not(:disabled) { transform: translateY(0); }
  .bake-btn:disabled { background: var(--bg-elevated); color: var(--text-tertiary); cursor: not-allowed; }

  .export-btn {
    flex: 1; min-width: 0; padding: 6px 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-tertiary); font-size: 10px;
    font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .export-btn:hover { border-color: var(--border-strong); color: var(--text-secondary); }
  .export-btn.accent {
    background: var(--accent-dim); border-color: var(--accent-border); color: var(--accent);
  }
  .export-btn.accent:hover { background: var(--accent); color: #0e0e0e; }

  .lib-item {
    position: relative; border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-surface);
    overflow: hidden; cursor: pointer;
    transition: border-color 0.15s, transform 0.15s;
  }
  .lib-item:hover { border-color: var(--border-strong); transform: translateY(-1px); }
  .lib-item.active { border-color: var(--accent-border); background: var(--accent-dim); }

  .drop-zone {
    border: 1px dashed var(--border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }
  .drop-zone:hover, .drop-zone.hovering {
    border-color: var(--accent);
    background: var(--accent-dim);
  }

  /* Film strip scrubber */
  .scrubber-track {
    position: relative; height: 48px;
    background: var(--bg-base);
    border-top: 1px solid var(--border);
    display: flex; align-items: center;
    gap: 0; overflow: hidden; flex-shrink: 0;
  }
  .scrubber-frames {
    display: flex; height: 100%; flex: 1; overflow-x: auto; gap: 1px;
    padding: 4px 0; scroll-behavior: smooth;
  }
  .scrubber-frames::-webkit-scrollbar { height: 0; }
  .frame-thumb {
    flex-shrink: 0; height: 40px; width: 40px;
    border-radius: 2px; cursor: pointer;
    background: var(--bg-elevated);
    transition: opacity 0.1s, outline 0.1s;
    outline: 1px solid transparent;
    object-fit: cover;
  }
  .frame-thumb:hover { opacity: 0.85; }
  .frame-thumb.active { outline: 1.5px solid var(--accent); }

  .scrubber-info {
    flex-shrink: 0; padding: 0 12px; display: flex; flex-direction: column;
    align-items: flex-end; gap: 2px; border-left: 1px solid var(--border);
    height: 100%; justify-content: center;
  }

  /* Download button that appears on active frame */
  .dl-btn {
    position: absolute; top: 4px; right: 4px;
    background: var(--accent); color: #0e0e0e;
    border-radius: var(--radius-sm);
    font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
    padding: 2px 6px; opacity: 0; transition: opacity 0.15s;
    pointer-events: none;
  }
  .scrubber-frames:hover .frame-thumb.active + .dl-btn,
  .frame-thumb.active:hover ~ .dl-btn { opacity: 1; pointer-events: all; }
`

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────

function Chip({ active, onClick, children }) {
  return <button className={`chip${active ? ' active' : ''}`} onClick={onClick}>{children}</button>
}

function EnvChip({ env, active, onClick }) {
  const style = active ? {
    borderColor: env.key,
    background: env.bg,
    color: env.key,
    boxShadow: `0 0 8px ${env.key}44`,
  } : {}
  return <button className="env-chip" style={style} onClick={onClick}>{env.label}</button>
}

function SliderRow({ label, value, min, max, step, onChange, onCommit, display }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="section-label">{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit}
      />
    </div>
  )
}

function Section({ label, children, noBorder = false }) {
  return (
    <div style={{ padding: '16px', borderBottom: noBorder ? 'none' : '1px solid var(--border)' }}>
      {label && <div className="section-label" style={{ marginBottom: 10 }}>{label}</div>}
      {children}
    </div>
  )
}

function DropZone({ onFile }) {
  const [hovering, setHovering] = useState(false)
  const ref = useRef(null)
  const handleDrop = useCallback(e => {
    e.preventDefault(); setHovering(false)
    const f = e.dataTransfer.files[0]; if (f) onFile(f)
  }, [onFile])
  return (
    <div
      className={`drop-zone${hovering ? ' hovering' : ''}`}
      style={{ padding: '12px', textAlign: 'center', margin: '0 0 0 0' }}
      onClick={() => ref.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setHovering(true) }}
      onDragLeave={() => setHovering(false)}
    >
      <input ref={ref} type="file" accept=".svg" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
      <span style={{ fontSize: 11, color: hovering ? 'var(--accent)' : 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
        Drop SVG
      </span>
    </div>
  )
}

function LibItem({ item, active, onLoad, onDelete }) {
  return (
    <div className={`lib-item${active ? ' active' : ''}`} onClick={onLoad}>
      <img src={item.thumb} alt={item.name}
        style={{ width: '100%', aspectRatio: '1', display: 'block', background: 'var(--bg-base)', objectFit: 'cover' }} />
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: active ? 'var(--accent)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.name}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1, fontFamily: 'DM Mono, monospace' }}>
          {item.frameCount}f · {item.material}
        </div>
      </div>
      <button onClick={onDelete} style={{
        position: 'absolute', top: 4, right: 4, width: 18, height: 18,
        background: 'rgba(14,14,14,0.8)', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-tertiary)', fontSize: 12, display: 'flex',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        transition: 'color 0.1s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
      >×</button>
    </div>
  )
}

// ─── FILM STRIP SCRUBBER ─────────────────────────────────────────────────────

function FilmStrip({ frames, scrubIndex, onScrub, onResume, onDownloadFrame, baking, bakeProgress }) {
  const stripRef = useRef(null)

  const handleThumbClick = (i) => {
    onScrub(i)
    // Scroll active frame into view
    const el = stripRef.current?.children[i]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <div className="scrubber-track">
      {frames.length > 0 ? (
        <>
          <div className="scrubber-frames" ref={stripRef}>
            {frames.map((f, i) => (
              <img
                key={i}
                src={f}
                className={`frame-thumb${i === scrubIndex ? ' active' : ''}`}
                onClick={() => handleThumbClick(i)}
                alt={`f${i}`}
              />
            ))}
          </div>
          <div className="scrubber-info">
            <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
              {String(scrubIndex + 1).padStart(2, '0')}/{frames.length}
            </span>
            <button
              onClick={onResume}
              style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}
            >
              ▶ play
            </button>
            <button
              onClick={onDownloadFrame}
              style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}
            >
              ↓ png
            </button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          {baking ? (
            <>
              <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${bakeProgress}%`, background: 'var(--accent)', transition: 'width 0.1s', borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                {bakeProgress}%
              </span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
              Bake to generate frames
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const {
    svgLoaded, svgName, material, motion, depth, bevel,
    frameCount, frameSize, environment, frames, scrubIndex,
    baking, bakeProgress, exporting, exportStatus, status,
    library, activeId,
    setMaterial, setMotion, setDepth, setBevel,
    setFrameCount, setFrameSize, setEnvironment,
    handleFile, applyGeometry, bake, scrub, resumePlayback,
    loadLibraryItem, deleteLibraryItem, clearLibrary, doExport,
  } = useKiln(canvasRef, containerRef)

  const handleGlobalDrop = useCallback(e => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.svg')) handleFile(f)
  }, [handleFile])

  const downloadCurrentFrame = () => doExport('png')

  return (
    <>
      <style>{css}</style>
      <div
        style={{ fontFamily: 'var(--font-ui)', background: 'var(--bg-base)', color: 'var(--text-primary)', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onDrop={handleGlobalDrop}
        onDragOver={e => e.preventDefault()}
      >
        {/* TOPBAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 44, flexShrink: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent)' }}>KILN</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>SVG → 3D</span>
          </div>
          <span style={{ fontSize: 10, color: exporting ? 'var(--accent)' : 'var(--text-tertiary)', letterSpacing: '0.04em', fontWeight: 500 }}>
            {exporting ? (exportStatus || 'Exporting...') : status}
          </span>
        </div>

        {/* WORKSPACE */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: LIBRARY */}
          <div style={{ width: 196, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span className="section-label">Library</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {library.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>{library.length}</span>
                )}
                {library.length > 0 && (
                  <button onClick={clearLibrary} style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.04em', fontWeight: 500, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >clear</button>
                )}
              </div>
            </div>

            <div style={{ padding: 12, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <DropZone onFile={handleFile} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
              {library.length === 0 ? (
                <div style={{ gridColumn: '1/-1', paddingTop: 24, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>No generations</span>
                </div>
              ) : library.map(item => (
                <LibItem key={item.id} item={item} active={activeId === item.id}
                  onLoad={() => loadLibraryItem(item)}
                  onDelete={e => deleteLibraryItem(item.id, e)} />
              ))}
            </div>
          </div>

          {/* CENTER: VIEWPORT */}
          <div ref={containerRef} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#080808' }}>
            {!svgLoaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none', gap: 8 }}>
                <span style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1e1e1e', fontWeight: 700 }}>Upload an SVG</span>
                <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#161616', textTransform: 'uppercase', fontWeight: 500 }}>drop anywhere or use the library panel</span>
              </div>
            )}
            <canvas ref={canvasRef} style={{ flex: 1, display: 'block', width: '100%', height: '100%' }} />

            {/* FILM STRIP */}
            <FilmStrip
              frames={frames}
              scrubIndex={scrubIndex}
              onScrub={scrub}
              onResume={resumePlayback}
              onDownloadFrame={downloadCurrentFrame}
              baking={baking}
              bakeProgress={bakeProgress}
            />
          </div>

          {/* RIGHT: CONTROLS */}
          <div style={{ width: 256, flexShrink: 0, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            <Section label="Material">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.keys(MATERIALS).map(m => <Chip key={m} active={material === m} onClick={() => setMaterial(m)}>{m}</Chip>)}
              </div>
            </Section>

            <Section label="Geometry">
              <SliderRow label="Depth" value={depth} min={0.05} max={1} step={0.01} onChange={setDepth} onCommit={applyGeometry} display={depth.toFixed(2)} />
              <SliderRow label="Bevel" value={bevel} min={0} max={0.15} step={0.005} onChange={setBevel} onCommit={applyGeometry} display={bevel.toFixed(3)} />
            </Section>

            <Section label="Motion">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.keys(MOTIONS).map(m => <Chip key={m} active={motion === m} onClick={() => setMotion(m)}>{m}</Chip>)}
              </div>
            </Section>

            <Section label="Environment">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(ENVIRONMENTS).map(([cat, envs]) => (
                  <div key={cat}>
                    <div className="section-label" style={{ color: 'var(--border-strong)', marginBottom: 6 }}>{cat}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {envs.map(env => <EnvChip key={env.id} env={env} active={environment.id === env.id} onClick={() => setEnvironment(env)} />)}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section label="Film">
              <SliderRow label="Frames" value={frameCount} min={6} max={72} step={6} onChange={setFrameCount} onCommit={() => {}} />
              <SliderRow label="Frame Size" value={frameSize} min={64} max={512} step={64} onChange={setFrameSize} onCommit={() => {}} display={`${frameSize}px`} />
            </Section>

            <Section label="Bake">
              <button className="bake-btn" onClick={bake} disabled={baking || !svgLoaded}>
                {baking ? `Baking ${bakeProgress}%` : 'Bake Strip'}
              </button>
            </Section>

            <Section label="Export — Frame">
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.04em', marginBottom: 8 }}>
                Downloads the scrubbed frame
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="export-btn" onClick={() => doExport('png')}>PNG</button>
                <button className="export-btn" onClick={() => doExport('jpg')}>JPG</button>
                <button className="export-btn" onClick={() => doExport('webp')}>WebP</button>
              </div>
            </Section>

            <Section label="Export — Strip / Video">
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button className="export-btn" onClick={() => doExport('strip_png')}>Strip PNG</button>
                <button className="export-btn" onClick={() => doExport('strip_webp')}>Strip WebP</button>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button className="export-btn" onClick={() => doExport('gif')}>GIF</button>
                <button className="export-btn" onClick={() => doExport('mp4')}>MP4</button>
                <button className="export-btn" onClick={() => doExport('glb')}>GLB</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="export-btn" onClick={() => doExport('frames')}>All Frames</button>
                <button className="export-btn accent" onClick={() => doExport('all')}>Export All</button>
              </div>
            </Section>

            {/* VERSION */}
            <div style={{ marginTop: 'auto', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em' }}>v2</span>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
