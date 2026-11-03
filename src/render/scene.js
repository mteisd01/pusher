import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { L } from '../core/layout.js';
import { makeFieldTexture, makeSurfaceTexture } from './textures.js';

let W = L.halfW;
export const SCREEN = { w: 14, h: 7, y: 8.9, z: L.backWallZ - 1.15 };

export const CAMERA_PRESETS = {
  standard: { elev: 46, look: [0, 1.2, -1.2] },
  high: { elev: 62, look: [0, 0.5, -0.5] },
  low: { elev: 30, look: [0, 2.2, -2.5] },
  top: { elev: 80, look: [0, 0, -1] },
  field: { elev: 40, look: [0, 0.5, 1.5], fieldOnly: true },
};

export class Stage {
  constructor(canvas, settings) {
    W = L.halfW;
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias !== false, powerPreference: 'high-performance', alpha: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 200);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envMap = null;
    this.shake = 0;
    this.camOffset = new THREE.Vector3();
    this.userZoom = 0; this.userTilt = 0; this.userPan = 0;
    this.time = 0;
    this.cabinet = new THREE.Group();
    this.scene.add(this.cabinet);
    this._lights();
    this._dynamic();
  }

  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x221111, 0.35);
    s.add(this.hemi);
    const key = this.key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(5, 26, 14);
    key.target.position.set(0, 0, -2);
    key.castShadow = true;
    const sc = key.shadow.camera;
    sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 5; sc.far = 60;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    s.add(key, key.target);
    this.sideLights = [];
    for (const sx of [-1, 1]) {
      const pl = new THREE.PointLight(0xffffff, 10, 24, 2);
      pl.position.set(sx * (W - 2), 4.5, 0);
      s.add(pl);
      this.sideLights.push(pl);
    }
    this.frontLight = new THREE.PointLight(0xffffff, 0, 18, 2);
    this.frontLight.position.set(0, 2, L.frontZ + 2);
    s.add(this.frontLight);
  }

  _dynamic() {
    const s = this.scene;
    // Pusher
    this.pusherMat = new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.9, roughness: 0.28 });
    this.pusherTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.38 });
    const pg = new THREE.BoxGeometry(W * 2 - 0.04, L.pusherH, L.pusherLen);
    this.pusher = new THREE.Mesh(pg, [this.pusherMat, this.pusherMat, this.pusherTopMat, this.pusherMat, this.pusherMat, this.pusherMat]);
    this.pusher.receiveShadow = true; this.pusher.castShadow = true;
    s.add(this.pusher);
    this.pusherLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const led = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - 0.3, 0.12, 0.04), this.pusherLedMat);
    led.position.set(0, L.pusherH * 0.5 - 0.12, L.pusherLen / 2 + 0.01);
    this.pusher.add(led);
    // Guard walls
    this.guardMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2299ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.2 });
    this.guards = [-1, 1].map(sx => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, L.frontZ - L.sideWallEnd), this.guardMat);
      m.position.set(sx * (W + 0.15), -4, (L.frontZ + L.sideWallEnd) / 2);
      s.add(m);
      return m;
    });
    // Launcher (chute nozzle) + aim beam
    this.launcher = new THREE.Group();
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 1, roughness: 0.15 });
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.42, 0.9, 24, 1, true), chrome);
    funnel.material.side = THREE.DoubleSide;
    funnel.position.y = 0.35;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 10, 28), chrome);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.8;
    this.launcherGlow = new THREE.MeshBasicMaterial({ color: 0xffd040, toneMapped: false });
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 24), this.launcherGlow);
    tip.rotation.x = Math.PI / 2; tip.position.y = -0.1;
    this.launcher.add(funnel, ring, tip);
    this.launcher.position.set(0, L.dropY + 0.2, L.dropZ);
    s.add(this.launcher);
    const beamMat = this.beamMat = new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, L.dropY - L.pusherH, 8, 1, true), beamMat);
    this.beam.position.set(0, (L.dropY + L.pusherH) / 2, L.dropZ);
    s.add(this.beam);
    // Rail
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, W * 2, 12), chrome);
    rail.rotation.z = Math.PI / 2; rail.position.set(0, L.dropY + 1.15, L.dropZ - 0.3);
    s.add(rail);
    // Gate (slot checker)
    this.gate = new THREE.Group();
    this.gateMat = new THREE.MeshBasicMaterial({ color: 0x40ffb0, toneMapped: false });
    this.gateCurtainMat = new THREE.MeshBasicMaterial({ color: 0x40ffb0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.gatePosts = [];
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 12), this.gateMat);
      post.position.set(sx, 0, 0);
      this.gate.add(post); this.gatePosts.push(post);
    }
    this.gateBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.14, 0.14), this.gateMat);
    this.gateBar.position.y = 0.7; this.gate.add(this.gateBar);
    this.gateCurtain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4), this.gateCurtainMat);
    this.gate.add(this.gateCurtain);
    this.gate.position.set(0, L.gateY, L.dropZ);
    s.add(this.gate);
    // Marquee bulbs around the screen
    const bulbs = [];
    const bw = SCREEN.w / 2 + 0.55, bh = SCREEN.h / 2 + 0.55;
    const per = 0.62;
    for (let x = -bw; x <= bw + 1e-3; x += per) { bulbs.push([x, SCREEN.y + bh]); bulbs.push([x, SCREEN.y - bh]); }
    for (let y = -bh + per; y < bh - 1e-3; y += per) { bulbs.push([-bw, SCREEN.y + y]); bulbs.push([bw, SCREEN.y + y]); }
    bulbs.sort((a, b) => Math.atan2(a[1] - SCREEN.y, a[0]) - Math.atan2(b[1] - SCREEN.y, b[0]));
    this.bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbs.length);
    const m = new THREE.Matrix4();
    bulbs.forEach((b, i) => { m.makeTranslation(b[0], b[1], SCREEN.z + 0.2); this.bulbMesh.setMatrixAt(i, m); this.bulbMesh.setColorAt(i, new THREE.Color(1, 1, 1)); });
    s.add(this.bulbMesh);
    // LED strips (along side wall tops & front lip)
    this.ledMats = [];
    this.ledStrips = new THREE.Group();
    s.add(this.ledStrips);
  }

  // Build the static cabinet for a theme
  setTheme(theme) {
    this.theme = theme;
    const g = this.cabinet;
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    g.clear();
    this.ledStrips.clear();
    this.ledMats = [];
    this.scene.background = makeGradientBg(theme.bgTop, theme.bgBottom);
    if (this.envMap) this.envMap.dispose();
    this.envMap = this.pmrem.fromScene(makeEnvScene(theme), 0.03).texture;
    this.scene.environment = this.settings.reflections === false ? null : this.envMap;
    this.scene.fog = new THREE.Fog(theme.fog, 45, 110);
    this.hemi.color.set(theme.light);
    this.key.color.set(theme.light);
    this.pusherMat.color.set(theme.pusher);
    const plate = makeSurfaceTexture('plate', '#9aa0a8', '#5a6068', 256, 3);
    plate.repeat.set(8, 4);
    this.pusherTopMat.map = plate; this.pusherTopMat.color.set(theme.pusher); this.pusherTopMat.needsUpdate = true;
    // Field floor
    const ftex = makeFieldTexture(theme, W);
    const floorMat = new THREE.MeshStandardMaterial({ map: ftex, metalness: 0.55, roughness: 0.42 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, L.frontZ - L.backWallZ), floorMat);
    fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, (L.frontZ + L.backWallZ) / 2);
    fl.receiveShadow = true;
    g.add(fl);
    // Front lip
    const chrome = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, metalness: 1, roughness: 0.12 });
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, W * 2 + 0.2, 16), chrome);
    lip.rotation.z = Math.PI / 2; lip.position.set(0, -0.1, L.frontZ + 0.02);
    g.add(lip);
    // Payout chute (dark pit with glow)
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const pit = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 6, 0.2, 4), pitMat);
    pit.position.set(0, -3, L.frontZ + 2); g.add(pit);
    this.payoutGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.accent), toneMapped: false, transparent: true, opacity: 0.6 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 0.15), this.payoutGlowMat);
    glow.position.set(0, -0.32, L.frontZ + 0.05); g.add(glow);
    // Front panel of the cabinet
    const cabTex = makeSurfaceTexture(theme.cabinetKind, theme.cabinet, theme.trim, 512, 9);
    cabTex.repeat.set(4, 1);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: cabTex, metalness: 0.2, roughness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: theme.trim, metalness: 1, roughness: 0.25 });
    const front = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 7, 4, 0.6), cabMat);
    front.position.set(0, -2.6, L.frontZ + 3.4); g.add(front);
    const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 7, 0.25, 0.7), trimMat);
    frontTrim.position.set(0, -0.55, L.frontZ + 3.4); g.add(frontTrim);
    // Cabinet sides (beyond gutters)
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9, L.frontZ - L.backZ + 5), cabMat);
      side.position.set(sx * (W + 2.3), 0.2, (L.frontZ + L.backZ) / 2 + 2);
      side.receiveShadow = true;
      g.add(side);
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, L.frontZ - L.backZ + 5), trimMat);
      st.position.set(sx * (W + 2.3), 4.75, (L.frontZ + L.backZ) / 2 + 2); g.add(st);
      // gutter pit (lost zone) — red glow
      const gm = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.55, toneMapped: false });
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, L.frontZ - L.sideWallEnd), gm);
      gp.rotation.x = -Math.PI / 2; gp.position.set(sx * (W + 0.55), -1.2, (L.frontZ + L.sideWallEnd) / 2); g.add(gp);
      // glass side walls
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.4, L.sideWallEnd - L.backWallZ),
        new THREE.MeshPhysicalMaterial({ color: theme.glass, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }));
      glass.position.set(sx * (W + 0.06), 1.7, (L.sideWallEnd + L.backWallZ) / 2); g.add(glass);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, L.sideWallEnd - L.backWallZ), trimMat);
      rail.position.set(sx * (W + 0.08), 3.45, (L.sideWallEnd + L.backWallZ) / 2); g.add(rail);
      // LED strips
      const lm = new THREE.MeshBasicMaterial({ color: theme.led[0], toneMapped: false });
      this.ledMats.push(lm);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, L.sideWallEnd - L.backWallZ), lm);
      strip.position.set(sx * (W + 0.08), 3.57, (L.sideWallEnd + L.backWallZ) / 2); this.ledStrips.add(strip);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, L.sideWallEnd - L.backWallZ), lm);
      strip2.position.set(sx * (W + 0.08), 0.06, (L.sideWallEnd + L.backWallZ) / 2); this.ledStrips.add(strip2);
      // Pillars beside the screen
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 12, 20), trimMat);
      pil.position.set(sx * (W + 1.6), 6, L.backWallZ - 1.5); g.add(pil);
    }
    // Back wall over the pusher (drop zone panel)
    const bwTex = makeSurfaceTexture(theme.cabinetKind, theme.cabinet, theme.trim, 512, 21);
    bwTex.repeat.set(3, 1);
    const bwMat = new THREE.MeshStandardMaterial({ map: bwTex, metalness: 0.25, roughness: 0.5 });
    const bw = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.2, 3.6, 1.0), bwMat);
    bw.position.set(0, L.pusherH + 0.07 + 1.8, L.backWallZ - 0.5); bw.receiveShadow = true; g.add(bw);
    const bwTrim = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.3, 0.2, 1.1), trimMat);
    bwTrim.position.set(0, L.pusherH + 0.12, L.backWallZ - 0.5); g.add(bwTrim);
    const lm2 = new THREE.MeshBasicMaterial({ color: theme.led[1], toneMapped: false });
    this.ledMats.push(lm2);
    const s3 = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.08, 0.06), lm2);
    s3.position.set(0, L.pusherH + 3.6, L.backWallZ + 0.02); this.ledStrips.add(s3);
    // Backboard behind the screen
    const bb = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 3.5, 10, 0.8), cabMat);
    bb.position.set(0, 9.2, SCREEN.z - 0.6); g.add(bb);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w + 1.6, SCREEN.h + 1.6, 0.3), trimMat);
    frame.position.set(0, SCREEN.y, SCREEN.z - 0.05); g.add(frame);
    // Top crest
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 40, 1, false, 0, Math.PI), trimMat);
    crest.rotation.x = Math.PI / 2; crest.rotation.z = Math.PI / 2 * 0; crest.position.set(0, SCREEN.y + SCREEN.h / 2 + 0.8, SCREEN.z - 0.1);
    g.add(crest);
    // floor under everything (room)
    const room = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: theme.bgBottom, roughness: 0.9 }));
    room.rotation.x = -Math.PI / 2; room.position.y = -4.6; g.add(room);
    this.sideLights.forEach((l, i) => l.color.set(theme.led[i % theme.led.length]));
    this.pusherLedMat.color.set(theme.led[0]);
    this.gateMat.color.set(theme.accent);
    this.gateCurtainMat.color.set(theme.accent);
    this.launcherGlow.color.set(theme.accent);
    this.beamMat.color.set(theme.accent);
  }

  addScreen(texture) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ map: texture, color: 0xdddddd }));
    m.position.set(0, SCREEN.y, SCREEN.z + 0.12);
    this.scene.add(m);
    this.screen = m;
  }

  applyQuality(s) {
    this.settings = s;
    const r = this.renderer;
    const dpr = Math.min(window.devicePixelRatio || 1, s.maxDpr || 2);
    r.setPixelRatio(dpr * (s.resScale || 1));
    r.shadowMap.enabled = !!s.shadows;
    this.key.castShadow = !!s.shadows;
    const sz = s.shadowRes || 2048;
    if (this.key.shadow.mapSize.x !== sz) {
      this.key.shadow.mapSize.set(sz, sz);
      if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
    }
    this.scene.environment = s.reflections === false ? null : this.envMap;
    this.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } });
    this.camera.fov = s.fov || 42;
    this.useBloom = !!s.bloom;
    this.resize();
  }

  _composer() {
    if (this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.4, 0.97);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.fitCamera();
  }

  // Place camera so that the whole machine fits the viewport for any aspect ratio
  fitCamera() {
    const preset = CAMERA_PRESETS[this.settings.camera] || CAMERA_PRESETS.standard;
    const elev = THREE.MathUtils.degToRad(Math.min(85, Math.max(15, preset.elev + this.userTilt)));
    const look = new THREE.Vector3(...preset.look);
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    const pts = preset.fieldOnly
      ? [[-W - 0.5, 0, L.frontZ + 0.6], [W + 0.5, 0, L.frontZ + 0.6], [-W, L.pusherH, -7], [W, L.pusherH, -7], [0, 0, L.frontZ + 1.2]]
      : [[-W - 0.8, 0, L.frontZ + 0.7], [W + 0.8, 0, L.frontZ + 0.7], [-W, 0, L.frontZ + 1.4], [-SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 + 0.4, SCREEN.z], [SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 + 0.4, SCREEN.z], [-W - 0.5, L.dropY, L.dropZ], [W + 0.5, L.dropY, L.dropZ]];
    const cam = this.camera;
    const v = new THREE.Vector3();
    const fits = d => {
      cam.position.copy(look).addScaledVector(dir, d);
      cam.lookAt(look);
      cam.updateMatrixWorld(true);
      let ok = true;
      for (const p of pts) {
        v.set(p[0], p[1], p[2]).project(cam);
        if (Math.abs(v.x) > 0.97 || Math.abs(v.y) > 0.95 || v.z > 1) { ok = false; break; }
      }
      return ok;
    };
    // first center vertically: adjust look target so content is balanced
    let lo = 5, hi = 120;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    // re-center: compute projected vertical extent and shift look point
    cam.position.copy(look).addScaledVector(dir, hi); cam.lookAt(look); cam.updateMatrixWorld(true);
    let minY = 1, maxY = -1;
    for (const p of pts) { v.set(p[0], p[1], p[2]).project(cam); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const shift = (minY + maxY) / 2;
    if (Math.abs(shift) > 0.02) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const worldPerNdc = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * hi;
      look.addScaledVector(up, shift * worldPerNdc);
      lo = 5; hi = 120;
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    }
    const dist = hi * Math.pow(0.85, this.userZoom);
    this.baseCam = { pos: look.clone().addScaledVector(dir, dist), look: look.clone() };
    this.baseCam.pos.x += this.userPan; this.baseCam.look.x += this.userPan;
    cam.position.copy(this.baseCam.pos);
    cam.lookAt(this.baseCam.look);
  }

  addShake(a) { if (this.settings.shake !== false) this.shake = Math.min(1.2, this.shake + a); }

  update(dt, st) {
    this.time += dt;
    const t = this.time;
    if (st.pusherZ !== undefined) this.pusher.position.set(0, L.pusherH / 2, st.pusherZ);
    if (st.guardY !== undefined) for (const g of this.guards) g.position.y = st.guardY - 0.2;
    this.guardMat.emissiveIntensity = 1.2 + Math.sin(t * 6) * 0.5;
    // launcher
    this.launcher.position.x += (st.launcherX - this.launcher.position.x) * Math.min(1, dt * 18);
    this.beam.position.x = this.launcher.position.x;
    this.beam.visible = st.showBeam;
    // gate
    this.gate.visible = st.gateOn;
    if (st.gateOn) {
      const hw = st.gateHalf;
      this.gate.position.x = st.gateX;
      this.gatePosts[0].position.x = -hw; this.gatePosts[1].position.x = hw;
      this.gateBar.scale.x = hw * 2; this.gateCurtain.scale.x = hw * 2;
      const fl = st.gateFlash || 0;
      this.gateCurtainMat.opacity = 0.16 + fl * 0.6 + Math.sin(t * 8) * 0.04;
    }
    // LEDs & bulbs
    const th = this.theme;
    const mode = st.lightMode || 'idle';
    const leds = this.settings.leds !== false && !this.settings.reduceMotion;
    const c = new THREE.Color();
    for (let i = 0; i < this.ledMats.length; i++) {
      if (mode === 'fever') c.setHSL((t * 0.5 + i * 0.3) % 1, 1, 0.55);
      else if (mode === 'win') c.set(th.led[Math.floor(t * 10 + i) % th.led.length]);
      else c.set(th.led[i % th.led.length]).multiplyScalar(leds ? 0.75 + 0.25 * Math.sin(t * 2 + i) : 1);
      this.ledMats[i].color.copy(c);
    }
    if (mode === 'fever') this.pusherLedMat.color.setHSL((t * 0.7) % 1, 1, 0.55);
    else this.pusherLedMat.color.set(th.led[0]);
    const n = this.bulbMesh.count;
    for (let i = 0; i < n; i++) {
      let on;
      if (!leds) on = 0.8;
      else if (mode === 'fever') { c.setHSL((i / n + t * 0.8) % 1, 1, 0.6); this.bulbMesh.setColorAt(i, c); continue; }
      else if (mode === 'win') on = Math.floor(t * 12) % 2 === i % 2 ? 1 : 0.15;
      else if (mode === 'spin') on = (Math.floor(t * 16) % 6) === i % 6 ? 1 : 0.25;
      else on = 0.35 + 0.65 * Math.max(0, Math.sin(i * 0.5 - t * 3));
      c.set(th.led[i % 2 ? 1 : 0]).multiplyScalar(on);
      this.bulbMesh.setColorAt(i, c);
    }
    this.bulbMesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < 2; i++) this.sideLights[i].intensity = mode === 'fever' ? 22 + Math.sin(t * 10 + i * 3) * 12 : 8;
    this.frontLight.intensity = Math.max(0, this.frontLight.intensity - dt * 120);
    if (st.payoutFlash) this.frontLight.intensity = Math.min(80, this.frontLight.intensity + st.payoutFlash * 25);
    this.payoutGlowMat.opacity = 0.35 + Math.min(0.65, this.frontLight.intensity / 60);
    // camera shake
    const cam = this.camera;
    if (this.baseCam) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.35;
      cam.position.set(this.baseCam.pos.x + (Math.random() - 0.5) * s, this.baseCam.pos.y + (Math.random() - 0.5) * s, this.baseCam.pos.z);
      cam.lookAt(this.baseCam.look);
    }
  }

  render() {
    if (this.useBloom) { this._composer(); this.composer.render(); }
    else this.renderer.render(this.scene, this.camera);
  }
}

// Dark studio with soft-box lights: gives metals contrasty, realistic reflections
function makeEnvScene(theme) {
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.bgTop).lerp(new THREE.Color('#3a3a44'), 0.6), side: THREE.BackSide }));
  room.position.y = 10; sc.add(room);
  const box = (w, h, x, y, z, color, k, lookY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, lookY, 0); sc.add(m);
  };
  box(34, 12, 0, 22, 2, '#ffffff', 3);          // ceiling softbox
  box(20, 6, 0, 18, -14, '#ffffff', 2.5);       // back-top softbox
  box(10, 4, -14, 14, 14, theme.light, 3);      // key softboxes
  box(10, 4, 14, 14, 14, theme.light, 3);
  box(4, 18, -26, 8, -6, theme.led[0], 2.2);    // colored side strips
  box(4, 18, 26, 8, -6, theme.led[1 % theme.led.length], 2.2);
  box(40, 8, 0, 8, 28, '#ffffff', 1.6);         // front fill
  box(30, 6, 0, 4, -28, theme.accent, 0.8);     // back glow
  return sc;
}

function makeGradientBg(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
