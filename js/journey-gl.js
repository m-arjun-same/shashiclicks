/* Court scene — own code, values from CODEBASE-SPEC Annex B §8.
   The Canon camera GLB takes the sock's exact transform role: it flies
   from the hero card anchor (Bézier) to centre (0, .61, 0) at scale 1.27,
   ringed by 7 photo cards (5 mobile) on a 1.5-turn helix. A constant
   inner offset turns the carrier's rest rotation (π) into the GLB's
   readable +30° three-quarter front — noted delta, geometry unchanged. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
// Spec phase mapper Ge() is defined next to `land` below (Annex B §8.2).

const section = $('#court');
const canvas = $('#courtCanvas');
const vignette = $('.court__vignette');
const lantern = $('.court__lantern');
const caption = $('.court__caption');
const prodCard = $('[data-court-anchor]');
const MODEL_H = 0.30;
const MODEL_YAW0 = Math.PI / 6 - Math.PI; // carrier π → GLB +30° front

let S = null; // settings (recomputed on resize)
function settings() {
  const mobile = innerWidth <= 991.98;
  return {
    mobile,
    sockScale: 1.27, sockY: 0.61, camX: 0, camY: mobile ? 0.84 : 0.66,
    camZ: mobile ? 1.85 : 1.3, lookY: 0.05, exposure: 0.85,
    key: 90.5, frontFill: 0.42, ambient: 0.94, fog: 0.28, vignette: 0.65,
    cardCount: mobile ? 5 : 7, cardScale: mobile ? 0.84 : 0.96,
    perf: false
  };
}

let renderer, scene, camera, carrier, inner, model = null;
let cards = [], headGroup = null, headMats = [];
let spot, spotTarget, hemi, amb, point, rim, frontDir, coneMats = [], poolMat, poolSprite;
let disPts = null, disMat = null;    // hero→court disintegration bridge (§8)
const xrayU = { uXrayK: { value: 0 }, uXrayGap: { value: 0 }, uCell: { value: 0.01 } };
let F = 0, Ro = 0, capP = 0;         // flight / card-ring / caption progress
let land = 0.5, Tt = 1, anchorDt = new THREE.Vector3(0, 2, 3);
const Ge = v => land + (1 - land) * v; // local phase → global progress (spec §8.2)
const Te = (m, k) => { const s = Math.sin((m + 1) * (12.9898 + k * 7.233)) * 43758.5453; return (s - Math.floor(s)) - 0.5; }; // spec per-card pseudo-random (§8.5)
let introK = 0, introStart = 0, started = false, failed = false;
let inView = false, lastTs = 0, idleT = 0;

function un() {
  failed = true;
  if (section) section.classList.add('is-static');
  if (caption) caption.style.opacity = 1;
}

function coverAnchor() {
  // Framing camera Ut looks at origin from (0.1, camY, camZ); anchor = ray
  // through the hero card's NDC at distance 3.4 (Annex B §8.3).
  const st = S;
  const ut = new THREE.Vector3(0.1, 0.78, st.camZ);
  let nx, ny;
  if (st.mobile || !prodCard) {
    const cx = innerWidth * 0.34 + innerWidth * 0.44 / 2;
    nx = (cx / innerWidth) * 2 - 1;
    ny = 1 - ((-innerHeight * 0.55 + innerHeight * 0.28 / 2) / innerHeight) * 2;
    if (!prodCard) { nx = 0.6; ny = -0.6; }
  } else {
    const r = prodCard.getBoundingClientRect();
    nx = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
    ny = 1 - ((r.top + r.height * 0.4) / innerHeight) * 2;
  }
  const fovR = 42 * Math.PI / 180;
  const dir = new THREE.Vector3(nx * Math.tan(fovR / 2) * (innerWidth / innerHeight), ny * Math.tan(fovR / 2), -1).normalize();
  anchorDt.copy(ut).addScaledVector(dir, 3.4);
  const vh = innerHeight, courtH = section.offsetHeight || vh * 2;
  land = clamp(vh / courtH, 0.1, 0.75);
  const anchorH = prodCard ? prodCard.offsetHeight : vh * 0.19;
  Tt = (anchorH * 0.52 / vh) * (2 * 3.4 * Math.tan(fovR / 2)) / MODEL_H;
  Tt = clamp(Math.abs(Tt), 0.05, 3);
}

/* Disintegration bridge (spec Annex B §8): 3000 points sampled from the
   largest mesh's surface + an x-ray grid discard on the model's own
   materials. He (driven in frame()) scatters the points (uDis = He*.18)
   while matching grid cells dissolve on the mesh (uXrayK = min(1,He*1.6),
   uXrayGap = He*.55) — the object dissolves into its own dust mid-flight
   and re-forms as it lands at the court centre. */
function buildDisintegration(holderEl) {
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  let best = null;
  model.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
    let area = 0;
    for (let i = 0; i < triCount; i++) {
      const i0 = idx ? idx.getX(i * 3) : i * 3, i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
      e1.subVectors(vb, va); e2.subVectors(vc, va);
      area += e1.cross(e2).length() * 0.5;
    }
    if (!best || area > best.area) best = { mesh: o, area, triCount };
  });
  if (!best) return;
  const mesh = best.mesh, geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index;
  const triCount = best.triCount;
  const cum = new Float32Array(triCount);
  let total = 0;
  for (let i = 0; i < triCount; i++) {
    const i0 = idx ? idx.getX(i * 3) : i * 3, i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
    va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
    e1.subVectors(vb, va); e2.subVectors(vc, va);
    total += e1.cross(e2).length() * 0.5;
    cum[i] = total;
  }
  if (!total) return;
  // transform chain: mesh local → holder local (includes the model's
  // normalisation scale / offset / rotation)
  const chain = new THREE.Matrix4();
  const mats = [];
  let node = mesh;
  while (node && node !== holderEl) { node.updateMatrix(); mats.push(node.matrix); node = node.parent; }
  for (let i = mats.length - 1; i >= 0; i--) chain.multiply(mats[i]);
  const COUNT = 3000;
  const positions = new Float32Array(COUNT * 3);
  const rands = new Float32Array(COUNT * 4);
  const P = new THREE.Vector3();
  for (let n = 0; n < COUNT; n++) {
    const r = Math.random() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const i0 = idx ? idx.getX(lo * 3) : lo * 3, i1 = idx ? idx.getX(lo * 3 + 1) : lo * 3 + 1, i2 = idx ? idx.getX(lo * 3 + 2) : lo * 3 + 2;
    va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    P.copy(va).addScaledVector(e1.subVectors(vb, va), u).addScaledVector(e2.subVectors(vc, va), v);
    P.applyMatrix4(chain);
    positions[n * 3] = P.x; positions[n * 3 + 1] = P.y; positions[n * 3 + 2] = P.z;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    rands[n * 4] = Math.sin(ph) * Math.cos(th);
    rands[n * 4 + 1] = Math.cos(ph);
    rands[n * 4 + 2] = Math.sin(ph) * Math.sin(th);
    rands[n * 4 + 3] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(rands, 4));
  disMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uDis: { value: 0 }, uHe: { value: 0 }, uWorldK: { value: 1 }, uScaleH: { value: 1000 } },
    vertexShader: [
      'attribute vec4 aRand;',
      'uniform float uDis; uniform float uWorldK; uniform float uScaleH;',
      'varying float vPh;',
      'void main(){',
      ' vPh = aRand.w;',
      ' vec3 p = position + aRand.xyz * (uDis * (0.35 + aRand.w));',
      ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      ' float sz = mix(0.0035, 0.0085, aRand.w) * uWorldK;',
      ' gl_PointSize = sz * uScaleH / max(0.1, -mv.z);',
      ' gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uHe;',
      'varying float vPh;',
      'void main(){',
      ' vec3 col = mix(vec3(0.93, 0.85, 0.66), vec3(1.0, 0.96, 0.84), vPh);',
      ' gl_FragColor = vec4(col, uHe * (0.5 + 0.5 * vPh));',
      '}'
    ].join('\n')
  });
  disPts = new THREE.Points(g, disMat);
  disPts.frustumCulled = false;
  disPts.visible = false;
  holderEl.add(disPts);
  if (renderer) disMat.uniforms.uScaleH.value = renderer.domElement.height / (2 * Math.tan(42 * Math.PI / 360));
  // x-ray grid discard + gold grid tint on the model's own materials
  geo.computeBoundingBox();
  const gh = geo.boundingBox ? geo.boundingBox.getSize(new THREE.Vector3()).y : 0;
  if (gh) xrayU.uCell.value = gh / 22;
  const patched = new Set();
  model.traverse(o => {
    if (!o.isMesh || !o.material || patched.has(o.material)) return;
    patched.add(o.material);
    const mat = o.material;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uXrayK = xrayU.uXrayK;
      sh.uniforms.uXrayGap = xrayU.uXrayGap;
      sh.uniforms.uCell = xrayU.uCell;
      sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObjPos = position;');
      sh.fragmentShader = ('uniform float uXrayK;\nuniform float uXrayGap;\nuniform float uCell;\nvarying vec3 vObjPos;\n' + sh.fragmentShader)
        .replace('#include <clipping_planes_fragment>', [
          '#include <clipping_planes_fragment>',
          ' vec3 xgPos = vObjPos / max(uCell, 0.0001);',
          ' vec3 xgCell = floor(xgPos);',
          ' float xgHash = fract(sin(dot(xgCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);',
          ' if (uXrayK > 0.001 && xgHash < uXrayK * 0.85) discard;'
        ].join('\n'))
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          ' if (uXrayK > 0.001) {',
          '   vec3 xgF = abs(fract(xgPos) - 0.5);',
          '   float xgEdge = smoothstep(0.40, 0.5, max(xgF.x, max(xgF.y, xgF.z)));',
          '   diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.80, 0.50), xgEdge * uXrayK * 0.9);',
          ' }'
        ].join('\n'));
    };
    mat.customProgramCacheKey = () => 'xray-grid-1';
    mat.needsUpdate = true;
  });
}

function makeHeadTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  const FIN = [246, 240, 226], TER = [201, 111, 74], UNR = [139, 125, 107];
  const draw = p => {
    x.clearRect(0, 0, 1024, 256);
    x.font = '900 190px "FK Screamer", Impact, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(text).width;
    const b = clamp01(p / 100);
    // Spec HEAD shader (Annex B §8): u = (x + 2.5*(1-b)) / 3.5 across the
    // text span; gradient stops final 0–30%, terra edge 40%, unread 50–100%.
    const g = x.createLinearGradient(512 - w / 2, 0, 512 + w / 2, 0);
    const mixC = (A, B, t, a) => 'rgba(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ',' + a.toFixed(3) + ')';
    const colAt = u => {
      if (u <= 0.30) return mixC(FIN, FIN, 0, 1);
      if (u < 0.40) return mixC(FIN, TER, (u - 0.30) / 0.10, 1);
      if (u < 0.50) { const t = (u - 0.40) / 0.10; return mixC(TER, UNR, t, 1 - 0.78 * t); }
      return mixC(UNR, UNR, 0, 0.22);
    };
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const xn = i / N;
      g.addColorStop(xn, colAt((xn + 2.5 * (1 - b)) / 3.5));
    }
    x.fillStyle = g;
    x.fillText(text, 512, 138);
    // Beam bake (spec HEAD: ambient .78 + beamGain .85 * beam²) — the light
    // shaft from top-right lifts the letters it crosses toward white and
    // leaves the rest at ambient, so the filled line keeps reading as
    // beam-lit (diagonal band, bright top-right → dim bottom-left) after
    // the sweep completes, as in the reference's court frames.
    x.globalCompositeOperation = 'source-atop';
    const bg = x.createLinearGradient(900, 0, 340, 256);
    bg.addColorStop(0, 'rgba(255,244,214,0.52)');
    bg.addColorStop(0.42, 'rgba(255,244,214,0.12)');
    bg.addColorStop(0.68, 'rgba(12,10,8,0.18)');
    bg.addColorStop(1, 'rgba(12,10,8,0.27)');
    x.fillStyle = bg;
    x.fillRect(0, 0, 1024, 256);
    const rg = x.createRadialGradient(740, 6, 40, 740, 6, 720);
    rg.addColorStop(0, 'rgba(255,242,208,0.35)');
    rg.addColorStop(0.55, 'rgba(255,242,208,0.10)');
    rg.addColorStop(1, 'rgba(255,242,208,0)');
    x.fillStyle = rg;
    x.fillRect(0, 0, 1024, 256);
    x.globalCompositeOperation = 'source-over';
  };
  draw(0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, draw, canvas: c };
}

function init() {
  if (!section || !canvas) return;
  S = settings();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { un(); return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, S.mobile ? 1.25 : 1.5));

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0E0C09, 0);
  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 40);

  // ---- lights (Annex B §8.4) ----
  spot = new THREE.SpotLight(0xEFD5A2, 0, 0, 0.3, 0.9, 1.45);
  spot.position.set(2.24, 4.8, -1.04);
  spotTarget = new THREE.Object3D(); spotTarget.position.set(-0.3, 0, -0.75);
  scene.add(spotTarget); spot.target = spotTarget; scene.add(spot);
  hemi = new THREE.HemisphereLight(0x2A2620, 0x5E594E, 0.02); scene.add(hemi);
  amb = new THREE.AmbientLight(0xffffff, 0); scene.add(amb);
  point = new THREE.PointLight(0xC9B389, 0, 3.2, 1.9); point.position.set(0, 0.14, 0.55); scene.add(point);
  rim = new THREE.DirectionalLight(0xDCBE85, 1.5); rim.position.set(2.3, 2.6, -2.5); scene.add(rim);
  frontDir = new THREE.DirectionalLight(0xFFE0BC, 2.4); frontDir.position.set(-1.4, 2.2, 2.6); scene.add(frontDir);
  const frontFill = new THREE.DirectionalLight(0xffffff, 0); frontFill.position.set(0, 0.4, 3); scene.add(frontFill);
  scene.userData.frontFill = frontFill;

  // ---- light cone: 3 open cylinders + pool glow + fan (Annex B §8.5) ----
  const coneRig = new THREE.Group();
  coneRig.position.set(-0.3, 0.02, -0.75);
  const up = new THREE.Vector3(0, 1, 0);
  const dirv = new THREE.Vector3(2.24 - -0.3, 4.8 - 0.02, -1.04 - -0.75).normalize();
  coneRig.quaternion.setFromUnitVectors(up, dirv);
  scene.add(coneRig);
  const coneDefs = [
    { rt: 0.12, rb: 0.44, seg: 72, i: 1.4, core: 2.2, ray: 0.75 },
    { rt: 0.07, rb: 0.25, seg: 48, i: 1.55, core: 2.8, ray: 0.9 },
    { rt: 0.3, rb: 1.0, seg: 72, i: 0.3, core: 1.25, ray: 0.45 }
  ];
  coneDefs.forEach(d => {
    const g = new THREE.CylinderGeometry(d.rt, d.rb, 5.55, d.seg, 1, true);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uK: { value: 0 }, uInt: { value: d.i }, uCore: { value: d.core }, uRay: { value: d.ray }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vPos; void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uK; uniform float uInt; uniform float uCore; uniform float uRay; uniform float uTime;',
        'varying vec2 vUv; varying vec3 vPos;',
        'void main(){',
        ' float vert = pow(vUv.y, 1.4);',
        ' float ang = atan(vPos.z, vPos.x);',
        ' float rays = 0.75 + 0.25 * sin(ang * 9.0 + uTime * 0.35) * uRay;',
        ' float core = pow(abs(sin(vUv.x * 3.14159)), uCore);',
        ' float a = uK * uInt * 0.16 * vert * rays * (0.35 + 0.65 * core);',
        ' gl_FragColor = vec4(vec3(0.906, 0.784, 0.557) * a, a);',
        '}'
      ].join('\n')
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = 2.775;
    coneRig.add(mesh);
    coneMats.push(m);
  });
  const poolC = document.createElement('canvas'); poolC.width = poolC.height = 256;
  const px = poolC.getContext('2d');
  const pg = px.createRadialGradient(128, 128, 0, 128, 128, 128);
  pg.addColorStop(0, 'rgba(231,200,142,0.85)'); pg.addColorStop(0.5, 'rgba(231,200,142,0.25)'); pg.addColorStop(1, 'rgba(231,200,142,0)');
  px.fillStyle = pg; px.fillRect(0, 0, 256, 256);
  const poolTex = new THREE.CanvasTexture(poolC);
  poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  poolSprite = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), poolMat);
  poolSprite.rotation.x = -Math.PI / 2;
  poolSprite.position.set(-0.3, 0.02, -0.75);
  scene.add(poolSprite);
  const fanMat = new THREE.MeshBasicMaterial({ color: 0xE7C88E, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const fan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5.2), fanMat);
  fan.position.set(-0.3, 2.4, -0.75);
  fan.rotation.x = 0.42;
  scene.add(fan);
  scene.userData.fanMat = fanMat;

  // ---- carrier + camera model (the sock's role) ----
  carrier = new THREE.Group(); scene.add(carrier);
  inner = new THREE.Group(); carrier.add(inner);
  const holder = new THREE.Group(); inner.add(holder);
  new GLTFLoader().load('assets/models/camera.glb', gltf => {
    model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const s = MODEL_H / (size.y || 1);
    model.scale.setScalar(s);
    model.position.sub(centre.multiplyScalar(s));
    model.rotation.y = MODEL_YAW0;
    model.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    holder.add(model);
    try { buildDisintegration(holder); } catch (e) { /* dust bridge is an enhancement */ }
  }, undefined, () => { /* model failed: cards + headline still carry the scene */ });

  // ---- helix cards ----
  const texLoader = new THREE.TextureLoader();
  const cardTex = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'].map(n => {
    const t = texLoader.load('assets/img/' + n + '.webp');
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xE6DCCB, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3333), mat);
    mesh.visible = false;
    scene.add(mesh);
    cards.push({ mesh, mat, tex: cardTex[i], tinted: false, eo: new THREE.Vector3(Te(i, 0) * 0.26, Te(i, 1) * 0.22, Te(i, 2) * 0.26) });
  }
  coverAnchor();
  buildHead();
  bindScroll();
  window.__courtReady = true;
  addEventListener('shashi-reveal', () => { coverAnchor(); size(); });
  size();
  addEventListener('resize', () => { S = settings(); coverAnchor(); size(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildHead());
  new IntersectionObserver(en => { inView = en[0].isIntersecting; }, { threshold: 0 }).observe(section);
  started = true;
  lastTs = performance.now();
  requestAnimationFrame(frame);
}

function buildHead() {
  if (headGroup) { scene.remove(headGroup); headMats = []; }
  headGroup = new THREE.Group();
  const vFov = 42 * Math.PI / 180;
  const frustumH = 2 * Math.tan(vFov / 2) * 5;
  const frustumW = frustumH * (innerWidth / innerHeight);
  const lineW = frustumW * 0.46;
  ['We Create', 'Memories.'].forEach((txt, i) => {
    const h = makeHeadTexture(txt);
    const m = new THREE.MeshBasicMaterial({ map: h.tex, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(lineW, lineW * 0.25), m);
    plane.position.y = i === 0 ? 0.27 : -0.27;
    headGroup.add(plane);
    headMats.push({ mat: m, draw: h.draw, tex: h.tex, plane });
  });
  headGroup.position.set(0, S.sockY + 0.05, -5 + 0.001);
  headGroup.visible = false;
  scene.add(headGroup);
}

function bindScroll() {
  const st = window.gsap && window.ScrollTrigger;
  if (!st) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top', scrub: true,
    // Spec §8.2: Ro.p is a fromTo 0 → 1 + vh/courtHeight, not a clamped 0–1.
    onUpdate: self => { Ro = self.progress * (1 + innerHeight / Math.max(1, section.offsetHeight)); }
  });
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: 0.6,
    onUpdate: self => { F = self.progress; }
  });
  ScrollTrigger.create({
    trigger: section, start: 'top top', once: true,
    onEnter: () => revealHead()
  });
  ScrollTrigger.create({
    trigger: caption, start: 'top 28%', end: 'top 40%', scrub: true,
    onUpdate: self => { capP = self.progress; }
  });
}
let headRevealed = false;
function revealHead() {
  if (headRevealed || !headGroup) return;
  headRevealed = true;
  headGroup.visible = true;
  headMats.forEach((h, i) => {
    gsap.to(h.mat, { opacity: 1, duration: 0.9, delay: i * 0.12, ease: 'power2.out' });
    const o = { p: 0 };
    gsap.to(o, { p: 100, duration: 1.4, delay: 0.35 + i * 0.12, ease: 'power1.inOut', onUpdate: () => { h.draw(o.p); h.tex.needsUpdate = true; h.lastP = o.p; } });
  });
}

function size() {
  if (!renderer) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (disMat) disMat.uniforms.uScaleH.value = renderer.domElement.height / (2 * Math.tan(42 * Math.PI / 360));
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (!started || failed) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (!inView && F === 0) { /* still render hero-adjacent flight start */ }
  idleT += dt;
  // intro scale-in (from the reveal event)
  if (window.__shashiRevealed && !introStart) introStart = ts;
  if (introStart) {
    const k = clamp01((ts - introStart) / 1700);
    const e = 1 - Math.pow(1 - k, 3);
    introK = e * (1 + 0.4 * Math.sin(k * Math.PI) * (1 - k)); // back.out(1.4)-ish
    introK = clamp(introK, 0, 1.12);
  }
  const st = S;
  const V = sstep(0.02, 0.1, F), K = Math.pow(sstep(0.06, 0.2, F), 2);
  // the flight starts while the hero is still exiting (fp 0 at F = land*.45)
  // so the dissolve at the card and the whole travel stay in frame — with
  // land = .5 on this 200vh court, a land-gated flight spent its first
  // half parked off-screen right (measured NDC x 1.1–1.4)
  const flightP = clamp01((F - land * 0.45) / (1 - land * 0.45));
  const ie2 = flightP * flightP * (3 - 2 * flightP);
  // ---- carrier flight (Bézier anchor → centre) ----
  const p0 = anchorDt;
  const p1 = new THREE.Vector3(p0.x * 0.42, Math.max(p0.y + 0.35, 1.15), p0.z * 0.42 + 0.25);
  const p2 = new THREE.Vector3(0, st.sockY, 0);
  const a = p0.clone().lerp(p1, ie2), b = p1.clone().lerp(p2, ie2);
  carrier.position.copy(a.lerp(b, ie2));
  const sc = lerp(Tt, st.sockScale, ie2) * Math.max(introK, 0.0001);
  carrier.scale.setScalar(Math.max(sc, 0.0001));
  // ---- disintegration bridge: He rises over the flight's first third
  // (object dissolves into its surface dust), falls as it lands (§8) ----
  // He fitted to the carrier's measured screen path (NDC x: 1.10 at F=.30,
  // 0.98 at fp=.41, 0.64 at fp=.56, 0.27 at fp=.74): the flight component
  // peaks while the cloud crosses mid-frame; the park component gives the
  // brief dissolve on the object in the card as the hero exit begins
  const HeF = sstep(0.30, 0.48, flightP) * (1 - sstep(0.58, 0.74, flightP));
  const HeP = sstep(0.03, 0.09, F) * (1 - sstep(0.13, 0.22, F));
  const He = Math.max(HeF, HeP * 0.85);
  if (disMat) {
    disMat.uniforms.uDis.value = He * 0.18;
    disMat.uniforms.uHe.value = He;
    disMat.uniforms.uWorldK.value = carrier.scale.x / st.sockScale;
    if (disPts) disPts.visible = He > 0.01;
  }
  xrayU.uXrayK.value = Math.min(1, He * 1.6);
  xrayU.uXrayGap.value = He * 0.55;
  const l = flightP;
  const idleF = clamp01((idleT - 2) / 3);
  const yaw = (-2 + 26 * sstep(0.4, 1, l) + Math.sin(idleT * 0.7) * 4 * idleF * (F > 0.02 ? 1 : 0)) * Math.PI / 180;
  carrier.rotation.y = lerp(0.5, Math.PI, ie2) + yaw;
  inner.position.x = lerp(0.16, 0.05, ie2);
  inner.position.z = lerp(0.05, 0.14, ie2);
  // ---- camera: scrub (.7,.25) → (camX, camY); before landing it eases
  // from the anchor-framing camera Ut (.1, .78, camZ) by smoothstep ----
  const drop = sstep(0.36, 1, F) * 0.08;
  let cxp = lerp(0.7, st.camX, F), cyp = lerp(0.25, st.camY, F);
  if (F < land) {
    const s2 = sstep(0.45, 1, clamp01(F / Math.max(land, 0.001)));
    cxp = lerp(0.1, cxp, s2); cyp = lerp(0.78, cyp, s2);
  }
  camera.position.set(cxp, cyp, st.camZ + drop);
  camera.lookAt(0, st.sockY + st.lookY, 0);
  // ---- lights ----
  spot.intensity = st.key * V;
  spot.angle = 0.11 + 0.1 * K;
  spot.penumbra = 0.35 + 0.4 * K;
  hemi.intensity = 0.02 * V + 0.06 * K;
  amb.intensity = st.ambient * V;
  point.intensity = 0.39 * V;
  rim.intensity = 1.5 + (6.86 - 1.5) * V;
  frontDir.intensity = 2.4 * (1 - V);
  scene.userData.frontFill.intensity = st.frontFill * V;
  renderer.toneMappingExposure = lerp(0.95, st.exposure, V);
  if (scene.fog) scene.fog.density = st.fog * K;
  coneMats.forEach(m => { m.uniforms.uK.value = V; m.uniforms.uTime.value = idleT; });
  poolMat.opacity = V;
  const poolK = 0.32 + 0.68 * K;
  poolSprite.scale.set(poolK * 0.95, poolK * 0.48, 1);
  scene.userData.fanMat.opacity = 0.10 * V;
  // ---- cards on the helix ----
  const count = st.cardCount;
  const Me = Math.max(0, (Ro - land) / Math.max(0.05, 1 - land));
  const Kt = sstep(land, Ge(0.05), F);
  cards.forEach((c, i) => {
    if (i >= count) { c.mesh.visible = false; return; }
    if (!c.tinted && c.tex.image) { c.mat.map = c.tex; c.tinted = true; c.mat.needsUpdate = true; } // colour stays spec 0xE6DCCB
    const phase = ((i / count) + Me) % 1;
    const yH = -0.28 + phase * 1.59;
    const ang = -Math.PI / 4 - phase * Math.PI * 3;
    const flareK = 1 - 0.1 * (yH + 0.28);
    const hx = Math.cos(ang) * 0.59 * flareK;
    const hz = Math.sin(ang) * 0.49 * flareK - 0.05;
    const D0 = 0.07 + (i / count) * 0.2;
    const birth = sstep(Ge(D0), Ge(D0 + 0.1), F);
    let ct = Kt * birth * sstep(0, 0.1, phase) * (1 - sstep(0.84, 1, phase));
    const centre = carrier.position.clone();
    centre.y += 0.3 * lerp(Tt, st.sockScale, ie2);
    // Helix span (-.28…1.31, midpoint ≈ .5) is centred on the model so the
    // ring distributes above AND below centre instead of stacking overhead.
    const helix = new THREE.Vector3(hx, yH - 0.5, hz);
    const He = 1 - (1 - birth) * (1 - birth);
    c.mesh.position.copy(centre).addScaledVector(c.eo, 1 - He).addScaledVector(helix, He);
    c.mesh.scale.setScalar(Math.max(st.cardScale * ct, 0.0001));
    c.mesh.visible = ct > 0.01;
    if (c.mesh.visible) {
      const p = c.mesh.position;
      c.mesh.lookAt(p.x * 2, p.y, (p.z + 0.05) * 2 - 0.05);
    }
  });
  // ---- HEAD headline planes: 5 units in front of the camera ----
  if (headGroup) {
    const fwd = new THREE.Vector3(0, st.sockY + st.lookY, 0).sub(camera.position).normalize();
    headGroup.position.copy(camera.position).addScaledVector(fwd, 5);
    headGroup.quaternion.copy(camera.quaternion);
  }
  // ---- DOM companions ----
  if (vignette) vignette.style.opacity = String(sstep(0.18, 0.3, F) * st.vignette);
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (lantern) lantern.style.opacity = String(fine ? 0.08 * Math.max(V, capP * 0.5) : 0);
  if (caption) {
    caption.style.opacity = String(capP);
    caption.style.transform = 'translateY(' + ((1 - capP) * 4) + 'vh)';
  }
  const sr = section.getBoundingClientRect();
  canvas.style.opacity = (sr.bottom > 0 && sr.top < innerHeight * 1.05) ? 1 : 0;
  renderer.render(scene, camera);
}

try { init(); } catch (e) { un(); }
