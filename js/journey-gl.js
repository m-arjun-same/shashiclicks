/* Journey WebGL scene — own code, vendored Three.js r158 (module).
   Centre = the Canon AT-1 camera GLB (assets/models/camera.glb, no Draco),
   large in frame, scrub-rotating. Around it, six of the studio's real
   photographs as larger tilted planes on a helix. Scroll progress comes
   from js/main.js: window.__jCur is already pow(p,.7) smoothed at lerp .22.
   If anything fails, window.__glReady stays false and main.js keeps
   drawing its 2D frame-sequence fallback — silently, no console errors. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PHOTOS = [
  'assets/img/j1.webp', 'assets/img/j2.webp', 'assets/img/j3.webp',
  'assets/img/j4.webp', 'assets/img/j5.webp', 'assets/img/j6.webp'
];
const MODEL = 'assets/models/camera.glb';
/* Angle scan of the GLB: rotY 0 = dead front (AT-1 plate + lens ring
   readable), +30° = clean 3/4 front. At the desk-1 stop the scroll scrub
   has already added jCur(.49) x 288° ≈ +141°, so the desktop base sits at
   -111° to land the model on that +30° 3/4 front at the stop. On phones
   the court's scroll progress runs far behind (jCur ≈ .06 at the same
   stop), so the mobile base compensates to land on the same +30°. */
const BASE_ROT_Y = -111 * Math.PI / 180;
const MOB_BASE_ROT_Y = 12 * Math.PI / 180;
const baseRot = () => (window.innerWidth <= 991 ? MOB_BASE_ROT_Y : BASE_ROT_Y);

try { init(); } catch (e) { /* fallback stays */ }

function init() {
  const canvas = document.getElementById('journeyGL');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  /* warm stage lighting, key from the top-right where the light cone sits */
  scene.add(new THREE.HemisphereLight(0xfff1da, 0x211a12, 1.05));
  const key = new THREE.DirectionalLight(0xffd6a1, 3.3); key.position.set(5, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd6a1, 1.7); rim.position.set(-6, 2, -4); scene.add(rim);
  const front = new THREE.DirectionalLight(0xfff6e6, 0.95); front.position.set(0, 1, 8); scene.add(front);

  const group = new THREE.Group(); scene.add(group);

  /* photo planes — bigger, tilted, arranged on a helix around the centre */
  const texLoader = new THREE.TextureLoader();
  PHOTOS.forEach((src, i) => {
    const tex = texLoader.load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.82, 1.22),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide })
    );
    const a = (i / PHOTOS.length) * Math.PI * 2 - Math.PI / 3;
    const r = 3.4, y = (0.5 - i / (PHOTOS.length - 1)) * 4.2;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r - 0.4);
    m.lookAt(Math.cos(a) * r * 2.2, y * 0.85, Math.sin(a) * r * 2.2);
    m.rotateZ((i % 2 ? -1 : 1) * 0.13);
    group.add(m);
  });

  /* centre subject — the camera model, scaled to ~35% of viewport height,
     narrow enough for the giant stage text to flank it, as in the reference */
  const holder = new THREE.Group(); scene.add(holder);
  let model = null;
  new GLTFLoader().load(MODEL, (gltf) => {
    model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s = 2.0 / (size.y || 1);
    model.scale.setScalar(s);
    model.position.sub(centre.multiplyScalar(s));
    model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    holder.add(model);
    holder.rotation.y = baseRot();
    window.__glReady = true;
    canvas.classList.add('on');
  }, undefined, () => { /* model failed — planes alone do not set __glReady */ });

  function size() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    camera.aspect = w / h;
    camera.position.z = camera.aspect < 1 ? 7.4 / Math.pow(camera.aspect, 0.6) : 7.4;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  (function render() {
    requestAnimationFrame(render);
    if (!window.__courtInView) return;
    const cur = window.__jCur || 0;
    group.rotation.y = cur * Math.PI * 2.4;
    group.position.y = cur * 2.1;
    if (model) {
      holder.rotation.y = baseRot() + cur * Math.PI * 1.6;
      holder.position.y = Math.sin(cur * Math.PI) * 0.18;
    }
    camera.position.x = Math.sin(cur * Math.PI) * 0.35;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  })();
}
