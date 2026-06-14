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
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100)
    this.camera.position.set(0, 0, 6)

    // Orbit controls
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.enablePan = false
    this.controls.minDistance = 2
    this.controls.maxDistance = 15

    // PMREMGenerator for env maps
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.pmrem.compileEquirectangularShader()
    const roomEnv = new RoomEnvironment()
    this.envMap = this.pmrem.fromScene(roomEnv, 0.04)
    roomEnv.dispose()
    this.scene.environment = this.envMap.texture

    this.group = null
    this.lights = []
    this.animFrame = null
    this.t = 0
    this.motionFn = MOTIONS.Turntable
    this.lastSVGString = null
    this.lastDepth = 0.3
    this.lastBevel = 0.02
    this.isAnimating = false
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
    key.position.set(4, 6, 4)
    key.castShadow = true
    key.shadow.mapSize.width = 1024
    key.shadow.mapSize.height = 1024
    this.scene.add(key)
    this.lights.push(key)

    const amb = new THREE.AmbientLight(env.ambient, env.ambInt)
    this.scene.add(amb)
    this.lights.push(amb)

    const rim = new THREE.DirectionalLight(env.rim, env.rimInt)
    rim.position.set(-4, -2, -4)
    this.scene.add(rim)
    this.lights.push(rim)

    const fill = new THREE.PointLight(env.ambient, env.ambInt * 0.5, 12)
    fill.position.set(0, -4, 2)
    this.scene.add(fill)
    this.lights.push(fill)

    // Subtle top bounce
    const top = new THREE.DirectionalLight(env.key, env.keyInt * 0.15)
    top.position.set(0, 8, 0)
    this.scene.add(top)
    this.lights.push(top)
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
    })
  }

  setMaterial(matConfig) {
    if (!this.group) return
    const mat = this._buildMaterial(matConfig)
    this.group.traverse(child => {
      if (child.isMesh) {
        if (child.material) child.material.dispose()
        child.material = mat.clone()
      }
    })
    mat.dispose()
  }

  loadSVG(svgString, depth = 0.3, bevel = 0.02, matConfig = null) {
    this.lastSVGString = svgString
    this.lastDepth = depth
    this.lastBevel = bevel

    if (this.group) {
      this.scene.remove(this.group)
      this.group.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose()
          child.material.dispose()
        }
      })
      this.group = null
    }

    try {
      const loader = new SVGLoader()
      const data = loader.parse(svgString)
      const group = new THREE.Group()

      // Compute bounding box of all paths for normalization
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
            const hpts = hole.getPoints(12)
            hpts.forEach(p => {
              minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
              minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
            })
          })
        })
      })

      if (!isFinite(minX)) { minX = 0; maxX = 100; minY = 0; maxY = 100 }
      const rangeX = maxX - minX || 100
      const rangeY = maxY - minY || 100
      const scale = 3 / Math.max(rangeX, rangeY)
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2

      data.paths.forEach((path, idx) => {
        const shapes = SVGLoader.createShapes(path)
        if (!shapes.length) return

        // Per-path color from SVG fill
        const fillColor = path.color || new THREE.Color('#888888')
        const pathMatConfig = matConfig || { color: '#888888', metalness: 0.8, roughness: 0.2, envMapIntensity: 1.5 }

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

          const mat = this._buildMaterial(pathMatConfig)
          const mesh = new THREE.Mesh(geo, mat)
          mesh.castShadow = true
          mesh.receiveShadow = true
          group.add(mesh)
        })
      })

      if (group.children.length === 0) return false

      // Center group
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
    if (this.lastSVGString) {
      this.loadSVG(this.lastSVGString, depth, bevel)
    }
  }

  setMotion(motionName) {
    this.motionFn = MOTIONS[motionName] || MOTIONS.Turntable
  }

  start(onFrame) {
    if (this.animFrame) cancelAnimationFrame(this.animFrame)
    this.isAnimating = true
    const loop = () => {
      if (!this.isAnimating) return
      this.t += 0.016
      if (this.group && this.motionFn) {
        // Reset transform each frame before applying motion
        if (this.group.position.y !== undefined && this.motionFn !== MOTIONS.Float) {
          // keep position from motion
        }
        this.motionFn(this.group, this.t)
      }
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      if (onFrame) onFrame()
      this.animFrame = requestAnimationFrame(loop)
    }
    this.animFrame = requestAnimationFrame(loop)
  }

  stop() {
    this.isAnimating = false
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame)
      this.animFrame = null
    }
  }

  // Bake N frames into array of dataURLs (transparent PNG)
  async bakeFrames(frameCount, frameSize, onProgress) {
    this.stop()

    const offCanvas = document.createElement('canvas')
    offCanvas.width = frameSize
    offCanvas.height = frameSize

    const offRenderer = new THREE.WebGLRenderer({
      canvas: offCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    offRenderer.setSize(frameSize, frameSize)
    offRenderer.setPixelRatio(1)
    offRenderer.toneMapping = THREE.ACESFilmicToneMapping
    offRenderer.toneMappingExposure = 1.2
    offRenderer.outputColorSpace = THREE.SRGBColorSpace

    const offCamera = this.camera.clone()
    offCamera.aspect = 1
    offCamera.updateProjectionMatrix()

    const savedBg = this.scene.background
    this.scene.background = null // transparent

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
      frames.push(offCanvas.toDataURL('image/png'))

      if (onProgress) onProgress(Math.round(((i + 1) / frameCount) * 100))
      await new Promise(r => setTimeout(r, 8))
    }

    this.scene.background = savedBg
    offRenderer.dispose()

    // Reset group transform
    if (this.group) {
      this.group.rotation.set(0, 0, 0)
      this.group.position.set(0, 0, 0)
      this.group.scale.set(1, 1, 1)
    }

    this.start()
    return frames
  }

  captureFrame(size = 256) {
    const offCanvas = document.createElement('canvas')
    offCanvas.width = size
    offCanvas.height = size
    const offRenderer = new THREE.WebGLRenderer({
      canvas: offCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    offRenderer.setSize(size, size)
    offRenderer.setPixelRatio(1)
    offRenderer.toneMapping = THREE.ACESFilmicToneMapping
    offRenderer.toneMappingExposure = 1.2
    offRenderer.outputColorSpace = THREE.SRGBColorSpace

    const offCamera = this.camera.clone()
    offCamera.aspect = 1
    offCamera.updateProjectionMatrix()

    const savedBg = this.scene.background
    this.scene.background = new THREE.Color('#111111')

    if (this.group) {
      const saved = this.group.rotation.clone()
      this.group.rotation.set(0.1, 0.6, 0)
      offRenderer.render(this.scene, offCamera)
      this.group.rotation.copy(saved)
    } else {
      offRenderer.render(this.scene, offCamera)
    }

    this.scene.background = savedBg
    const data = offCanvas.toDataURL('image/png')
    offRenderer.dispose()
    return data
  }

  // Export current mesh as GLB binary
  exportGLB() {
    return new Promise((resolve, reject) => {
      if (!this.group) { reject(new Error('No mesh to export')); return }
      const exporter = new GLTFExporter()
      exporter.parse(
        this.group,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result)
          } else {
            const str = JSON.stringify(result)
            resolve(new TextEncoder().encode(str).buffer)
          }
        },
        (err) => reject(err),
        { binary: true, embedImages: true }
      )
    })
  }

  dispose() {
    this.stop()
    this.controls.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
  }
}
