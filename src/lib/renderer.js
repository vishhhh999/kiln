import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MOTIONS } from './constants.js'

export class KilnRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.6
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100)
    this.camera.position.set(0, 0, 6)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.enablePan = false
    this.controls.minDistance = 2
    this.controls.maxDistance = 15

    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.pmrem.compileEquirectangularShader()
    const roomEnv = new RoomEnvironment()
    this.envMap = this.pmrem.fromScene(roomEnv, 0.0)
    roomEnv.dispose()
    this.scene.environment = this.envMap.texture
    this.scene.environmentIntensity = 2.0

    this.group = null
    this.lights = []
    this.animFrame = null
    this.t = 0
    this.motionFn = MOTIONS.Turntable
    this.lastSVGString = null
    this.isAnimating = false
    this.currentMatConfig = null
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  setEnvironment(env) {
    this.scene.background = new THREE.Color(env.bg)
    this.lights.forEach(l => this.scene.remove(l))
    this.lights = []

    const key = new THREE.DirectionalLight(env.key, env.keyInt)
    key.position.set(5, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.width = 2048
    key.shadow.mapSize.height = 2048
    key.shadow.camera.near = 0.1
    key.shadow.camera.far = 30
    key.shadow.camera.left = -5; key.shadow.camera.right = 5
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5
    key.shadow.bias = -0.001
    this.scene.add(key); this.lights.push(key)

    const amb = new THREE.AmbientLight(env.ambient, env.ambInt)
    this.scene.add(amb); this.lights.push(amb)

    const rim = new THREE.DirectionalLight(env.rim, env.rimInt)
    rim.position.set(-5, -2, -5)
    this.scene.add(rim); this.lights.push(rim)

    const fill = new THREE.DirectionalLight(env.ambient, env.ambInt * 0.6)
    fill.position.set(-3, 2, 4)
    this.scene.add(fill); this.lights.push(fill)

    const top = new THREE.DirectionalLight(env.key, env.keyInt * 0.1)
    top.position.set(0, 10, 0)
    this.scene.add(top); this.lights.push(top)

    if (this.group && this.currentMatConfig) this.setMaterial(this.currentMatConfig)
  }

  _buildMaterial(matConfig) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(matConfig.color),
      metalness: matConfig.metalness,
      roughness: matConfig.roughness,
      envMapIntensity: matConfig.envMapIntensity,
      envMap: this.envMap.texture,
      transparent: matConfig.transparent || false,
      opacity: matConfig.opacity !== undefined ? matConfig.opacity : 1,
      side: THREE.DoubleSide, // fixes hollow look
    })
  }

  setMaterial(matConfig) {
    if (!this.group) return
    this.currentMatConfig = matConfig
    const mat = this._buildMaterial(matConfig)
    this.group.traverse(child => {
      if (child.isMesh) {
        if (child.material) child.material.dispose()
        child.material = mat.clone()
      }
    })
    mat.dispose()
  }

  loadSVG(svgString, depth = 0.3, bevel = 0.02) {
    this.lastSVGString = svgString

    if (this.group) {
      this.scene.remove(this.group)
      this.group.traverse(child => {
        if (child.isMesh) { child.geometry.dispose(); child.material.dispose() }
      })
      this.group = null
    }

    try {
      const loader = new SVGLoader()
      const data = loader.parse(svgString)
      const group = new THREE.Group()

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      data.paths.forEach(path => {
        const shapes = SVGLoader.createShapes(path)
        shapes.forEach(shape => {
          const pts = shape.getPoints(12)
          pts.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
          })
          shape.holes.forEach(hole => {
            hole.getPoints(12).forEach(p => {
              minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
              minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
            })
          })
        })
      })

      if (!isFinite(minX)) { minX = 0; maxX = 100; minY = 0; maxY = 100 }
      const scale = 3 / Math.max(maxX - minX || 100, maxY - minY || 100)
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2

      data.paths.forEach(path => {
        const shapes = SVGLoader.createShapes(path)
        if (!shapes.length) return
        const matConfig = this.currentMatConfig || { color: '#888888', metalness: 0.8, roughness: 0.2, envMapIntensity: 1.5 }
        shapes.forEach(shape => {
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: depth * 100,
            bevelEnabled: bevel > 0,
            bevelThickness: bevel * 100,
            bevelSize: bevel * 80,
            bevelSegments: 8,
            curveSegments: 16,
          })
          geo.scale(scale, -scale, scale)
          geo.translate(-cx * scale, cy * scale, 0)
          const mesh = new THREE.Mesh(geo, this._buildMaterial(matConfig))
          mesh.castShadow = true
          mesh.receiveShadow = true
          group.add(mesh)
        })
      })

      if (group.children.length === 0) return false

      const box = new THREE.Box3().setFromObject(group)
      const center = box.getCenter(new THREE.Vector3())
      group.position.sub(center)

      this.group = group
      this.scene.add(group)
      return true
    } catch (e) {
      console.error('SVG load error:', e)
      return false
    }
  }

  setGeometry(depth, bevel) {
    if (this.lastSVGString) this.loadSVG(this.lastSVGString, depth, bevel)
  }

  setMotion(motionName) {
    this.motionFn = MOTIONS[motionName] || MOTIONS.Turntable
  }

  // Seek to a specific normalised time [0..1] and render one frame -- for scrubber
  seekAndRender(norm) {
    if (!this.group) return
    const t = norm * Math.PI * 2
    this.group.rotation.set(0, 0, 0)
    this.group.position.set(0, 0, 0)
    this.group.scale.set(1, 1, 1)
    this.motionFn(this.group, t)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  start() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame)
    this.isAnimating = true
    const loop = () => {
      if (!this.isAnimating) return
      this.t += 0.016
      if (this.group && this.motionFn) this.motionFn(this.group, this.t)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      this.animFrame = requestAnimationFrame(loop)
    }
    this.animFrame = requestAnimationFrame(loop)
  }

  stop() {
    this.isAnimating = false
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null }
  }

  async bakeFrames(frameCount, frameSize, onProgress) {
    this.stop()

    // 2x internal resolution then downscale for quality
    const SCALE = 2
    const offCanvas = document.createElement('canvas')
    offCanvas.width = frameSize * SCALE
    offCanvas.height = frameSize * SCALE

    const offRenderer = new THREE.WebGLRenderer({
      canvas: offCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    offRenderer.setSize(frameSize * SCALE, frameSize * SCALE)
    offRenderer.setPixelRatio(1)
    offRenderer.toneMapping = THREE.ACESFilmicToneMapping
    offRenderer.toneMappingExposure = 1.6
    offRenderer.outputColorSpace = THREE.SRGBColorSpace

    const offCamera = this.camera.clone()
    offCamera.aspect = 1
    offCamera.updateProjectionMatrix()

    // Output canvas at target resolution
    const outCanvas = document.createElement('canvas')
    outCanvas.width = frameSize
    outCanvas.height = frameSize
    const outCtx = outCanvas.getContext('2d')

    const savedBg = this.scene.background
    this.scene.background = null

    const frames = []

    for (let i = 0; i < frameCount; i++) {
      const t = (i / frameCount) * Math.PI * 2
      if (this.group) {
        this.group.rotation.set(0, 0, 0)
        this.group.position.set(0, 0, 0)
        this.group.scale.set(1, 1, 1)
        this.motionFn(this.group, t)
      }
      offRenderer.render(this.scene, offCamera)

      // Downscale for crisp output
      outCtx.clearRect(0, 0, frameSize, frameSize)
      outCtx.drawImage(offCanvas, 0, 0, frameSize, frameSize)
      frames.push(outCanvas.toDataURL('image/png'))

      if (onProgress) onProgress(Math.round(((i + 1) / frameCount) * 100))
      await new Promise(r => setTimeout(r, 8))
    }

    this.scene.background = savedBg
    offRenderer.dispose()

    if (this.group) {
      this.group.rotation.set(0, 0, 0)
      this.group.position.set(0, 0, 0)
      this.group.scale.set(1, 1, 1)
    }

    this.start()
    return frames
  }

  captureFrame(size = 256) {
    const SCALE = 2
    const offCanvas = document.createElement('canvas')
    offCanvas.width = size * SCALE; offCanvas.height = size * SCALE
    const offRenderer = new THREE.WebGLRenderer({ canvas: offCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    offRenderer.setSize(size * SCALE, size * SCALE)
    offRenderer.setPixelRatio(1)
    offRenderer.toneMapping = THREE.ACESFilmicToneMapping
    offRenderer.toneMappingExposure = 1.6
    offRenderer.outputColorSpace = THREE.SRGBColorSpace

    const offCamera = this.camera.clone()
    offCamera.aspect = 1; offCamera.updateProjectionMatrix()

    const savedBg = this.scene.background
    this.scene.background = new THREE.Color('#111111')
    if (this.group) { const s = this.group.rotation.clone(); this.group.rotation.set(0.1, 0.6, 0); offRenderer.render(this.scene, offCamera); this.group.rotation.copy(s) }
    else offRenderer.render(this.scene, offCamera)
    this.scene.background = savedBg

    const outCanvas = document.createElement('canvas')
    outCanvas.width = size; outCanvas.height = size
    outCanvas.getContext('2d').drawImage(offCanvas, 0, 0, size, size)
    const data = outCanvas.toDataURL('image/png')
    offRenderer.dispose()
    return data
  }

  exportGLB() {
    return new Promise((resolve, reject) => {
      if (!this.group) { reject(new Error('No mesh')); return }
      new GLTFExporter().parse(this.group, result => {
        resolve(result instanceof ArrayBuffer ? result : new TextEncoder().encode(JSON.stringify(result)).buffer)
      }, reject, { binary: true, embedImages: true })
    })
  }

  dispose() {
    this.stop()
    this.controls.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
  }
}
