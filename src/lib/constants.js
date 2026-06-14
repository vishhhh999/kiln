export const ENVIRONMENTS = {
  Natural: [
    { id: 'golden_hour', label: 'Golden Hour', bg: '#1a0f00', ambient: '#ff8c42', key: '#ffcc80', keyInt: 2.5, ambInt: 0.4, rim: '#ff6b35', rimInt: 0.8 },
    { id: 'overcast',    label: 'Overcast',    bg: '#1c1e22', ambient: '#b0c4de', key: '#e8eef4', keyInt: 1.2, ambInt: 0.8, rim: '#8fa8c8', rimInt: 0.3 },
    { id: 'noon',        label: 'High Noon',   bg: '#0d1117', ambient: '#fffde7', key: '#ffffff', keyInt: 3.0, ambInt: 0.3, rim: '#e3f2fd', rimInt: 0.5 },
    { id: 'sunset',      label: 'Sunset',      bg: '#1a0808', ambient: '#ff4500', key: '#ff6347', keyInt: 2.0, ambInt: 0.5, rim: '#ffd700', rimInt: 1.2 },
    { id: 'forest',      label: 'Forest',      bg: '#050e05', ambient: '#2d5a1b', key: '#7cbc5e', keyInt: 1.5, ambInt: 0.6, rim: '#a8d5a2', rimInt: 0.4 },
  ],
  Dim: [
    { id: 'candlelight', label: 'Candlelight', bg: '#080400', ambient: '#3d1f00', key: '#ff9800', keyInt: 1.2, ambInt: 0.2, rim: '#ff6d00', rimInt: 0.6 },
    { id: 'moonlight',   label: 'Moonlight',   bg: '#020408', ambient: '#1a2a3d', key: '#b8d4f0', keyInt: 0.8, ambInt: 0.3, rim: '#4a6fa5', rimInt: 0.4 },
    { id: 'deep_dusk',   label: 'Deep Dusk',   bg: '#0a0510', ambient: '#2d1b4e', key: '#9b59b6', keyInt: 0.9, ambInt: 0.4, rim: '#6c3483', rimInt: 0.5 },
  ],
  Neon: [
    { id: 'cyberpunk',   label: 'Cyberpunk',   bg: '#000510', ambient: '#0a0a2e', key: '#00f5ff', keyInt: 2.0, ambInt: 0.3, rim: '#ff00ff', rimInt: 1.5 },
    { id: 'neon_pink',   label: 'Neon Pink',   bg: '#08000a', ambient: '#1a0020', key: '#ff00aa', keyInt: 2.5, ambInt: 0.2, rim: '#7700ff', rimInt: 1.2 },
    { id: 'acid',        label: 'Acid Green',  bg: '#000a00', ambient: '#001a00', key: '#00ff41', keyInt: 2.2, ambInt: 0.25, rim: '#00cc32', rimInt: 0.8 },
  ],
  Strange: [
    { id: 'backrooms',   label: 'Backrooms',   bg: '#1a1500', ambient: '#4a3a00', key: '#d4b800', keyInt: 1.0, ambInt: 0.7, rim: '#c8a000', rimInt: 0.3 },
  ],
}

export const DEFAULT_ENV = ENVIRONMENTS.Natural[0]

export const MATERIALS = {
  Chrome:   { color: '#c0c0c0', metalness: 1.0,  roughness: 0.05,  envMapIntensity: 2.0 },
  Gunmetal: { color: '#3a3d42', metalness: 0.9,  roughness: 0.2,   envMapIntensity: 1.5 },
  Porcelain:{ color: '#f5f0eb', metalness: 0.0,  roughness: 0.1,   envMapIntensity: 0.8 },
  Copper:   { color: '#b87333', metalness: 0.95, roughness: 0.15,  envMapIntensity: 1.8 },
  Gold:     { color: '#c8b99a', metalness: 1.0,  roughness: 0.1,   envMapIntensity: 2.2 },
  Matte:    { color: '#2a2a2a', metalness: 0.0,  roughness: 0.9,   envMapIntensity: 0.3 },
  Glass:    { color: '#88ccff', metalness: 0.0,  roughness: 0.0,   envMapIntensity: 1.0, transparent: true, opacity: 0.3 },
  Obsidian: { color: '#0a0a0f', metalness: 0.8,  roughness: 0.05,  envMapIntensity: 1.2 },
  Rust:     { color: '#8b3a1e', metalness: 0.3,  roughness: 0.85,  envMapIntensity: 0.4 },
  Pearl:    { color: '#f0ece8', metalness: 0.1,  roughness: 0.05,  envMapIntensity: 1.5 },
}

export const MOTIONS = {
  Turntable: (mesh, t) => { mesh.rotation.y = t * 0.8; mesh.rotation.x = Math.sin(t * 0.3) * 0.08; },
  Spin:      (mesh, t) => { mesh.rotation.y = t * 1.5; },
  Float:     (mesh, t) => { mesh.rotation.y = t * 0.5; mesh.position.y = Math.sin(t * 1.2) * 0.15; },
  Sway:      (mesh, t) => { mesh.rotation.z = Math.sin(t * 1.5) * 0.2; mesh.rotation.y = t * 0.3; },
  Pendulum:  (mesh, t) => { mesh.rotation.z = Math.sin(t * 2) * 0.4; },
  Nod:       (mesh, t) => { mesh.rotation.x = Math.sin(t * 1.8) * 0.3; mesh.rotation.y = t * 0.5; },
  Pulse:     (mesh, t) => { const s = 1 + Math.sin(t * 3) * 0.05; mesh.scale.set(s, s, s); mesh.rotation.y = t * 0.8; },
  Static:    (mesh)    => { mesh.rotation.y = 0.5; },
}
