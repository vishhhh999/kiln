import { useState, useRef, useCallback, useEffect } from 'react'
import { ENVIRONMENTS, MATERIALS, MOTIONS } from './lib/constants.js'
import { useKiln } from './lib/useKiln.js'
import { getSession, clearSession } from './lib/auth.js'
import Login from './components/Login.jsx'

// ─── THEME ───────────────────────────────────────────────────────────────────

const DARK = {
  bgBase:      '#0e0e0e',
  bgSurface:   '#151515',
  bgElevated:  '#1c1c1c',
  border:      '#2a2a2a',
  borderStrong:'#3d3d3d',
  textPrimary: '#f0ece4',
  textSec:     '#9a9489',
  textTert:    '#5c5751',
  accent:      '#c8b99a',
  accentDim:   'rgba(200,185,154,0.12)',
  accentBorder:'rgba(200,185,154,0.28)',
  error:       '#eb5757',
  viewportBg:  '#080808',
}

const LIGHT = {
  bgBase:      '#f2f1ef',
  bgSurface:   '#ffffff',
  bgElevated:  '#ebebeb',
  border:      '#e0e0de',
  borderStrong:'#c8c8c6',
  textPrimary: '#1a1a18',
  textSec:     '#6a6a68',
  textTert:    '#aaaaaa',
  accent:      '#8a7a6a',
  accentDim:   'rgba(138,122,106,0.1)',
  accentBorder:'rgba(138,122,106,0.3)',
  error:       '#cc3333',
  viewportBg:  '#d8d7d5',
}

function makeCSS(t) {
  return `
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 2px; }
    button { font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; background: none; }
    button:focus-visible { outline: 1px solid ${t.accent}; outline-offset: 2px; }
    input[type=range] {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 2px; background: ${t.border};
      border-radius: 1px; cursor: pointer; outline: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 12px; height: 12px;
      border-radius: 50%; background: ${t.accent}; cursor: pointer; transition: transform 0.15s;
    }
    input[type=range]:hover::-webkit-slider-thumb { transform: scale(1.3); }
    .chip {
      font-size: 11px; font-weight: 500; letter-spacing: 0.02em;
      padding: 4px 10px; border-radius: 4px; border: 1px solid ${t.border};
      color: ${t.textTert}; background: transparent;
      transition: border-color 0.15s, color 0.15s, background 0.15s; white-space: nowrap;
    }
    .chip:hover { border-color: ${t.borderStrong}; color: ${t.textSec}; }
    .chip.active { border-color: ${t.accentBorder}; background: ${t.accentDim}; color: ${t.accent}; }
    .env-chip {
      font-size: 10px; font-weight: 500; letter-spacing: 0.02em;
      padding: 3px 8px; border-radius: 4px; border: 1px solid ${t.border};
      color: ${t.textTert}; background: transparent; transition: all 0.2s; white-space: nowrap;
    }
    .slabel { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${t.textTert}; }
    .bake-btn {
      width: 100%; padding: 10px 16px; background: ${t.accent}; color: #0e0e0e;
      border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      transition: opacity 0.15s, transform 0.1s;
    }
    .bake-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    .bake-btn:active:not(:disabled) { transform: translateY(0); }
    .bake-btn:disabled { background: ${t.bgElevated}; color: ${t.textTert}; cursor: not-allowed; }
    .exp-btn {
      flex: 1; min-width: 0; padding: 6px 4px; border: 1px solid ${t.border};
      border-radius: 4px; color: ${t.textTert}; font-size: 10px; font-weight: 500;
      letter-spacing: 0.06em; text-transform: uppercase;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .exp-btn:hover { border-color: ${t.borderStrong}; color: ${t.textSec}; background: ${t.bgElevated}; }
    .exp-btn.hi { background: ${t.accentDim}; border-color: ${t.accentBorder}; color: ${t.accent}; }
    .exp-btn.hi:hover { background: ${t.accent}; color: #0e0e0e; border-color: ${t.accent}; }
    .lib-item {
      position: relative; border-radius: 8px; border: 1px solid ${t.border};
      background: ${t.bgElevated}; overflow: hidden; cursor: pointer;
      transition: border-color 0.15s, transform 0.15s;
    }
    .lib-item:hover { border-color: ${t.borderStrong}; transform: translateY(-1px); }
    .lib-item.active { border-color: ${t.accentBorder}; background: ${t.accentDim}; }
    .drop-zone {
      border: 1px dashed ${t.border}; border-radius: 8px;
      transition: border-color 0.15s, background 0.15s; cursor: pointer;
    }
    .drop-zone:hover, .drop-zone.hov { border-color: ${t.accent}; background: ${t.accentDim}; }
    .topbtn {
      padding: 4px 12px; border-radius: 4px; border: 1px solid ${t.border};
      font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
      color: ${t.textTert}; transition: border-color 0.15s, color 0.15s;
    }
    .topbtn:hover { border-color: ${t.borderStrong}; color: ${t.textSec}; }
    /* Scrubber */
    .scrub-track {
      height: 56px; background: ${t.bgBase}; border-top: 1px solid ${t.border};
      display: flex; align-items: center; flex-shrink: 0; overflow: hidden;
    }
    .scrub-frames {
      display: flex; flex: 1; height: 100%; overflow-x: auto;
      gap: 2px; padding: 8px 8px; align-items: center;
    }
    .scrub-frames::-webkit-scrollbar { height: 0; }
    .frame-th {
      flex-shrink: 0; width: 40px; height: 40px; border-radius: 3px; cursor: pointer;
      background: ${t.bgElevated}; object-fit: cover;
      outline: 1.5px solid transparent; transition: outline-color 0.1s, opacity 0.1s;
    }
    .frame-th:hover { opacity: 0.8; }
    .frame-th.sel { outline-color: ${t.accent}; }
    .scrub-side {
      width: 80px; flex-shrink: 0; border-left: 1px solid ${t.border};
      height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 4px; padding: 0 8px;
    }
    .scrub-btn {
      font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      padding: 3px 8px; border-radius: 3px; transition: all 0.1s;
    }
    .scrub-btn.play { color: ${t.textTert}; border: 1px solid ${t.border}; }
    .scrub-btn.play:hover { color: ${t.textSec}; border-color: ${t.borderStrong}; }
    .scrub-btn.dl { background: ${t.accent}; color: #0e0e0e; }
    .scrub-btn.dl:hover { opacity: 0.85; }
  `
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Chip({ active, onClick, children }) {
  return <button className={`chip${active ? ' active' : ''}`} onClick={onClick}>{children}</button>
}

function EnvChip({ env, active, onClick }) {
  const style = active
    ? { borderColor: env.key, background: env.bg, color: env.key, boxShadow: `0 0 8px ${env.key}44` }
    : {}
  return <button className="env-chip" style={style} onClick={onClick}>{env.label}</button>
}

function SliderRow({ label, value, min, max, step, onChange, onCommit, display, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="slabel">{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: t.textSec }}>{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit} />
    </div>
  )
}

function Sect({ label, children, t, last }) {
  return (
    <div style={{ padding: 16, borderBottom: last ? 'none' : `1px solid ${t.border}` }}>
      {label && <div className="slabel" style={{ display: 'block', marginBottom: 10 }}>{label}</div>}
      {children}
    </div>
  )
}

function DropZone({ onFile }) {
  const [hov, setHov] = useState(false)
  const ref = useRef(null)
  const onDrop = useCallback(e => { e.preventDefault(); setHov(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }, [onFile])
  return (
    <div className={`drop-zone${hov ? ' hov' : ''}`}
      style={{ padding: 12, textAlign: 'center' }}
      onClick={() => ref.current?.click()}
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setHov(true) }}
      onDragLeave={() => setHov(false)}>
      <input ref={ref} type="file" accept=".svg" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Drop SVG</span>
    </div>
  )
}

function LibItem({ item, active, onLoad, onDelete, t }) {
  const name = item.name
  const mat = item.material
  const fc = item.frame_count || item.frameCount
  return (
    <div className={`lib-item${active ? ' active' : ''}`} onClick={onLoad}>
      <img src={item.thumbnail || item.thumb} alt={name}
        style={{ width: '100%', aspectRatio: '1', display: 'block', background: t.bgBase, objectFit: 'cover' }} />
      <div style={{ padding: '6px 8px', borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: active ? t.accent : t.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 9, color: t.textTert, marginTop: 1, fontFamily: 'DM Mono, monospace' }}>{fc}f · {mat}</div>
      </div>
      <button onClick={onDelete} style={{
        position: 'absolute', top: 4, right: 4, width: 18, height: 18,
        background: 'rgba(0,0,0,0.7)', borderRadius: 3,
        color: t.textTert, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
        onMouseEnter={e => e.currentTarget.style.color = t.error}
        onMouseLeave={e => e.currentTarget.style.color = t.textTert}
      >×</button>
    </div>
  )
}

// ─── FILM STRIP SCRUBBER ─────────────────────────────────────────────────────

function FilmStrip({ frames, scrubIndex, isScrubbing, onScrub, onResume, onDownload, baking, bakeProgress, t }) {
  const stripRef = useRef(null)

  const handleClick = (i) => {
    onScrub(i)
    const el = stripRef.current?.children[i]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <div className="scrub-track">
      {frames.length > 0 ? (
        <>
          <div className="scrub-frames" ref={stripRef}>
            {frames.map((f, i) => (
              <img key={i} src={f}
                className={`frame-th${i === scrubIndex ? ' sel' : ''}`}
                onClick={() => handleClick(i)} alt={`f${i}`} />
            ))}
          </div>
          <div className="scrub-side">
            <span style={{ fontSize: 10, color: t.accent, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>
              {String(scrubIndex + 1).padStart(2, '0')}/{frames.length}
            </span>
            {isScrubbing && (
              <button className="scrub-btn play" onClick={onResume}>▶ Play</button>
            )}
            <button className="scrub-btn dl" onClick={onDownload}>↓ PNG</button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
          {baking ? (
            <>
              <div style={{ flex: 1, height: 2, background: t.border, borderRadius: 1, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${bakeProgress}%`, background: t.accent, transition: 'width 0.1s', borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 10, color: t.textTert, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{bakeProgress}%</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: t.textTert, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
              Bake to generate frames
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true)
  const [userHash, setUserHash] = useState(null)
  const t = dark ? DARK : LIGHT

  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Check existing session on mount
  useEffect(() => {
    const s = getSession()
    if (s?.userHash) setUserHash(s.userHash)
  }, [])

  const {
    svgLoaded, svgName, material, motion, depth, bevel,
    frameCount, frameSize, environment, frames, scrubIndex, isScrubbing,
    baking, bakeProgress, exporting, exportStatus, status, syncing,
    library, activeId,
    setMaterial, setMotion, setDepth, setBevel,
    setFrameCount, setFrameSize, setEnvironment,
    handleFile, applyGeometry, bake, scrub, resumePlayback,
    loadLibraryItem, deleteLibraryItem, clearLibrary, doExport,
  } = useKiln(canvasRef, containerRef, userHash)

  const handleGlobalDrop = useCallback(e => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.svg')) handleFile(f)
  }, [handleFile])

  const handleLogout = () => { clearSession(); setUserHash(null) }

  // Show login if no session
  if (!userHash) {
    return <Login onLogin={hash => setUserHash(hash)} />
  }

  const bg = t.bgBase
  const surf = t.bgSurface

  return (
    <>
      <style>{makeCSS(t)}</style>
      <div
        style={{ fontFamily: "'DM Sans', sans-serif", background: bg, color: t.textPrimary, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onDrop={handleGlobalDrop}
        onDragOver={e => e.preventDefault()}
      >
        {/* TOPBAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 44, flexShrink: 0, background: surf, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', color: t.accent }}>KILN</span>
            <span style={{ fontSize: 10, color: t.textTert, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>SVG → 3D</span>
          </div>

          <span style={{ fontSize: 10, color: exporting ? t.accent : syncing ? t.accent : t.textTert, letterSpacing: '0.04em', fontWeight: 500, flex: 1, textAlign: 'center' }}>
            {exporting ? (exportStatus || 'Exporting...') : syncing ? 'Syncing...' : status}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="topbtn" onClick={() => setDark(d => !d)}>
              {dark ? '☀ Light' : '◑ Dark'}
            </button>
            <button className="topbtn" onClick={handleLogout}>Sign out</button>
          </div>
        </div>

        {/* WORKSPACE */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: LIBRARY */}
          <div style={{ width: 196, flexShrink: 0, background: surf, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <span className="slabel">Library {syncing ? '…' : ''}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {library.length > 0 && <span style={{ fontSize: 10, color: t.accent, fontFamily: 'DM Mono, monospace' }}>{library.length}</span>}
                {library.length > 0 && (
                  <button onClick={clearLibrary} style={{ fontSize: 10, color: t.textTert, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.color = t.error}
                    onMouseLeave={e => e.currentTarget.style.color = t.textTert}
                  >clear</button>
                )}
              </div>
            </div>
            <div style={{ padding: 12, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <DropZone onFile={handleFile} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
              {library.length === 0
                ? <div style={{ gridColumn: '1/-1', paddingTop: 24, textAlign: 'center', fontSize: 10, color: t.textTert, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>No generations</div>
                : library.map(item => (
                  <LibItem key={item.id} item={item} active={activeId === item.id} t={t}
                    onLoad={() => loadLibraryItem(item)}
                    onDelete={e => deleteLibraryItem(item.id, e)} />
                ))
              }
            </div>
          </div>

          {/* CENTER: VIEWPORT */}
          <div ref={containerRef} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.viewportBg }}>
            {!svgLoaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none', gap: 8 }}>
                <span style={{ fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: dark ? '#1e1e1e' : '#c0c0be', fontWeight: 700 }}>Upload an SVG</span>
                <span style={{ fontSize: 10, letterSpacing: '0.08em', color: dark ? '#161616' : '#d0d0ce', textTransform: 'uppercase', fontWeight: 500 }}>drop anywhere or use the library panel</span>
              </div>
            )}
            <canvas ref={canvasRef} style={{ flex: 1, display: 'block', width: '100%', height: '100%' }} />

            {/* FILM STRIP SCRUBBER */}
            <FilmStrip
              frames={frames}
              scrubIndex={scrubIndex}
              isScrubbing={isScrubbing}
              onScrub={scrub}
              onResume={resumePlayback}
              onDownload={() => doExport('png')}
              baking={baking}
              bakeProgress={bakeProgress}
              t={t}
            />
          </div>

          {/* RIGHT: CONTROLS */}
          <div style={{ width: 256, flexShrink: 0, background: surf, borderLeft: `1px solid ${t.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            <Sect label="Material" t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.keys(MATERIALS).map(m => <Chip key={m} active={material === m} onClick={() => setMaterial(m)}>{m}</Chip>)}
              </div>
            </Sect>

            <Sect label="Geometry" t={t}>
              <SliderRow label="Depth" value={depth} min={0.05} max={1} step={0.01} onChange={setDepth} onCommit={applyGeometry} display={depth.toFixed(2)} t={t} />
              <SliderRow label="Bevel" value={bevel} min={0} max={0.15} step={0.005} onChange={setBevel} onCommit={applyGeometry} display={bevel.toFixed(3)} t={t} />
            </Sect>

            <Sect label="Motion" t={t}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.keys(MOTIONS).map(m => <Chip key={m} active={motion === m} onClick={() => setMotion(m)}>{m}</Chip>)}
              </div>
            </Sect>

            <Sect label="Environment" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(ENVIRONMENTS).map(([cat, envs]) => (
                  <div key={cat}>
                    <div className="slabel" style={{ display: 'block', marginBottom: 6, color: t.borderStrong }}>{cat}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {envs.map(env => <EnvChip key={env.id} env={env} active={environment.id === env.id} onClick={() => setEnvironment(env)} />)}
                    </div>
                  </div>
                ))}
              </div>
            </Sect>

            <Sect label="Film" t={t}>
              <SliderRow label="Frames" value={frameCount} min={6} max={72} step={6} onChange={setFrameCount} onCommit={() => {}} t={t} />
              <SliderRow label="Frame Size" value={frameSize} min={64} max={512} step={64} onChange={setFrameSize} onCommit={() => {}} display={`${frameSize}px`} t={t} />
            </Sect>

            <Sect label="Bake" t={t}>
              <button className="bake-btn" onClick={bake} disabled={baking || !svgLoaded}>
                {baking ? `Baking ${bakeProgress}%` : 'Bake Strip'}
              </button>
            </Sect>

            <Sect label="Export — Frame" t={t}>
              <div style={{ fontSize: 10, color: t.textTert, marginBottom: 8, letterSpacing: '0.02em' }}>
                Downloads the scrubbed frame
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="exp-btn" onClick={() => doExport('png')}>PNG</button>
                <button className="exp-btn" onClick={() => doExport('jpg')}>JPG</button>
                <button className="exp-btn" onClick={() => doExport('webp')}>WebP</button>
              </div>
            </Sect>

            <Sect label="Export — Strip / Video" t={t}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button className="exp-btn" onClick={() => doExport('strip_png')}>Strip PNG</button>
                <button className="exp-btn" onClick={() => doExport('strip_webp')}>Strip WebP</button>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button className="exp-btn" onClick={() => doExport('gif')}>GIF</button>
                <button className="exp-btn" onClick={() => doExport('mp4')}>MP4</button>
                <button className="exp-btn" onClick={() => doExport('glb')}>GLB</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="exp-btn" onClick={() => doExport('frames')}>All Frames</button>
                <button className="exp-btn hi" onClick={() => doExport('all')}>Export All</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 9, color: t.textTert, lineHeight: 1.6, letterSpacing: '0.02em' }}>
                GLB → open in Blender → File › Export › FBX
              </div>
            </Sect>

            {/* VERSION */}
            <div style={{ marginTop: 'auto', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: t.textTert, fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em' }}>v2.1</span>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
