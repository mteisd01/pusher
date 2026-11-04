// Visuals of the physical field devices driven by the packed physics state: the two field
// turntables, the gutter flippers, the ball kicker in the back wall and the medal meter
// tube next to the lucky wheel (caught medals ride a chute into it).
import * as THREE from 'three';
import { L, TURNTABLE, FLIPPER } from '../core/layout.js';

const TAU = Math.PI * 2;

function discTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const n = 16;
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 256, i / n * TAU, (i + 1) / n * TAU); g.closePath();
    g.fillStyle = i % 2 ? '#b8bcc6' : '#d9dce3'; g.fill();
  }
  // printed stars and ring
  g.strokeStyle = '#ffcf40'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 236, 0, TAU); g.stroke();
  g.fillStyle = '#ffcf40'; g.font = '900 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; g.fillText('★', 256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160); }
  g.beginPath(); g.arc(256, 256, 46, 0, TAU); g.fillStyle = '#20232b'; g.fill();
  g.fillStyle = '#ffcf40'; g.font = '900 30px Arial'; g.fillText('SPIN', 256, 258);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class FieldDevices {
  constructor(scene, W, wheelPos) {
    this.W = W;
    this.group = new THREE.Group();
    scene.add(this.group);
    const chrome = new THREE.MeshStandardMaterial({ color: 0xeef0f4, metalness: 1, roughness: 0.12 });
    // turntables
    const tex = discTexture();
    this.discMat = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.75, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0xffcf40, toneMapped: false });
    this.tts = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(TURNTABLE.r, TURNTABLE.r, 0.03, 64), this.discMat);
      disc.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(TURNTABLE.r + 0.04, 0.035, 8, 64), this.rimMat); rim.rotation.x = Math.PI / 2;
      g.add(disc, rim);
      g.position.set(sx * (W - TURNTABLE.dx), 0.002, TURNTABLE.z);
      this.group.add(g);
      this.tts.push({ g: disc, w: -sx * TURNTABLE.w });
    }
    // flippers (bar + rubber tip + pivot post)
    this.flips = [];
    const rubber = new THREE.MeshStandardMaterial({ color: 0xd81b60, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * (W + 0.2), 0.22, L.sideWallEnd + 0.35);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, FLIPPER.len), chrome); bar.position.z = FLIPPER.len / 2;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, FLIPPER.len - 0.3), rubber); pad.position.set(-sx * 0.04, 0, FLIPPER.len / 2);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 16), chrome);
      pivot.add(bar, pad, post);
      this.group.add(pivot);
      this.flips.push({ pivot, side: sx });
    }
    // kicker: slot lamp on the back wall + plunger
    this.kickLamp = new THREE.MeshBasicMaterial({ color: 0xff5030, toneMapped: false });
    const slot = new THREE.Mesh(new THREE.BoxGeometry(2 * W - 0.4, 0.08, 0.02), this.kickLamp);
    slot.position.set(0, L.pusherH + 0.85, L.backWallZ + 0.01); this.group.add(slot);
    this.plunger = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.66, 1.0), new THREE.MeshPhysicalMaterial({ color: 0xff5030, metalness: 0.5, roughness: 0.3, clearcoat: 1, emissive: 0x401000 }));
    this.plunger.visible = false; this.group.add(this.plunger);
    // meter tube beside the lucky wheel
    const tp = this.tubePos = new THREE.Vector3(wheelPos.x + 2.2, 5.2, wheelPos.z + 1.0);
    this.tubeH = 2.4;
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, this.tubeH, 28, 1, true), glass); tube.position.set(tp.x, tp.y + this.tubeH / 2, tp.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.4, 28), new THREE.MeshPhysicalMaterial({ color: 0x15151a, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    base.position.set(tp.x, tp.y - 0.2, tp.z);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.06, 8, 28), chrome); cap.rotation.x = Math.PI / 2; cap.position.set(tp.x, tp.y + this.tubeH, tp.z);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, tp.y - 0.4 - 3.6, 12), chrome); stand.position.set(tp.x, (tp.y - 0.4 + 3.6) / 2, tp.z);
    this.meterLed = new THREE.MeshBasicMaterial({ color: 0x7CFFB2, toneMapped: false });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, this.tubeH, 0.06), this.meterLed); led.position.set(tp.x, tp.y + this.tubeH / 2, tp.z + 0.66);
    this.group.add(tube, base, cap, stand, led);
    // stacked medals (instanced) inside
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 28);
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xd7dbe2, metalness: 1, roughness: 0.25 });
    this.stack = new THREE.InstancedMesh(coinGeo, this.coinMat, 14);
    this.stack.count = 0; this.group.add(this.stack);
    // chute from the shelf corner up to the tube top
    const W2 = W;
    this.chute = new THREE.CatmullRomCurve3([
      new THREE.Vector3(W2 - 0.4, 2.6, L.dropZ - 0.9), new THREE.Vector3(W2 + 0.3, 3.9, L.backWallZ + 0.2),
      new THREE.Vector3(W2 + 0.9, 6.0, L.backWallZ - 0.3), new THREE.Vector3(tp.x - 0.4, tp.y + this.tubeH + 0.9, tp.z), new THREE.Vector3(tp.x, tp.y + this.tubeH + 0.5, tp.z),
    ]);
    for (const off of [-0.32, 0.32]) {
      const pts = this.chute.getPoints(60).map(p => p.clone().add(new THREE.Vector3(0, -0.45, off)));
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.03, 6, false), chrome));
    }
    this.flying = [];
    this.flyMesh = new THREE.InstancedMesh(coinGeo, this.coinMat, 16);
    this.flyMesh.count = 0; this.group.add(this.flyMesh);
    this.shown = 0; this.dump = 0; this.t = 0;
  }

  // OUT zones at both ends of the front edge (upper difficulties): hazard-striped strips
  setOutZone(w) {
    if (w === this.outW) return;
    this.outW = w;
    if (this.outG) { this.group.remove(this.outG); this.outG = null; }
    if (!w) return;
    if (!this.outTex) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#ff1a1a'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#1a0000';
      for (let x = -64; x < 256; x += 40) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 20, 64); g.lineTo(x + 84, 0); g.lineTo(x + 64, 0); g.fill(); }
      g.fillStyle = '#fff'; g.font = '900 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeStyle = '#000'; g.lineWidth = 8; g.strokeText('OUT', 128, 34); g.fillText('OUT', 128, 34);
      this.outTex = new THREE.CanvasTexture(c); this.outTex.colorSpace = THREE.SRGBColorSpace;
      this.outMat = new THREE.MeshBasicMaterial({ map: this.outTex, toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false });
    }
    this.outG = new THREE.Group();
    for (const sx of [-1, 1]) {
      // on the front face of the field edge (the field itself is covered by medals) ...
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), this.outMat);
      m.position.set(sx * (this.W - w / 2), -0.3, L.frontZ + 0.03);
      // ... plus a glowing boundary post at the inner end of the zone
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), new THREE.MeshBasicMaterial({ color: 0xff1a1a, toneMapped: false }));
      post.position.set(sx * (this.W - w), -0.1, L.frontZ + 0.05);
      this.outG.add(m, post);
    }
    this.group.add(this.outG);
  }

  // a caught medal starts its ride from the cup
  addCatch(x, y, z) { this.flying.push({ from: new THREE.Vector3(x, y, z), t: 0 }); }
  // the wheel starts: the tube empties into it
  empty() { this.dump = 1; }

  update(dt, st, opt) {
    this.t += dt;
    const { ttAngle, flipL, flipR, kickZ, kickX, meter, tt, flip, meterOn } = st;
    if (this.outMat) this.outMat.opacity = 0.65 + 0.25 * Math.sin(this.t * 4);
    for (const t of this.tts) t.g.rotation.y = -ttAngle * t.w;
    this.tts.forEach(t => { t.g.parent.visible = tt; });
    this.rimMat.color.setHSL(st.ttOn ? (this.t * 0.5) % 1 : 0.12, 1, st.ttOn ? 0.55 : 0.4);
    [flipL, flipR].forEach((a, i) => {
      const f = this.flips[i];
      f.pivot.visible = flip;
      f.pivot.rotation.y = Math.atan2(-f.side * Math.sin(a), Math.cos(a));
    });
    // kicker
    const active = kickZ > L.backWallZ - 0.7;
    this.plunger.visible = active;
    if (active) this.plunger.position.set(kickX, L.pusherH + 0.45, kickZ);
    this.kickLamp.color.setHSL(0.03, 1, opt.kickWarn ? 0.4 + 0.3 * Math.sin(this.t * 30) : active ? 0.6 : 0.12);
    // meter tube
    const vis = meterOn;
    this.stack.visible = this.flyMesh.visible = vis;
    const m4 = new THREE.Matrix4(), tp = this.tubePos;
    if (this.dump > 0) { this.dump = Math.max(0, this.dump - dt * 1.4); }
    const target = Math.min(12, meter);
    const n = this.dump > 0 ? Math.round(this.shown * this.dump) : target;
    if (this.dump <= 0) this.shown = target;
    this.stack.count = n;
    for (let i = 0; i < n; i++) {
      m4.makeRotationY(i * 0.7).setPosition(tp.x + Math.sin(i * 2.3) * 0.05, tp.y + 0.1 + i * 0.17, tp.z + Math.cos(i * 1.7) * 0.05);
      this.stack.setMatrixAt(i, m4);
    }
    this.stack.instanceMatrix.needsUpdate = true;
    this.meterLed.color.setHSL(0.4, 1, 0.3 + 0.3 * target / 12 + (target >= 12 ? 0.2 * Math.sin(this.t * 20) : 0));
    // medals riding the chute
    let k = 0;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      let p;
      if (f.t < 0.35) { const u = f.t / 0.35; p = f.from.clone().lerp(this.chute.getPoint(0), u); p.y += Math.sin(u * Math.PI) * 1.2; }
      else { const u = Math.min(1, (f.t - 0.35) / 1.3); p = this.chute.getPoint(u); }
      if (f.t > 1.65) { this.flying.splice(i, 1); continue; }
      if (k < 16) { m4.makeRotationX(f.t * 9).setPosition(p.x, p.y, p.z); this.flyMesh.setMatrixAt(k++, m4); }
    }
    this.flyMesh.count = k;
    this.flyMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}
