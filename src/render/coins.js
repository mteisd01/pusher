import * as THREE from 'three';
import { L, KIND, TOKEN_COUNT } from '../core/layout.js';
import { makeCoinGeometry, makeGemGeometry } from './coinGeometry.js';
import { makeCoinFace, makeCoinEdge, makeTokenFace, makeBallTexture, makeChestTexture } from './textures.js';

export const TOKEN_STYLE = [
  { color: '#2f8cff', icon: 'WALL', label: 'GUARD' },
  { color: '#26c967', icon: '$$', label: 'SHOWER' },
  { color: '#ff7a1a', icon: '>>', label: 'TURBO' },
  { color: '#9b4dff', icon: 'x2', label: 'DOUBLE' },
  { color: '#ff2d6f', icon: '777', label: 'FEVER' },
  { color: '#16c6c6', icon: '+4', label: 'STOCK' },
];
export const GEM_COLORS = ['#ff1744', '#2979ff', '#00e676', '#ffc400', '#d500f9', '#e8f6ff'];

const CAP = { [KIND.SILVER]: 1400, [KIND.GOLD]: 500, [KIND.RAINBOW]: 120, [KIND.BIG]: 60, [KIND.BALL]: 16, [KIND.GEM]: 60, [KIND.CHEST]: 30 };

export class CoinRenderer {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.meshes = {};
    this.tokenMeshes = [];
    this.build(quality);
  }

  build(quality) {
    for (const m of Object.values(this.meshes)) { this.scene.remove(m); }
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
      token: makeCoinFace('token', 512),
    };
    const metal = (face, color, side, extra = {}) => [
      new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 1, map: face.map, normalMap: face.normalMap, roughnessMap: face.roughnessMap, envMapIntensity: 1.0, ...extra }),
      new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.42, normalMap: side.normalMap, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.0, ...extra }),
    ];
    const silverMats = metal(this.faces.silver, '#dfe3e8', edge);
    const goldMats = metal(this.faces.gold, '#ffc84a', edge);
    const rainbowMats = [
      new THREE.MeshPhysicalMaterial({ color: '#f4f4ff', metalness: 1, roughness: 1, map: this.faces.rainbow.map, normalMap: this.faces.rainbow.normalMap, roughnessMap: this.faces.rainbow.roughnessMap, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 900 }),
      new THREE.MeshPhysicalMaterial({ color: '#f4f4ff', metalness: 1, roughness: 0.3, normalMap: edge.normalMap, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 900 }),
    ];
    const bigMats = metal(this.faces.big, '#f0c060', edgeBig);
    this._inst(KIND.SILVER, coinGeo, silverMats, hi);
    this._inst(KIND.GOLD, coinGeo, goldMats, hi);
    this._inst(KIND.RAINBOW, coinGeo, rainbowMats, hi);
    this._inst(KIND.BIG, bigGeo, bigMats, true);
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
  update(buf) {
    const n = buf[0] | 0;
    const counts = {};
    const tcounts = new Array(TOKEN_COUNT).fill(0);
    for (const k in this.meshes) counts[k] = 0;
    let off = 8;
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
      compose(mesh.instanceMatrix.array, idx * 16, buf[off + 3], buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7], buf[off + 8], buf[off + 9]);
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
