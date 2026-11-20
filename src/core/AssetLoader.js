import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Central asset loading with:
 *  - a shared LoadingManager so the loading screen can show real progress,
 *  - caching (each URL is fetched once),
 *  - meshopt-compressed GLB support (see scripts/README in docs),
 *  - "background" loads that do not hold up the loading screen (lazy assets).
 */
export class AssetLoader {
  constructor(renderer) {
    this.renderer = renderer;
    this.manager = new THREE.LoadingManager();
    this.bgManager = new THREE.LoadingManager();
    this.gltf = new GLTFLoader(this.manager).setMeshoptDecoder(MeshoptDecoder);
    this.bgGltf = new GLTFLoader(this.bgManager).setMeshoptDecoder(MeshoptDecoder);
    this.tex = new THREE.TextureLoader(this.manager);
    this.bgTex = new THREE.TextureLoader(this.bgManager);
    this.cache = new Map();
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  onProgress(fn) {
    this.manager.onProgress = (_url, loaded, total) => fn(loaded / Math.max(total, 1));
  }

  /** @param {boolean} background  true = lazy load, not counted on the loader */
  model(url, background = false) {
    const key = `m:${url}`;
    if (!this.cache.has(key)) {
      const loader = background ? this.bgGltf : this.gltf;
      this.cache.set(key, loader.loadAsync(url).catch((e) => {
        this.cache.delete(key);
        throw e;
      }));
    }
    return this.cache.get(key);
  }

  /**
   * @param {object} opts  flipY=false for textures applied to GLB meshes
   *                       (glTF UVs have a top-left origin).
   */
  texture(url, { background = false, flipY = true, srgb = true } = {}) {
    const key = `t:${url}:${flipY}`;
    if (!this.cache.has(key)) {
      const loader = background ? this.bgTex : this.tex;
      this.cache.set(key, loader.loadAsync(url).then((t) => {
        t.flipY = flipY;
        t.anisotropy = Math.min(8, this.maxAniso);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        return t;
      }).catch((e) => {
        this.cache.delete(key);
        throw e;
      }));
    }
    return this.cache.get(key);
  }

  /** Drop a cached texture and free its GPU memory. */
  releaseTexture(url, flipY = true) {
    const key = `t:${url}:${flipY}`;
    const p = this.cache.get(key);
    if (!p) return;
    this.cache.delete(key);
    p.then((t) => t.dispose()).catch(() => {});
  }
}
