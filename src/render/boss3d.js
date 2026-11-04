// 3D bosses that rise from behind the back wall of the table (original designs built from
// primitives): a rock colossus, a mech dragon, a deep-sea tentacle beast and a clockwork
// phantom. Driven by BossSystem through appear / state / attack / hit / defeat / retreat.
import * as THREE from 'three';
import { L } from '../core/layout.js';

const TAU = Math.PI * 2;

function clockTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dfc4'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
  g.strokeStyle = '#3b2a12'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#3b2a12'; g.font = '700 30px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  R.forEach((r, i) => { const a = i / 12 * TAU - Math.PI / 2; g.fillText(r, 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BossView {
  constructor(scene, audio, W) {
    this.audio = audio;
    this.root = new THREE.Group();
    this.baseY = L.pusherH + 3.65;
    this.root.position.set(0, this.baseY, L.backWallZ - 0.75);
    this.root.scale.setScalar(Math.min(1, 0.55 + W / 25));
    this.root.visible = false;
    scene.add(this.root);
    this.lift = new THREE.Group(); this.root.add(this.lift);
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff5a1f, emissiveIntensity: 1.2 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 16), new THREE.MeshBasicMaterial({ color: 0xb388ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.shield.position.y = 1.6; this.lift.add(this.shield);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    scene.add(this.beam);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 48), new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0, toneMapped: false }));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.3; scene.add(this.ring);
    this.light = new THREE.PointLight(0xff5a1f, 0, 9, 2); this.light.position.set(0, 1.5, 1.6); this.lift.add(this.light);
    this.models = {};
    this.flash = 0; this.recoil = 0; this.rise = 0; this.mode = 'off'; this.t = 0; this.atk = null; this.atkT = 0;
    this.hp = 1; this.weak = false; this.barrier = false; this.enraged = false;
  }

  _mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...o }); }

  _build(id) {
    if (this.models[id]) return this.models[id];
    const g = new THREE.Group(), parts = { arms: [], swing: [] };
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), this.coreMat);
    const eye = (x, y, z, r = 0.11) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), this.eyeMat); e.position.set(x, y, z); return e; };
    if (id === 'golem') {
      const rock = this._mat(0x6d6458, { roughness: 0.95, flatShading: true });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 0), rock); body.position.y = 1.3; body.scale.set(1.15, 1, 0.8);
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rock); head.position.y = 2.85;
      g.add(body, head, eye(-0.24, 2.92, 0.5), eye(0.24, 2.92, 0.5));
      for (const sx of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(sx * 1.55, 2.0, 0);
        const up = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), rock); up.position.y = -0.4;
        const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rock); fist.position.y = -1.2;
        arm.add(up, fist); g.add(arm); parts.arms.push(arm);
      }
      core.position.set(0, 1.5, 1.05);
    } else if (id === 'dragon') {
      const steel = this._mat(0x5c6470, { metalness: 0.85, roughness: 0.3 });
      const red = this._mat(0xb71c1c, { metalness: 0.6, roughness: 0.35 });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 2.0, 8), steel); torso.position.y = 1.0;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.2, 8), steel); neck.position.set(0, 2.4, 0.2); neck.rotation.x = 0.4;
      const head = new THREE.Group(); head.position.set(0, 3.0, 0.6);
      const skull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.3), red);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 1.1), steel); jaw.position.set(0, -0.4, 0.15);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.05), this.eyeMat); visor.position.set(0, 0.08, 0.66);
      for (const sx of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 8), steel); horn.position.set(sx * 0.4, 0.5, -0.4); horn.rotation.x = -0.7; head.add(horn); }
      head.add(skull, jaw, visor); parts.jaw = jaw; parts.head = head;
      g.add(torso, neck, head);
      const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(2.4, 1.4); wingShape.lineTo(2.0, 0.2); wingShape.lineTo(2.6, -0.4); wingShape.lineTo(1.2, -0.3); wingShape.lineTo(0, -0.6);
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), this._mat(0x8e1b1b, { side: THREE.DoubleSide, metalness: 0.5 }));
        wing.position.set(sx * 0.7, 1.8, -0.4); wing.scale.x = sx; g.add(wing); parts.swing.push(wing);
      }
      core.position.set(0, 1.2, 1.05);
    } else if (id === 'kraken') {
      const skin = this._mat(0x5e2a84, { roughness: 0.4, metalness: 0.1 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 20), skin); head.position.y = 2.1; head.scale.set(1, 1.25, 0.95);
      g.add(head, eye(-0.45, 2.0, 1.05, 0.22), eye(0.45, 2.0, 1.05, 0.22));
      for (let i = 0; i < 6; i++) {
        const arm = new THREE.Group(); const a = (i / 5 - 0.5) * 2.6;
        arm.position.set(Math.sin(a) * 1.0, 1.0, Math.cos(a) * 0.4);
        let r = 0.28; const segs = [];
        for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), skin); s.position.set(Math.sin(a) * k * 0.28, -k * 0.3, 0.12 * k); arm.add(s); segs.push(s); r *= 0.86; }
        arm.userData = { a, segs }; g.add(arm); parts.arms.push(arm);
      }
      core.position.set(0, 2.9, 1.1);
    } else {
      // clockwork phantom
      const cloth = this._mat(0x1a1a2e, { roughness: 0.9, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 24, 1, true), cloth); cloak.position.y = 1.6;
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), cloth); hood.position.y = 3.25;
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 32), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.4 }));
      face.rotation.x = Math.PI / 2; face.position.set(0, 1.8, 0.75);
      const hand = (len, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.04), this._mat(0x3b2a12)); m.geometry.translate(0, len / 2, 0); m.position.set(0, 1.8, 0.83); return m; };
      parts.hour = hand(0.42, 0.07); parts.min = hand(0.62, 0.05);
      g.add(cloak, hood, face, parts.hour, parts.min, eye(-0.2, 3.27, 0.52, 0.08), eye(0.2, 3.27, 0.52, 0.08));
      for (const sx of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(sx * 1.7, 2.0, 0.4);
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), this._mat(0xe0e0e0)); arm.add(glove);
        g.add(arm); parts.arms.push(arm);
      }
      core.position.set(0, 1.8, 0.86); core.scale.setScalar(0.45);
    }
    g.add(core); parts.core = core;
    g.userData = parts;
    g.visible = false;
    this.lift.add(g);
    this.models[id] = g;
    return g;
  }

  appear(id, stage) {
    for (const k in this.models) this.models[k].visible = false;
    this.cur = this._build(id); this.cur.visible = true; this.id = id;
    this.root.visible = true; this.mode = 'rise'; this.rise = 0; this.hp = 1; this.stage = stage;
    this.lift.rotation.set(0, 0, 0); this.lift.scale.setScalar(1);
    this.audio && this.audio.thump && this.audio.thump(0, 0.9, 40);
  }
  state(s) { this.hp = s.hp; this.weak = s.weak; this.barrier = s.barrier; this.enraged = s.enraged; }
  hit(v, crit) { this.flash = Math.min(1, this.flash + (crit ? 1 : 0.25)); this.recoil = Math.min(1, this.recoil + (crit ? 0.8 : 0.12)); }
  attack(kind) { this.atk = kind; this.atkT = 0; }
  defeat() { this.mode = 'die'; this.dieT = 0; }
  retreat() { this.mode = 'sink'; }

  _beam(from, to, color, k) {
    const b = this.beam, d = to.clone().sub(from), len = d.length();
    b.position.copy(from).add(to).multiplyScalar(0.5);
    b.scale.set(1, len, 1);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    b.material.color.set(color); b.material.opacity = k;
  }

  update(dt) {
    if (!this.root.visible) return;
    this.t += dt;
    const p = this.cur && this.cur.userData;
    // rise / sink / die
    if (this.mode === 'rise') { this.rise = Math.min(1, this.rise + dt * 0.7); if (this.rise >= 1) this.mode = 'fight'; }
    if (this.mode === 'sink') { this.rise = Math.max(0, this.rise - dt * 0.6); if (this.rise <= 0) { this.root.visible = false; this.mode = 'off'; } }
    if (this.mode === 'die') {
      this.dieT += dt;
      this.lift.rotation.z = Math.sin(this.dieT * 40) * 0.08 * (1 - this.dieT / 2.2);
      this.lift.scale.setScalar(Math.max(0.01, 1 - Math.max(0, this.dieT - 1.2) / 1.0));
      this.flash = Math.sin(this.dieT * 30) > 0 ? 1 : 0.2;
      if (this.dieT > 2.2) { this.root.visible = false; this.mode = 'off'; }
    }
    const e = this.rise * this.rise * (3 - 2 * this.rise);
    this.lift.position.y = (e - 1) * 4.2 + Math.sin(this.t * 1.6) * 0.08;
    // hit flash + recoil
    this.flash = Math.max(0, this.flash - dt * 3);
    this.recoil = Math.max(0, this.recoil - dt * 2.5);
    if (this.mode !== 'die') this.lift.rotation.x = -this.recoil * 0.25;
    // core / eyes / shield
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
    this.coreMat.emissive.setHex(this.weak ? 0x00ff88 : 0xff5a1f);
    this.coreMat.emissiveIntensity = (this.weak ? 2.5 + 2 * pulse : 0.8 + this.flash * 2);
    if (p && p.core) p.core.scale.setScalar((this.id === 'phantom' ? 0.45 : 1) * (this.weak ? 1.35 + 0.15 * pulse : 1));
    this.eyeMat.color.setHex(this.enraged ? (pulse > 0.5 ? 0xff1744 : 0xff8a80) : this.flash > 0.5 ? 0xffffff : 0xffe14d);
    this.light.intensity = (this.weak ? 6 : 2) + this.flash * 6;
    this.light.color.setHex(this.weak ? 0x00ff88 : 0xff5a1f);
    this.shield.material.opacity += ((this.barrier ? 0.22 + 0.08 * pulse : 0) - this.shield.material.opacity) * Math.min(1, dt * 6);
    // idle animation per model
    if (p) {
      const atkK = this.atk ? Math.sin(Math.min(1, this.atkT / 0.9) * Math.PI) : 0;
      p.arms.forEach((arm, i) => {
        if (arm.userData.segs) arm.userData.segs.forEach((s, k) => { s.position.x = Math.sin(arm.userData.a) * k * 0.28 + Math.sin(this.t * 2 + i + k * 0.6) * 0.06 * k; s.position.z = 0.12 * k + atkK * k * 0.25; });
        else { const sx = i ? 1 : -1; arm.rotation.z = sx * (0.15 + Math.sin(this.t * 1.5 + i) * 0.08) + (this.atk === 'rock' || this.atk === 'freeze' ? -sx * atkK * 1.6 : 0); arm.rotation.x = -atkK * 0.8; }
      });
      p.swing.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(this.t * 3) * 0.25); });
      if (p.jaw) p.jaw.position.y = -0.4 - (this.atk ? atkK * 0.25 : 0);
      if (p.hour) { p.hour.rotation.z = -this.t * 0.4; p.min.rotation.z = -this.t * 4.8; }
    }
    // attack effects
    if (this.atk) {
      this.atkT += dt;
      const k = Math.max(0, Math.sin(Math.min(1, this.atkT / 1.2) * Math.PI));
      const from = new THREE.Vector3(); (p && p.core ? p.core : this.lift).getWorldPosition(from);
      if (this.atk === 'jam') this._beam(from, new THREE.Vector3(0, L.gateY, L.dropZ), 0xff3d00, k * 0.8);
      else if (this.atk === 'drain') this._beam(new THREE.Vector3(0, L.pusherH + 6, L.dropZ), new THREE.Vector3(0, 0.2, 2.5), 0xb388ff, k * 0.6);
      else this.beam.material.opacity = 0;
      if (this.atk === 'freeze') { const s = 1 + this.atkT * 9; this.ring.scale.set(s, s, s); this.ring.position.z = 0; this.ring.material.opacity = Math.max(0, 0.8 - this.atkT * 0.6); }
      if (this.atkT > 1.4) { this.atk = null; this.beam.material.opacity = 0; this.ring.material.opacity = 0; }
    }
  }
}
