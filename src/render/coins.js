import * as THREE from 'three';
import { L, KIND, TOKEN_COUNT, GIANT, PACK_HEAD } from '../core/layout.js';
import { makeCoinGeometry, makeGemGeometry } from './coinGeometry.js';
import { makeCoinFace, makeCoinEdge, makeTokenFace, makeBallTexture, makeChestTexture } from './textures.js';

export const TOKEN_STYLE = [
  { color: '#2f8cff', icon: 'WALL', label: 'GUARD' },
  { color: '#26c967', icon: '$$', label: 'SHOWER' },
  { color: '#ff7a1a', icon: '>>', label: 'TURBO' },
  { color: '#9b4dff', icon: 'x2', label: 'DOUBLE' },
  { color: '#ff2d6f', icon: '777', label: 'FEVER' },
  { color: '#16c6c6', icon: '+4', label: 'STOCK' },
  { color: '#e0b000', icon: 'PLK', label: 'PLINKO' },
  { color: '#8d6e63', icon: 'D6', label: 'DICE' },
  { color: '#d32f2f', icon: 'MAG', label: 'MAGNET' },
  { color: '#37474f', icon: 'BOM', label: 'BOMB' },
  { color: '#00838f', icon: 'SHK', label: 'SHAKE' },
  { color: '#d81b60', icon: 'CRN', label: 'CRANE' },
  { color: '#5c6bc0', icon: 'FLP', label: 'FLIPPER' },
];
export const GEM_COLORS = ['#ff1744', '#2979ff', '#00e676', '#ffc400', '#d500f9', '#e8f6ff'];

const TRAY_CAP = 240;
const CAP = { [KIND.SILVER]: 1400, [KIND.GOLD]: 500, [KIND.RAINBOW]: 120, [KIND.BIG]: 60, [KIND.BALL]: 16, [KIND.GEM]: 60, [KIND.CHEST]: 30, [KIND.GIANT]: 6 };

export class CoinRenderer {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.meshes = {};
    this.tokenMeshes = [];
    this.build(quality);
  }

  build(quality) {
    for (const m of Object.values(this.meshes)) { this.scene.remove(m); }
    for (const m of this.trayMeshes || []) this.scene.remove(m);
    for (const m of this.tokenMeshes) this.scene.remove(m);
    this.meshes = {}; this.tokenMeshes = [];
    const hi = quality === 'high' || quality === 'ultra';
    const seg = quality === 'ultra' ? 48 : hi ? 36 : quality === 'medium' ? 26 : 18;
    const texSize = quality === 'ultra' ? 1024 : hi ? 512 : 256;
    const edge = makeCoinEdge(110);
    const edgeBig = makeCoinEdge(180);
    const coinGeo = makeCoinGeometry(L.coinR, L.coinHH, 0.035, seg, hi ? 3 : 2);
    const bigGeo = makeCoinGeometry(L.bigCoinR, L.bigCoinHH, 0.05, Math.round(seg * 1.4), hi ? 3 : 2);
    const tokGeo = makeCoinGeometry(0.68, 0.11, 0.04, seg, 2);
    this.faces = {
      silver: makeCoinFace('silver', texSize),
      gold: makeCoinFace('gold', texSize),
      rainbow: makeCoinFace('rainbow', texSize),
      big: makeCoinFace('big', texSize),
      giant: makeCoinFace('giant', 1024),
      token: makeCoinFace('token', 512),
    };
    const metal = (face, color, side, extra = {}) => [
      new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 1, map: face.map, normalMap: face.normalMap, roughnessMap: face.roughnessMap, envMapIntensity: 0.75, ...extra }),
      new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.48, normalMap: side.normalMap, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 0.75, ...extra }),
    ];
    const silverMats = metal(this.faces.silver, '#dfe3e8', edge);
    const goldMats = metal(this.faces.gold, '#ffc84a', edge);
    const rainbowMats = [
      new THREE.MeshPhysicalMaterial({ color: '#f4f4ff', metalness: 1, roughness: 1, map: this.faces.rainbow.map, normalMap: this.faces.rainbow.normalMap, roughnessMap: this.faces.rainbow.roughnessMap, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 900, envMapIntensity: 0.8 }),
      new THREE.MeshPhysicalMaterial({ color: '#f4f4ff', metalness: 1, roughness: 0.36, envMapIntensity: 0.8, normalMap: edge.normalMap, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 900 }),
    ];
    const bigMats = metal(this.faces.big, '#f0c060', edgeBig);
    this._inst(KIND.SILVER, coinGeo, silverMats, hi);
    this._inst(KIND.GOLD, coinGeo, goldMats, hi);
    this._inst(KIND.RAINBOW, coinGeo, rainbowMats, hi);
    this._inst(KIND.BIG, bigGeo, bigMats, true);
    this._inst(KIND.GIANT, makeCoinGeometry(GIANT.r, GIANT.hh, 0.07, 64, 3), metal(this.faces.giant, '#ffd27a', makeCoinEdge(260)), true);
    // Tokens: one mesh per subtype
    for (let i = 0; i < TOKEN_COUNT; i++) {
      const st = TOKEN_STYLE[i];
      const map = makeTokenFace(this.faces.token, st.color, st.icon, st.label);
      const mats = [
        new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.35, map, normalMap: this.faces.token.normalMap, emissive: st.color, emissiveIntensity: 0.18 }),
        new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.3, normalMap: edge.normalMap }),
      ];
      const m = new THREE.InstancedMesh(tokGeo, mats, 12);
      m.count = 0; m.castShadow = true; m.frustumCulled = false;
      this.scene.add(m); this.tokenMeshes.push(m);
    }
    // JP ball
    const ballMat = new THREE.MeshPhysicalMaterial({ map: makeBallTexture(), metalness: 0.85, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    this._inst(KIND.BALL, new THREE.SphereGeometry(0.6, hi ? 40 : 24, hi ? 28 : 16), ballMat, true);
    // Gems
    const gemMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.1, roughness: 0.02, flatShading: true, envMapIntensity: 3, transparent: true, opacity: 0.88, ior: 2.4, specularIntensity: 1, clearcoat: 1, side: THREE.DoubleSide });
    this._inst(KIND.GEM, makeGemGeometry(), gemMat, true);
    // Chest
    const chestTex = makeChestTexture();
    const chestMat = new THREE.MeshStandardMaterial({ map: chestTex, metalness: 0.25, roughness: 0.55 });
    this._inst(KIND.CHEST, new THREE.BoxGeometry(1.1, 0.8, 0.8), chestMat, true);
    this.gemColors = GEM_COLORS.map(c => new THREE.Color(c));
    // payout tray: won medals pile up in front of the player (visual only)
    this.trayMeshes = [silverMats, goldMats].map(mats => {
      const m = new THREE.InstancedMesh(coinGeo, mats, TRAY_CAP);
      m.count = 0; m.frustumCulled = false; m.receiveShadow = true;
      this.scene.add(m); return m;
    });
    for (const m of this.trayMeshes) m.userData.tray = true;
    this.tray = this.tray || [];
    this.trayDirty = true;
  }

  // a medal landed in the payout tray (kind: 0 silver, anything else golden)
  addTray(kind, x) {
    if (!this.trayMeshes) return;
    const T = this.trayDef;
    if (!T) return;
    const tr = this.tray;
    if (this.trayClear > 0) return;
    const n = kind === KIND.SILVER ? 1 : Math.min(4, kind === KIND.GOLD ? 1 : 3);
    for (let k = 0; k < n; k++) {
      const px = Math.max(-T.hw, Math.min(T.hw, x + (Math.random() - 0.5) * 1.6));
      const pz = T.z0 + 0.35 + Math.random() * (T.z1 - T.z0 - 0.7);
      // stack on top of nearby medals
      let h = 0;
      for (const c of tr) if (Math.abs(c.x - px) < 0.75 && Math.abs(c.z - pz) < 0.75) h = Math.max(h, c.h + 1);
      h = Math.min(h, 4);
      const a = Math.random() * Math.PI * 2, tilt = (Math.random() - 0.5) * (h ? 0.35 : 0.12);
      tr.push({ x: px, z: pz, h, g: kind === KIND.SILVER ? 0 : 1, a, tilt, drop: 0.35 });
    }
    if (tr.length > TRAY_CAP - 20) this.trayClear = 1; // tray full: it gets emptied
    this.trayDirty = true;
  }

  updateTray(dt) {
    if (!this.trayMeshes || !this.trayDef) return;
    const T = this.trayDef, tr = this.tray;
    let anim = false;
    for (const c of tr) if (c.drop > 0) { c.drop = Math.max(0, c.drop - dt * 2.2); anim = true; }
    if (this.trayClear > 0) {
      this.trayClear -= dt * 1.25; anim = true;
      if (this.trayClear <= 0) { tr.length = 0; this.trayClear = 0; if (this.onTrayEmptied) this.onTrayEmptied(); }
    }
    if (!anim && !this.trayDirty) return;
    this.trayDirty = false;
    const sink = this.trayClear > 0 ? (1 - this.trayClear) : 0;
    const q = new THREE.Quaternion(), e = new THREE.Euler(), mtx = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    const cnt = [0, 0];
    for (const c of tr) {
      const m = this.trayMeshes[c.g];
      e.set(c.tilt, c.a, c.tilt * 0.6); q.setFromEuler(e);
      p.set(c.x, T.y + L.coinHH + c.h * L.coinHH * 1.9 + c.drop * c.drop * 6 - sink * 1.2, c.z + sink * 0.8);
      mtx.compose(p, q, sc);
      m.setMatrixAt(cnt[c.g]++, mtx);
    }
    this.trayMeshes.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; });
  }

  // user-adjustable reflection strength (1 = default)
  setReflection(k) {
    this.reflK = k;
    const all = [...Object.values(this.meshes), ...this.tokenMeshes];
    for (const m of all) for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
      if (mat.userData.baseEnv === undefined) mat.userData.baseEnv = mat.envMapIntensity;
      mat.envMapIntensity = mat.userData.baseEnv * k;
    }
  }

  _inst(kind, geo, mat, receive) {
    const m = new THREE.InstancedMesh(geo, mat, CAP[kind]);
    m.count = 0;
    m.castShadow = true;
    m.receiveShadow = !!receive;
    m.frustumCulled = false;
    if (kind === KIND.GEM) m.setColorAt(0, new THREE.Color(1, 1, 1));
    this.scene.add(m);
    this.meshes[kind] = m;
  }

  setShadows(cast, receive) {
    for (const m of [...Object.values(this.meshes), ...this.tokenMeshes]) { m.castShadow = cast; m.receiveShadow = receive; }
  }

  // buf layout from PusherPhysics.pack
  // Render-side dead band: tiny residual solver jitter of resting coins is not shown.
  // A coin keeps its last drawn pose until it has moved/rotated by a visible amount.
  _stable(buf, off) {
    const id = buf[off];
    let p = this.poses.get(id);
    if (!p) { p = new Float32Array(8); this.poses.set(id, p); p[7] = -1; }
    const x = buf[off + 3], y = buf[off + 4], z = buf[off + 5];
    const dot = Math.abs(p[3] * buf[off + 6] + p[4] * buf[off + 7] + p[5] * buf[off + 8] + p[6] * buf[off + 9]);
    if (p[7] < 0 || Math.abs(x - p[0]) + Math.abs(y - p[1]) + Math.abs(z - p[2]) > 0.006 || dot < 0.99997) {
      for (let k = 0; k < 7; k++) p[k] = buf[off + 3 + k];
    }
    p[7] = this.gen;
    return p;
  }

  update(buf) {
    const n = buf[0] | 0;
    if (!this.poses) { this.poses = new Map(); this.gen = 0; }
    this.gen++;
    if (this.gen % 300 === 0) for (const [id, p] of this.poses) if (this.gen - p[7] > 5) this.poses.delete(id);
    const counts = {};
    const tcounts = new Array(TOKEN_COUNT).fill(0);
    for (const k in this.meshes) counts[k] = 0;
    let off = PACK_HEAD;
    for (let i = 0; i < n; i++, off += 10) {
      const kind = buf[off + 1] | 0, extra = buf[off + 2] | 0;
      let mesh, idx;
      if (kind === KIND.TOKEN) {
        mesh = this.tokenMeshes[extra] || this.tokenMeshes[0];
        idx = tcounts[extra]++;
      } else {
        mesh = this.meshes[kind];
        if (!mesh) continue;
        idx = counts[kind]++;
      }
      if (idx >= mesh.instanceMatrix.count) continue;
      const p = this._stable(buf, off);
      compose(mesh.instanceMatrix.array, idx * 16, p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
      if (kind === KIND.GEM) mesh.setColorAt(idx, this.gemColors[Math.floor(extra / 4) % this.gemColors.length]);
    }
    for (const k in this.meshes) {
      const m = this.meshes[k];
      m.count = Math.min(counts[k], m.instanceMatrix.count);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.tokenMeshes.forEach((m, i) => { m.count = Math.min(tcounts[i], 12); m.instanceMatrix.needsUpdate = true; });
  }
}

function compose(te, o, x, y, z, qx, qy, qz, qw) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  te[o] = 1 - (yy + zz); te[o + 1] = xy + wz; te[o + 2] = xz - wy; te[o + 3] = 0;
  te[o + 4] = xy - wz; te[o + 5] = 1 - (xx + zz); te[o + 6] = yz + wx; te[o + 7] = 0;
  te[o + 8] = xz + wy; te[o + 9] = yz - wx; te[o + 10] = 1 - (xx + yy); te[o + 11] = 0;
  te[o + 12] = x; te[o + 13] = y; te[o + 14] = z; te[o + 15] = 1;
}
