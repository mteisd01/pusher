// Number checker plates (bingo) on the back wall above the pusher, one per number at the x the
// medal has to fall at. Dim when idle, blinking before they open, bright while open, and marked
// numbers keep a green rim. A thin light column shows the open plate's drop line.
import * as THREE from 'three';
import { L } from '../core/layout.js';

function plateTexture(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
  g.fillStyle = '#fff'; g.font = '900 86px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CheckerPlates {
  constructor(scene, plateX) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.plates = [];
    const y = L.pusherH + 1.55, z = L.backWallZ + 0.04;
    for (let n = 1; n <= 9; n++) {
      const mat = new THREE.MeshBasicMaterial({ map: plateTexture(n), color: 0x444444, toneMapped: false, transparent: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), mat);
      m.position.set(plateX(n), y, z);
      this.group.add(m);
      this.plates.push({ n, mat, m });
    }
    // drop line of the open plate: a faint vertical light from the plate down to the shelf
    this.colMat = new THREE.MeshBasicMaterial({ color: 0xff2d6f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.col = new THREE.Mesh(new THREE.BoxGeometry(0.5, L.gateY + 1.2 - L.pusherH, 0.05), this.colMat);
    this.col.position.set(0, (L.gateY + 1.2 + L.pusherH) / 2, L.dropZ);
    this.group.add(this.col);
    this.t = 0;
  }
  // v: Bingo.view(); on: feature enabled
  update(dt, v, on, plateX) {
    this.t += dt;
    this.group.visible = on;
    if (!on) return;
    const c = new THREE.Color();
    let open = null;
    for (const p of this.plates) {
      const idx = v.card.indexOf(p.n), marked = idx >= 0 && (v.marks & (1 << idx));
      const lit = v.lit.includes(p.n);
      if (lit && v.phase === 'open') { c.set(0xff2d6f).multiplyScalar(1.6 + 0.4 * Math.sin(this.t * 20)); open = p; }
      else if (lit) c.set(Math.floor(this.t * 8) % 2 ? 0xff2d6f : 0x553344);
      else if (v.flash[p.n]) c.set(0xffffff).multiplyScalar(2);
      else if (marked) c.set(0x26c967);
      else c.set(0x5a5a66);
      p.mat.color.copy(c);
      p.m.scale.setScalar(lit ? 1.15 : 1);
    }
    this.colMat.opacity = open ? 0.18 + 0.08 * Math.sin(this.t * 14) : 0;
    if (open) this.col.position.x = plateX(open.n);
  }
}
