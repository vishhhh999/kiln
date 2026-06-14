# Kiln

SVG to 3D sprite sheet generator. Upload an SVG, extrude it into a 3D object, apply materials and motion, bake to a sprite strip, export in any format.

## Stack
- React + Vite
- Three.js (SVGLoader, GLTFExporter, OrbitControls)
- JSZip + file-saver for exports
- LocalStorage-backed generation library

## Dev
```bash
npm install
npm run dev
```

## Deploy
Push to GitHub, connect to Vercel. Build command is set in vercel.json.

## Exports
- PNG / JPG / WebP sprite strip
- GIF (animated, uses gif.js)
- MP4 / WebM (MediaRecorder)
- GLB (Three.js GLTFExporter -- open in Blender to re-export as FBX)
- All frames as ZIP
- Export All bundle (everything in one ZIP)
