// On-table mechanical devices: real 3D slot reels behind the screen windows, the medal
// hopper that pours payouts onto the field, the lucky wheel beside the screen, the moving
// catcher cup on the pusher shelf and the rotating beacons on top of the cabinet.
import * as THREE from 'three';
import { L } from '../core/layout.js';
import { drawSymbol } from './backboard.js';

const TAU = Math.PI * 2;
const chromeMat = () => new THREE.MeshStandardMaterial({ color: 0xf0f0f4, metalness: 1, roughness: 0.1 });

// ---------------------------------------------------------------- slot reels
// Canvas layout of the reel windows on the backboard (see backboard.js)
export const REEL_WIN = { rw: 196, rh: 240, gap: 22, top: 130, cw: 1024, ch: 512 };

export class MechReels {
  constructor(scene, screen, strips) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const S = screen, R = REEL_WIN;
    const sx = S.w / R.cw, sy = S.h / R.ch;
    const x0 = R.cw / 2 - (R.rw * 3 + R.gap * 2) / 2;
    const width = R.rw * sx * 1.02, winH = R.rh * sy;
    this.radius = winH * 1.06; // ~3 symbols visible per window, like a real reel
    const n = strips[0].length;
    this.n = n;
    this.offset = -0.5 * TAU / n; // symbol centres sit half a cell into the strip texture
    this.drums = strips.map((strip, i) => {
      const cxPx = x0 + i * (R.rw + R.gap) + R.rw / 2, cyPx = R.top + R.rh / 2;
      const x = (cxPx / R.cw - 0.5) * S.w, y = S.y + (0.5 - cyPx / R.ch) * S.h;
      const tex = this._stripTexture(strip);
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.05 });
      const geo = new THREE.CylinderGeometry(this.radius, this.radius, width, 64, 1, true);
      geo.rotateZ(Math.PI / 2); // axis along X
      const mesh = new THREE.Mesh(geo, mat);
      const holder = new THREE.Group();
      holder.position.set(x, y, S.z + 0.1 - this.radius);
      holder.add(mesh);
      // side discs (chrome)
      for (const s of [-1, 1]) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(this.radius, 40), chromeMat());
        disc.rotation.y = s * Math.PI / 2; disc.position.x = s * width / 2; holder.add(disc);
      }
      this.group.add(holder);
      return { mesh, mat, holder };
    });
    // back light inside the reel box
    this.light = new THREE.PointLight(0xfff0d0, 6, 9, 2);
    this.light.position.set(0, S.y, S.z + 1.6);
    this.group.add(this.light);
  }

  _stripTexture(strip) {
    const n = strip.length, cell = 128;
    const c = document.createElement('canvas'); c.width = 256; c.height = n * cell;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#d8d8d8');
    g.fillStyle = gr; g.fillRect(0, 0, 256, c.height);
    for (let k = 0; k < n; k++) {
      g.save(); g.translate(128, k * cell + cell / 2); g.rotate(Math.PI / 2);
      drawSymbol(g, strip[k], 0, 0, 104);
      g.restore();
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, k * cell, 256, 2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.wrapS = THREE.RepeatWrapping;
    // cylinder U runs around the drum: rotate the canvas onto it
    t.center.set(0.5, 0.5); t.rotation = -Math.PI / 2;
    return t;
  }

  update(dt, slot, st) {
    const t = performance.now() / 1000;
    this.drums.forEach((d, i) => {
      const r = slot.reels[i];
      d.holder.rotation.x = -(r.pos / this.n) * TAU + this.offset;
      let em = 0.3;
      if (slot.flash > 0) em = Math.floor(t * 10) % 2 ? 0.9 : 0.3;
      else if (slot.reach && slot.spinning && i === 2 && r.state === 'spin') em = 0.35 + 0.35 * Math.sin(t * 20);
      d.mat.emissiveIntensity = em;
    });
    this.light.intensity = st.fever ? 9 : 6;
  }
}
MechReels.prototype.offset = 0; // set per instance from the strip length (half a symbol)

// ---------------------------------------------------------------- hopper bucket
export class Hopper {
  constructor(scene, W) {
    this.W = W;
    this.y = 8.4; this.z = -2.6;
    this.group = new THREE.Group();
    scene.add(this.group);
    const chrome = chromeMat();
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, W * 2 + 5, 12), chrome);
    rail.rotation.z = Math.PI / 2; rail.position.set(0, this.y + 1.05, this.z); this.group.add(rail);
    this.bucket = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 1.0, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }));
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), body.material); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.5;
    // medals inside (visible when filled)
    this.fill = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.62, 0.7, 24), new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: 0.35 }));
    this.fill.position.y = -0.1;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 24), chrome); lip.rotation.x = Math.PI / 2; lip.position.y = 0.5;
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), chrome); hanger.position.y = 0.8;
    this.lamp = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), this.lamp); lampM.position.set(0, 1.1, 0.15);
    this.pivot = new THREE.Group(); this.pivot.add(body, bottom, this.fill, lip);
    this.bucket.add(this.pivot, hanger, lampM);
    this.bucket.position.set(W + 2, this.y, this.z);
    this.group.add(this.bucket);
    this.x = W + 2; this.tx = this.x; this.tilt = 0; this.pending = 0; this.dir = -1;
  }
  get parkX() { return this.W + 2; }
  // game asks where the next medal should come from; null while the bucket is travelling
  pourPoint() {
    if (Math.abs(this.x) > this.W - 0.5 || this.tilt < 0.7) return null;
    return { x: this.x + (Math.random() - 0.5) * 0.7, y: this.y - 0.2, z: this.z + 0.45 };
  }
  update(dt, pending) {
    this.pending = pending;
    const W = this.W;
    if (pending > 0) {
      // sweep across the table while pouring
      if (Math.abs(this.x - this.tx) < 0.2 || this.tx === this.parkX) this.tx = this.dir > 0 ? W - 1.5 : -(W - 1.5), this.dir = -this.dir;
      const k = Math.min(1, pending / 30);
      this.fill.visible = true; this.fill.scale.y = 0.3 + 0.7 * k;
    } else { this.tx = this.parkX; this.fill.visible = false; }
    const speed = pending > 0 ? (Math.abs(this.tilt) > 0.6 ? 3.2 : 9) : 8;
    this.x += Math.sign(this.tx - this.x) * Math.min(Math.abs(this.tx - this.x), dt * speed);
    const wantTilt = pending > 0 && Math.abs(this.x) < W ? 1.15 : 0;
    this.tilt += (wantTilt - this.tilt) * Math.min(1, dt * 5);
    this.bucket.position.x = this.x;
    this.pivot.rotation.x = this.tilt;
    this.lamp.color.setHSL(0.13, 1, pending > 0 ? 0.5 + 0.3 * Math.sin(performance.now() / 60) : 0.3);
  }
}

// ---------------------------------------------------------------- lucky wheel
export class LuckyWheel {
  constructor(scene, screen, segments) {
    this.segs = segments;
    this.x = screen.w / 2 + 2.45; this.y = 8.7; this.z = screen.z + 0.35;
    this.R = 1.85;
    this.group = new THREE.Group();
    this.group.position.set(this.x, this.y, this.z);
    scene.add(this.group);
    const chrome = chromeMat();
    // stand
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, this.y - 4.6, 12), chrome);
    stand.position.y = -(this.y - 4.6) / 2 - 0.1; stand.position.z = -0.3; this.group.add(stand);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.6, 32), new THREE.MeshPhysicalMaterial({ color: 0x15151a, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    base.position.set(0, 4.95 - this.y, -0.3); this.group.add(base);
    // face
    const tex = this._faceTexture();
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.R, 64), new THREE.MeshPhysicalMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
    this.group.add(this.disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(this.R + 0.06, 0.1, 12, 64), chrome); this.group.add(rim);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12), chrome); hub.position.z = 0.08; this.group.add(hub);
    // bulbs around the rim
    const nb = 24;
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), nb);
    const m = new THREE.Matrix4();
    for (let i = 0; i < nb; i++) { const a = i / nb * TAU; m.makeTranslation(Math.cos(a) * (this.R + 0.22), Math.sin(a) * (this.R + 0.22), 0.05); this.bulbs.setMatrixAt(i, m); this.bulbs.setColorAt(i, new THREE.Color(1, 1, 1)); }
    this.group.add(this.bulbs);
    // pointer (flapper) at the top
    this.flap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 3), new THREE.MeshStandardMaterial({ color: 0xff2d55, metalness: 0.3, roughness: 0.3 }));
    this.flap.rotation.z = Math.PI; this.flapPivot = new THREE.Group(); this.flapPivot.position.set(0, this.R + 0.35, 0.15);
    this.flap.position.y = -0.1; this.flapPivot.add(this.flap); this.group.add(this.flapPivot);
    this.angle = 0; this.vel = 0; this.active = false; this.lastSeg = -1; this.flapA = 0;
  }

  _faceTexture() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), n = this.segs.length, r = S / 2;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU - Math.PI / 2 - Math.PI / n, a1 = a0 + TAU / n;
      g.fillStyle = this.segs[i].color; g.beginPath(); g.moveTo(r, r); g.arc(r, r, r, a0, a1); g.closePath(); g.fill();
      g.strokeStyle = '#ffe9a0'; g.lineWidth = 6; g.stroke();
      g.save(); g.translate(r, r); g.rotate((a0 + a1) / 2 + Math.PI / 2);
      g.fillStyle = '#fff'; g.font = `900 ${this.segs[i].label.length > 4 ? 52 : 70}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(this.segs[i].label, 0, -r * 0.68); g.fillText(this.segs[i].label, 0, -r * 0.68);
      g.restore();
    }
    const gr = g.createRadialGradient(r, r, r * 0.1, r, r, r); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r, 0, TAU); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  // spin so that segment `target` stops under the pointer; resolves when it stops
  spin(target, audio) {
    this.audio = audio;
    const n = this.segs.length, seg = TAU / n;
    // pointer at the top; segment i centre is at angle -i*seg from the top after rotation
    const cur = ((this.angle % TAU) + TAU) % TAU;
    const want = target * seg + (Math.random() - 0.5) * seg * 0.7;
    let delta = want - cur; while (delta < 0) delta += TAU;
    this.total = delta + TAU * (4 + Math.floor(Math.random() * 2));
    this.start = this.angle; this.t = 0; this.dur = 5.2 + Math.random() * 1.2;
    this.active = true;
    return new Promise(res => { this.resolve = res; });
  }

  update(dt, mode) {
    const n = this.segs.length, seg = TAU / n;
    if (this.active) {
      this.t += dt;
      const k = Math.min(1, this.t / this.dur);
      const e = 1 - Math.pow(1 - k, 3.2);
      this.angle = this.start + this.total * e;
      if (k >= 1) { this.active = false; const r = this.resolve; this.resolve = null; r && r(); }
    } else this.angle += dt * 0.15;
    this.disc.rotation.z = this.angle;
    // flapper clicks on every segment border
    const segIdx = Math.floor((this.angle + seg / 2) / seg);
    if (segIdx !== this.lastSeg) { this.lastSeg = segIdx; this.flapA = 0.6; if (this.active && this.audio) this.audio.reelTick(); }
    this.flapA += (0 - this.flapA) * Math.min(1, dt * 14);
    this.flapPivot.rotation.z = -this.flapA;
    const t = performance.now() / 1000, c = new THREE.Color();
    for (let i = 0; i < 24; i++) {
      if (this.active) c.setHSL((i / 24 + t * 1.5) % 1, 1, 0.6);
      else c.setRGB(1, 0.85, 0.4).multiplyScalar((i + Math.floor(t * 4)) % 3 === 0 ? 1 : 0.25);
      this.bulbs.setColorAt(i, c);
    }
    this.bulbs.instanceColor.needsUpdate = true;
    this.disc.material.emissiveIntensity = this.active ? 0.45 : 0.25;
  }
}

// ---------------------------------------------------------------- catcher cup
export class CatcherCup {
  constructor(scene) {
    this.group = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffd34d, metalness: 1, roughness: 0.2, side: THREE.DoubleSide });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.55, 28, 1, true), mat);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.48, 28), mat); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.27;
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x7CFFB2, toneMapped: false, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 28), this.glowMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.28;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 }));
    arm.position.set(0, 0.2, -0.85);
    this.group.add(cup, bottom, ring, arm);
    scene.add(this.group);
    this.flash = 0;
  }
  update(dt, x, y, z, on) {
    this.group.visible = on;
    this.group.position.set(x, y, z);
    this.flash = Math.max(0, this.flash - dt);
    this.glowMat.color.setHSL(this.flash > 0 ? (performance.now() / 300) % 1 : 0.42, 1, 0.6);
  }
}

// ---------------------------------------------------------------- beacons
export class Beacons {
  constructor(scene, positions) {
    this.items = positions.map(p => {
      const g = new THREE.Group(); g.position.set(...p);
      const domeMat = new THREE.MeshPhysicalMaterial({ color: 0xff3030, transparent: true, opacity: 0.55, roughness: 0.2, clearcoat: 1, emissive: 0xff2020, emissiveIntensity: 0.2 });
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.8, 24), domeMat); dome.position.y = 0.4;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 10, 0, TAU, 0, Math.PI / 2), domeMat); cap.position.y = 0.8;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.22, 24), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.4 }));
      const rot = new THREE.Group(); rot.position.y = 0.45;
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
      for (const s of [-1, 1]) {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 20, 1, true), beamMat);
        beam.rotation.z = s * Math.PI / 2; beam.position.x = s * 4.6; rot.add(beam);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      rot.add(core);
      g.add(base, dome, cap, rot);
      scene.add(g);
      return { g, rot, domeMat, beamMat, core };
    });
  }
  update(dt, mode) {
    const on = mode === 'fever' || mode === 'win' || mode === 'event' || mode === 'jp';
    const col = mode === 'jp' ? 0xffd34d : mode === 'fever' ? 0xff2bd6 : mode === 'event' ? 0xff3030 : 0x30a0ff;
    for (const b of this.items) {
      b.rot.rotation.y += dt * (on ? 7 : 0.6);
      b.domeMat.color.setHex(col); b.domeMat.emissive.setHex(col);
      b.domeMat.emissiveIntensity += ((on ? 1.4 : 0.12) - b.domeMat.emissiveIntensity) * Math.min(1, dt * 6);
      b.beamMat.color.setHex(col);
      b.beamMat.opacity += ((on ? 0.16 : 0) - b.beamMat.opacity) * Math.min(1, dt * 6);
      b.core.visible = on;
    }
  }
}
