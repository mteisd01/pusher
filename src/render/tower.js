// 3D jackpot tower beside the screen: a JP ball rides a glass lift, rolls down a spiral
// rail and drops through three rotating croon dishes. The ball and dishes are driven by
// the real croon physics (src/core/croonPhysics.js) running in the physics engine.
import * as THREE from 'three';
import { CROON_DISH, dishGeometry, holeLayout } from '../core/croonPhysics.js';
import { makeBallTexture } from './textures.js';

const TAU = Math.PI * 2;
const STAGE_SCALE = [0.86, 0.78, 0.7];
const STAGE_Y = [11.2, 8.75, 6.35];
const SPIN = [0.75, -0.95, 1.15];

function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(4, 8, 120, 48, 14); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.font = `900 ${text.length > 3 ? 26 : 32}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText(text, 64, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, toneMapped: false }));
  s.scale.set(0.9, 0.45, 1);
  return s;
}

export class CroonTower {
  constructor(scene, stage, audio, screen) {
    this.scene = scene; this.stage = stage; this.audio = audio;
    this.x = -(screen.w / 2 + 2.45);
    this.z = screen.z + 0.25;
    this.group = new THREE.Group();
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
    this.active = false;
    this.anim = null;
    this.dishes = [];
    this.idleT = 0;
    this._build();
  }

  _build() {
    const g = this.group;
    const chrome = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, metalness: 1, roughness: 0.1 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.14, roughness: 0.03, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    // base pedestal and central column
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 32), new THREE.MeshPhysicalMaterial({ color: 0x15151a, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    base.position.y = 4.95; g.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.6, 12), chrome); col.position.y = 9.2; g.add(col);
    // glass enclosures per stage
    for (let i = 0; i < 3; i++) {
      const R = CROON_DISH.R * STAGE_SCALE[i] + 0.08, y = STAGE_Y[i];
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.0, 40, 1, true), glass); cyl.position.y = y + 0.35; g.add(cyl);
      for (const dy of [-0.15, 0.85]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 8, 48), dy < 0 ? chrome : this.ringMat);
        ring.rotation.x = Math.PI / 2; ring.position.y = y + dy; g.add(ring);
      }
      // underglow
      const glow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = y - 0.22; g.add(glow);
    }
    // dome on top
    const dome = new THREE.Mesh(new THREE.SphereGeometry(CROON_DISH.R * STAGE_SCALE[0] + 0.08, 32, 12, 0, TAU, 0, Math.PI / 2), glass);
    dome.position.y = STAGE_Y[0] + 0.85; g.add(dome);
    const topper = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), this.ringMat); topper.position.y = STAGE_Y[0] + 2.65; g.add(topper);
    // spiral rail above stage 1
    const helix = [];
    const top = STAGE_Y[0] + 2.4, bot = STAGE_Y[0] + 0.55, turns = 1.6, hr = 1.25;
    for (let i = 0; i <= 80; i++) { const k = i / 80, a = k * turns * TAU; helix.push(new THREE.Vector3(Math.cos(a) * hr, top + (bot - top) * k, Math.sin(a) * hr)); }
    this.helix = new THREE.CatmullRomCurve3(helix);
    for (const off of [-0.11, 0.11]) {
      const pts = helix.map(p => { const r = Math.hypot(p.x, p.z); return new THREE.Vector3(p.x / r * (r + off), p.y - 0.12, p.z / r * (r + off)); });
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.035, 6, false), chrome);
      g.add(rail);
    }
    // glass lift tube on the outer side
    this.liftX = -2.35;
    const liftH = top - 0.2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, liftH, 20, 1, true), glass);
    tube.position.set(this.liftX, liftH / 2, 0); g.add(tube);
    this.liftLeds = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    for (const sx of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, liftH, 0.05), this.liftLeds); strip.position.set(this.liftX + sx * 0.36, liftH / 2, 0.1); g.add(strip); }
    const bridge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(this.liftX, top + 0.05, 0), new THREE.Vector3(hr, top, 0)), 8, 0.035, 6, false), chrome);
    g.add(bridge);
    // ball
    const ballMat = new THREE.MeshPhysicalMaterial({ map: makeBallTexture(), metalness: 0.85, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), ballMat);
    this.ball.visible = false; g.add(this.ball);
    this.ballLight = new THREE.PointLight(0xffd34d, 0, 3, 2); g.add(this.ballLight);
    // initial (idle) dishes with a neutral layout
    this.setLayouts([4, 3, 4].map(n => ({ holes: Array.from({ length: n }, (_, k) => ({ label: k % 2 ? '·' : '★', color: k % 2 ? '#7a1f1f' : '#2e7d32', good: !(k % 2) })) })), 0);
  }

  setLayouts(stages, luck) {
    for (const d of this.dishes) { this.group.remove(d.group); d.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.dishes = stages.map((st, i) => {
      const layout = holeLayout(st.holes, luck);
      const geo = dishGeometry(layout, 22, 120);
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
      bg.setIndex(new THREE.BufferAttribute(geo.indices, 1));
      // vertex colours: sector of each hole tinted with its colour, chrome-ish rim
      const n = geo.positions.length / 3, colors = new Float32Array(n * 3), c = new THREE.Color();
      const holeCols = st.holes.map(h => new THREE.Color(h.color || '#555'));
      for (let v = 0; v < n; v++) {
        const x = geo.positions[v * 3], z = geo.positions[v * 3 + 2], r = Math.hypot(x, z);
        let a = Math.atan2(z, x); if (a < 0) a += TAU;
        const k = Math.round(a / TAU * layout.length) % layout.length;
        if (r > CROON_DISH.R - 0.05) c.set('#d8d8e0');
        else if (r < 0.35) c.set('#ffd34d');
        else c.copy(holeCols[k]).lerp(new THREE.Color('#ffffff'), r > CROON_DISH.valley ? 0.25 : 0.05);
        colors.set([c.r, c.g, c.b], v * 3);
      }
      bg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      bg.computeVertexNormals();
      const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(bg, mat);
      const dg = new THREE.Group();
      dg.add(mesh);
      // hole rims + labels
      layout.forEach((h, k) => {
        const hx = Math.cos(h.a) * CROON_DISH.valley, hz = Math.sin(h.a) * CROON_DISH.valley;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(h.r, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: st.holes[k].good ? '#ffe680' : '#ff8080', toneMapped: false }));
        rim.rotation.x = Math.PI / 2; rim.position.set(hx, 0.01, hz); dg.add(rim);
        const lab = labelSprite(st.holes[k].label || '', st.holes[k].color || '#fff');
        const lr = CROON_DISH.valley + 0.62;
        lab.position.set(Math.cos(h.a) * lr, 0.55, Math.sin(h.a) * lr); dg.add(lab);
      });
      const s = STAGE_SCALE[i];
      dg.scale.setScalar(s);
      dg.position.y = STAGE_Y[i];
      this.group.add(dg);
      return { group: dg, layout, angle: Math.random() * TAU };
    });
  }

  // Runs the three stages. Resolves with { stage, hole } like the 2D croon.
  run(stages, luck, physics, opts = {}) {
    this.physics = physics;
    this.stages = stages;
    this.setLayouts(stages, luck);
    this.active = true;
    this.result = null;
    this.camFocus = opts.camera !== false;
    this._focus(0);
    this.audio.setMood('croon');
    return new Promise(res => {
      this.resolve = res;
      this._lift();
    });
  }

  // camera looks down into the dish of stage i (from the player's side, slightly right)
  _focus(i) {
    if (!this.camFocus) return;
    const y = STAGE_Y[i];
    this.stage.setFocus({ look: new THREE.Vector3(this.x, y - 0.6, this.z), pos: new THREE.Vector3(this.x * 0.7, y + 6.2, this.z + 7.2) });
  }

  _lift() {
    this.ball.visible = true;
    this.ball.scale.setScalar(CROON_DISH.ball * STAGE_SCALE[0]);
    this.anim = { kind: 'lift', t: 0, dur: 1.6 };
    this.audio.sweep && this.audio.sweep(300, 900, 1.4, 0.12);
  }

  _startStage(i) {
    this.si = i;
    const d = this.dishes[i];
    this._focus(i);
    this.physics.cmd('croonStart', d.layout, SPIN[i]);
    this.anim = { kind: 'play', t: 0 };
    this.lastS = null;
  }

  // physics frame (msg.croon)
  onPhysics(c) {
    if (!this.active || !c || !this.anim || this.anim.kind !== 'play') return;
    if (c.s) this.lastS = c.s;
    if (c.hole >= 0) this._hole(c.hole);
  }

  _hole(k) {
    const i = this.si, hole = this.stages[i].holes[k];
    this.audio.croonStop();
    this.audio.croonHole(!!hole.good);
    this.result = { stage: i, hole };
    const last = !hole.good || i === this.stages.length - 1;
    this.anim = { kind: last ? 'end' : 'drop', t: 0, dur: last ? 1.4 : 0.9, k };
  }

  update(dt) {
    const t0 = (this.idleT += dt);
    // idle: dishes spin slowly, lights breathe
    for (let i = 0; i < this.dishes.length; i++) {
      const d = this.dishes[i];
      if (this.active && this.anim && this.anim.kind === 'play' && i === this.si && this.lastS) d.angle = this.lastS[7];
      else d.angle += SPIN[i] * dt * (this.active ? 1 : 0.35);
      d.group.rotation.y = -d.angle;
    }
    this.ringMat.color.setHSL(this.active ? (t0 * 0.8) % 1 : 0.13, 1, this.active ? 0.6 : 0.45 + Math.sin(t0 * 2) * 0.08);
    this.liftLeds.color.setHSL(0.13, 1, this.active ? 0.5 + 0.3 * Math.sin(t0 * 14) : 0.35);
    const a = this.anim;
    if (!this.active || !a) { this.ballLight.intensity = 0; return; }
    a.t += dt;
    const b = this.ball;
    this.ballLight.intensity = 3;
    if (a.kind === 'lift') {
      const k = Math.min(1, a.t / a.dur), e = k * k * (3 - 2 * k);
      b.position.set(this.liftX, 0.6 + (this.helix.points[0].y - 0.6) * e, 0);
      if (k >= 1) this.anim = { kind: 'spiral', t: 0, dur: 1.9 };
    } else if (a.kind === 'spiral') {
      const k = Math.min(1, a.t / a.dur);
      const p = this.helix.getPoint(k * k);
      b.position.copy(p);
      this.audio.croonRoll(0.5);
      if (k >= 1) this._startStage(0);
    } else if (a.kind === 'play') {
      const s = this.lastS;
      if (s) {
        const sc = STAGE_SCALE[this.si];
        b.position.set(s[0] * sc, STAGE_Y[this.si] + s[1] * sc, s[2] * sc);
        b.quaternion.set(s[3], s[4], s[5], s[6]);
        b.scale.setScalar(CROON_DISH.ball * sc);
        this.audio.croonRoll(0.6);
      }
    } else if (a.kind === 'drop') {
      const k = Math.min(1, a.t / a.dur);
      const from = STAGE_Y[this.si], to = STAGE_Y[this.si + 1] + 0.4;
      b.position.y = from + (to - from) * k * k;
      b.position.x *= 0.92; b.position.z *= 0.92;
      if (k >= 1) this._startStage(this.si + 1);
    } else if (a.kind === 'end') {
      b.position.y -= dt * 3;
      if (a.t >= a.dur) this._finish();
    }
    this.ballLight.position.copy(b.position);
  }

  _finish() {
    this.active = false;
    this.anim = null;
    this.ball.visible = false;
    this.audio.croonStop();
    this.audio.setMood('normal');
    if (this.camFocus) this.stage.setFocus(null);
    const r = this.result; this.resolve && this.resolve(r);
  }

  // e.g. when the game is reset while a lottery is running
  abort() { if (this.active) { this.physics && this.physics.cmd('croonStop'); this.result = this.result || { stage: 0, hole: this.stages[0].holes[1] }; this._finish(); } }

  dispose() { this.scene.remove(this.group); }
}
