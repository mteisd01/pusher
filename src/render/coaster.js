// Ball coaster: a chrome twin-rail track on the right side deck of the cabinet. A JP ball
// leaves a gate behind the LED pole, runs switchbacks, a vertical loop and a double spiral,
// and a 3-way switch sends it onto the overhead field rail (it drops through a trap door a
// little off the middle of the table), into the SUPER funnel (croon from stage 2) or the
// PREMIUM funnel (croon from the final stage). The run follows the track with energy-conserving speed
// (gravity along the slope, rolling friction, a minimum speed) so it always completes;
// at the exit the ball is handed to the real physics with the track velocity.
import * as THREE from 'three';
import { L } from '../core/layout.js';
import { makeBallTexture } from './textures.js';
import { fieldRailZ, fieldRailReach } from '../game/balance.js';

const G = 16;            // track gravity (visual pace)
const BALL_R = 0.6;
const GAUGE = 0.17;      // half distance between the rails
const DROP = 0.5;        // rails sit this far below the ball centre (ball radius projection)
export const ROUTES = ['field', 'super', 'premium'];
const ROUTE_COLOR = { field: 0x4fc3ff, super: 0xc070ff, premium: 0xffd34d };
const FUNNEL_ROUTES = ['super', 'premium'];

// side vectors (horizontal-ish, continuous) and rail normals along a sampled curve
function frames(pts) {
  const up = new THREE.Vector3(0, 1, 0), out = [];
  let prev = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    let s = new THREE.Vector3().crossVectors(t, up);
    if (s.lengthSq() < 0.02) s = prev ? prev.clone() : new THREE.Vector3(1, 0, 0);
    s.normalize();
    if (prev && s.dot(prev) < 0) s.negate();
    const n = new THREE.Vector3().crossVectors(s, t).normalize(); // "up" of the track
    out.push({ t, s, n });
    prev = s;
  }
  return out;
}

export class BallCoaster {
  constructor(scene, audio, W) {
    this.scene = scene; this.audio = audio; this.W = W;
    this.group = new THREE.Group();
    scene.add(this.group);
    // centre of the right side deck; on narrow tables the coaster stands beside the cabinet
    // (clear of the lucky wheel, the meter tube and the LED pole)
    this.xc = Math.max(W + 2.35, 13.3);
    this.deckY = this.xc < W + 3.4 ? 3.7 : -4.5;
    this.queue = [];
    this.run = null;
    this.t = 0;
    this._build();
  }

  // --- track design (absolute coordinates). local X offset from the deck centre.
  _common() {
    const X = this.xc, v = (x, y, z) => new THREE.Vector3(X + x, y, z);
    const p = [];
    p.push(v(0.2, 11.2, -13.6), v(0.35, 10.9, -12.6), v(0.6, 10.5, -11.4));
    // switchback 1: forward, turn left, back, turn right, forward
    p.push(v(0.7, 10.0, -9.6), v(0.7, 9.7, -8.4));
    for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; p.push(v(0.7 * Math.cos(a), 9.6 - k * 0.05, -8.4 + 0.65 * Math.sin(a))); }
    p.push(v(-0.7, 9.15, -8.6), v(-0.7, 8.9, -9.6));
    for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; p.push(v(-0.7 * Math.cos(a), 8.8 - k * 0.05, -9.6 - 0.6 * Math.sin(a))); }
    p.push(v(0.7, 8.4, -9.4), v(0.7, 8.2, -8.0), v(0.65, 7.6, -6.6));
    // steep drop into a vertical loop (y-z plane, small sideways drift so the track clears itself)
    const lc = { y: 6.0 + 0.95, z: -4.6 }, R = 0.95;
    p.push(v(0.55, 6.5, -5.6), v(0.5, 6.05, -4.95));
    for (let k = 1; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      p.push(v(0.5 - 0.55 * k / 16, lc.y - Math.cos(a) * R, lc.z + Math.sin(a) * R));
    }
    p.push(v(-0.08, 6.0, -4.1), v(-0.1, 5.95, -3.4));
    // double spiral around a vertical axis
    const sc = { x: 0.0, z: -2.0 }, sr = 0.85, turns = 2, y0 = 5.85, y1 = 4.95;
    const a0 = Math.atan2(-3.4 - sc.z + 0.55, -0.1 - sc.x);
    for (let k = 0; k <= 28; k++) {
      const a = a0 + k / 28 * turns * Math.PI * 2;
      p.push(v(sc.x + Math.cos(a) * sr, y0 + (y1 - y0) * k / 28, sc.z + Math.sin(a) * sr));
    }
    p.push(v(0.0, 4.9, -0.6), v(0.0, 4.85, -0.1)); // switch
    return p;
  }

  _tail(route) {
    const W = this.W, X = this.xc, v = (x, y, z) => new THREE.Vector3(x, y, z);
    const s = v(X, 4.85, -0.1);
    if (route === 'field') {
      // overhead rail across the front of the table; the ball drops at the chosen x (trap door)
      const z = fieldRailZ(), xl = -fieldRailReach(W);
      return [s, v(X - 0.4, 4.75, 0.5), v(X - 0.95, 4.66, z - 0.35), v(Math.min(X - 1.3, W + 1.0), 4.58, z), v(W - 0.5, 4.5, z), v(0, 4.36, z), v(xl, 4.22, z)];
    }
    if (route === 'super') return [s, v(X + 0.45, 4.75, -0.45), v(X + 0.8, 4.6, -0.75)];
    // premium: short drop into the gold funnel right after the switch
    return [s, v(X + 0.55, 4.75, 0.3), v(X + 0.85, 4.6, 0.55)];
  }

  _sample(points, step = 0.06) {
    const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const len = c.getLength(), n = Math.max(8, Math.ceil(len / step));
    const pts = c.getSpacedPoints(n);
    return { curve: c, pts, len, ds: len / n, fr: frames(pts) };
  }

  _rails(path, mat, segs) {
    for (const off of [-1, 1]) {
      const pts = path.pts.map((p, i) => p.clone().addScaledVector(path.fr[i].s, off * GAUGE).addScaledVector(path.fr[i].n, -DROP + 0.12));
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs || pts.length, 0.04, 6, false), mat));
    }
    // cross ties every ~0.5
    const tieGeo = new THREE.BoxGeometry(GAUGE * 2 + 0.1, 0.035, 0.05);
    const every = Math.max(1, Math.round(0.5 / path.ds));
    for (let i = 0; i < path.pts.length; i += every) {
      const f = path.fr[i];
      const m = new THREE.Mesh(tieGeo, this.tieMat);
      const basis = new THREE.Matrix4().makeBasis(f.s, f.n, f.t);
      m.quaternion.setFromRotationMatrix(basis);
      m.position.copy(path.pts[i]).addScaledVector(f.n, -DROP + 0.08);
      this.group.add(m);
    }
  }

  _build() {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f2f6, metalness: 1, roughness: 0.08 });
    this.tieMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.35 });
    this.common = this._sample(this._common());
    this.tails = {};
    for (const r of ROUTES) this.tails[r] = this._sample(this._tail(r));
    this._rails(this.common, chrome);
    for (const r of ROUTES) this._rails(this.tails[r], chrome);
    // supports: posts from the track down to the deck (skip loop/spiral interiors)
    const postMat = new THREE.MeshStandardMaterial({ color: 0xbfc3c9, metalness: 1, roughness: 0.25 });
    const deckY = this.deckY;
    const addPost = (p, f) => {
      const top = p.clone().addScaledVector(f.n, -DROP);
      const h = top.y - deckY; if (h < 0.3) return;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 8), postMat);
      m.position.set(top.x, deckY + h / 2, top.z); this.group.add(m);
    };
    const cp = this.common.pts, cf = this.common.fr;
    for (let i = 0; i < cp.length; i += Math.round(1.1 / this.common.ds)) {
      const p = cp[i];
      if (p.z > -5.8 && p.z < -3.4 && p.y > 5.9) continue; // loop
      if (Math.hypot(p.x - this.xc, p.z + 2.0) < 1.1 && p.y < 5.9 && p.y > 4.9) continue; // spiral column has its own post
      addPost(p, cf[i]);
    }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.0 - deckY, 12), postMat);
    col.position.set(this.xc, (6.0 + deckY) / 2, -2.0); this.group.add(col);
    { const t = this.tails.field, i = Math.round(t.pts.length * 0.12); addPost(t.pts[i], t.fr[i]); }
    // the overhead field rail hangs from the cabinet top on thin rods (kept out of the field)
    const fp = this.tails.field.pts;
    for (const k of [0.45, 0.75, 1]) {
      const p = fp[Math.min(fp.length - 1, Math.round((fp.length - 1) * k))];
      const h = 9.6 - p.y; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 6), postMat);
      m.position.set(p.x, p.y + h / 2 - 0.3, p.z); this.group.add(m);
    }
    // trap door marker that slides along the field rail to where the ball will drop
    this.doorMat = new THREE.MeshBasicMaterial({ color: ROUTE_COLOR.field, toneMapped: false, transparent: true, opacity: 0 });
    this.door = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24), this.doorMat);
    this.door.rotation.x = Math.PI / 2; this.door.position.set(0, fp[fp.length - 1].y - 0.55, fieldRailZ());
    this.group.add(this.door);
    // start gate box with a lamp
    const gate = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshPhysicalMaterial({ color: 0x15151a, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    this.gateLamp = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), this.gateLamp); lamp.position.set(0, 0.55, 0.2);
    gate.add(box, lamp);
    const sp = this.common.pts[0];
    gate.position.set(sp.x, sp.y - 0.1, sp.z - 0.55);
    const gpost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, sp.y - 0.6 - deckY, 10), postMat);
    gpost.position.set(sp.x, (sp.y - 0.6 + deckY) / 2, sp.z - 0.55);
    this.group.add(gate, gpost);
    // 3-way switch: a hub with a turning flapper and three route lamps
    const sw = this.tails.field.pts[0];
    this.switchG = new THREE.Group(); this.switchG.position.set(sw.x, sw.y - 0.62, sw.z);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 24), new THREE.MeshPhysicalMaterial({ color: 0x1a1a22, metalness: 0.7, roughness: 0.3, clearcoat: 1 }));
    this.flap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.7), chrome); this.flap.position.y = 0.3;
    this.switchG.add(hub, this.flap);
    this.routeLamps = {};
    ROUTES.forEach((r, i) => {
      const m = new THREE.MeshBasicMaterial({ color: ROUTE_COLOR[r], toneMapped: false });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), m);
      const a = -0.9 + i * 0.9; l.position.set(Math.sin(a) * 0.55, 0.1, Math.cos(a) * 0.55);
      this.switchG.add(l); this.routeLamps[r] = m;
    });
    const spost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, sw.y - 0.75 - deckY, 10), postMat);
    spost.position.set(sw.x, (sw.y - 0.75 + deckY) / 2, sw.z);
    this.group.add(this.switchG, spost);
    // SUPER / PREMIUM funnels at the end of the short branches (straight to the croon tower)
    this.funnelMats = {};
    for (const r of FUNNEL_ROUTES) {
      const je = this.tails[r].pts[this.tails[r].pts.length - 1];
      const mat = new THREE.MeshPhysicalMaterial({ color: ROUTE_COLOR[r], metalness: 1, roughness: 0.2, emissive: ROUTE_COLOR[r], emissiveIntensity: 0.1, side: THREE.DoubleSide });
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.22, 0.5, 24, 1, true), mat);
      funnel.position.set(je.x, je.y - 0.7, je.z); this.group.add(funnel);
      const fpost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, je.y - 0.95 - deckY, 12), postMat);
      fpost.position.set(je.x, (je.y - 0.95 + deckY) / 2, je.z); this.group.add(fpost);
      this.funnelMats[r] = mat;
    }
    // chasing LED dots along the common track
    const n = Math.floor(this.common.len / 0.7);
    this.leds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const k = Math.floor(i / n * cp.length), f = cf[k];
      const p = cp[k].clone().addScaledVector(f.s, GAUGE + 0.12).addScaledVector(f.n, -DROP + 0.1);
      m4.makeTranslation(p.x, p.y, p.z); this.leds.setMatrixAt(i, m4); this.leds.setColorAt(i, new THREE.Color(0.3, 0.3, 0.3));
    }
    this.group.add(this.leds);
    // the ball
    const ballMat = new THREE.MeshPhysicalMaterial({ map: makeBallTexture(), metalness: 0.85, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), ballMat);
    this.ball.visible = false; this.group.add(this.ball);
    this.ballLight = new THREE.PointLight(0xffd34d, 0, 4, 2); this.group.add(this.ballLight);
  }

  get busy() { return !!this.run || this.queue.length > 0; }

  // queue a ball; route chosen by the game. onExit(route, pos, vel) when it leaves the track.
  // dropX: where a field ball falls through the trap door of the overhead rail
  launch(route, onExit, dropX = 0) { this.queue.push({ route, onExit, dropX }); }

  _start(q) {
    this.run = { ...q, path: this.common, s: 0, v: 1.2, phase: 'gate', t: 0, spin: 0, lastTie: 0 };
    this.ball.visible = true;
    this.audio.reelTick && this.audio.reelTick();
  }

  update(dt) {
    this.t += dt;
    if (!this.run && this.queue.length) this._start(this.queue.shift());
    const r = this.run;
    // idle / attract lights
    const cnt = this.leds.count;
    const head = r ? r.s / this.common.len : (this.t * 0.15) % 1;
    const c = new THREE.Color();
    for (let i = 0; i < cnt; i++) {
      const d = Math.abs(i / cnt - head);
      const on = r ? (r.path === this.common && d < 0.04 ? 1 : 0.15) : (d < 0.03 ? 0.7 : 0.12);
      c.setHSL(r ? 0.13 : (i / cnt + this.t * 0.1) % 1, 1, 0.15 + on * 0.5);
      this.leds.setColorAt(i, c);
    }
    this.leds.instanceColor.needsUpdate = true;
    this.gateLamp.color.setHSL(0.13, 1, r && r.phase === 'gate' ? 0.5 + 0.3 * Math.sin(this.t * 30) : 0.35);
    // switch lamps: roulette while the ball is on the common track, then the chosen route
    const nearSwitch = r && r.path === this.common && r.s > this.common.len * 0.55;
    ROUTES.forEach((rt, i) => {
      let l = 0.2;
      if (r && r.path === this.common && nearSwitch) l = Math.floor(this.t * 12) % 3 === i ? 0.65 : 0.15;
      else if (r && r.path !== this.common) l = rt === r.route ? 0.5 + 0.25 * Math.sin(this.t * 20) : 0.1;
      this.routeLamps[rt].color.setHex(ROUTE_COLOR[rt]).multiplyScalar(l * 2);
    });
    const flapTarget = r && r.path !== this.common ? { field: -0.6, super: 0.0, premium: 0.6 }[r.route] : Math.sin(this.t * 0.7) * 0.6;
    this.flap.rotation.y += (flapTarget - this.flap.rotation.y) * Math.min(1, dt * 10);
    for (const fr of FUNNEL_ROUTES) this.funnelMats[fr].emissiveIntensity = r && r.route === fr && r.path !== this.common ? 1.2 + Math.sin(this.t * 25) * 0.4 : 0.1;
    // trap door marker: shows where a field ball will drop
    const showDoor = r && r.route === 'field' && r.path !== this.common;
    if (showDoor) this.door.position.x = r.dropX;
    this.doorMat.opacity = showDoor ? 0.6 + 0.4 * Math.sin(this.t * 18) : 0;
    if (!r) { this.ballLight.intensity = 0; return; }
    r.t += dt; r.dt = dt;
    if (r.phase === 'gate') { if (r.t > 0.6) r.phase = 'run'; else { this._place(r); return; } }
    if (r.phase === 'funnel') {
      this.ball.position.y -= dt * (2 + r.t * 8);
      this.ball.scale.setScalar(Math.max(0.01, 1 - r.t * 1.5));
      if (r.t > 0.6) this._finish();
      return;
    }
    // integrate along the path with substeps
    const P = r.path, sub = 4, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const i = Math.min(P.pts.length - 2, Math.floor(r.s / P.ds));
      const slope = (P.pts[i + 1].y - P.pts[i].y) / P.ds;     // dy/ds
      r.v += (-G * slope - 0.6 - 0.02 * r.v * r.v) * h;
      // the loop needs speed at the top; a real track would be designed for it
      r.v = Math.max(r.v, P === this.tails.field ? 3.2 : 1.6);
      r.s += r.v * h;
      // field rail: the trap door opens at the chosen x
      if (P === this.tails.field && r.s > P.len * 0.2) {
        const j = Math.min(P.pts.length - 1, Math.floor(r.s / P.ds));
        if (P.pts[j].x <= r.dropX || j >= P.pts.length - 1) { r.s = j * P.ds; this._place(r); this._exit(); return; }
      }
      if (r.s >= P.len) {
        if (P === this.common) {
          r.path = this.tails[r.route]; r.s -= P.len;
          this.audio.reelTick && this.audio.reelTick();
          this.audio.bell && this.audio.bell(r.route === 'premium' ? 1568 : r.route === 'super' ? 1318 : 1046, 0.35, 0.05);
        } else { this._exit(); return; }
      }
    }
    this._place(r);
    // rattle over rail joints + rolling noise
    if (Math.floor(r.s / 0.5) !== r.lastTie) { r.lastTie = Math.floor(r.s / 0.5); if (r.v > 4 && Math.random() < 0.5) this.audio.reelTick && this.audio.reelTick(); }
    this.audio.croonRoll && this.audio.croonRoll(Math.min(1.2, r.v / 7));
  }

  _place(r) {
    const P = r.path, i = Math.min(P.pts.length - 1, Math.floor(r.s / P.ds));
    const a = P.pts[i], b = P.pts[Math.min(P.pts.length - 1, i + 1)], f = P.fr[i];
    const k = r.s / P.ds - i;
    this.ball.position.lerpVectors(a, b, Math.min(1, Math.max(0, k)));
    // roll: rotate around the side axis by distance / radius
    this.ball.rotateOnWorldAxis(f.s, r.v * (r.dt || 0.016) / BALL_R);
    this.ballLight.intensity = 2.5;
    this.ballLight.position.copy(this.ball.position);
  }

  _exit() {
    const r = this.run, P = r.path;
    if (r.route !== 'field') {
      r.phase = 'funnel'; r.t = 0;
      this.audio.croonStop && this.audio.croonStop();
      this.audio.croonHole && this.audio.croonHole(true);
      return;
    }
    // field: the ball falls straight through the trap door (small sideways speed so it stays off the gutters)
    const b = this.ball.position;
    this.audio.croonStop && this.audio.croonStop();
    r.onExit && r.onExit(r.route, { x: b.x, y: b.y - 0.2, z: b.z }, { x: -0.4, y: -1, z: 0.3 });
    this.ball.visible = false;
    this.run = null;
    this.ballLight.intensity = 0;
  }

  _finish() {
    const r = this.run;
    this.ball.visible = false; this.ball.scale.setScalar(1);
    this.run = null; this.ballLight.intensity = 0;
    r.onExit && r.onExit(r.route, null, null);
  }

  // ball positions for headless/e2e checks
  get state() { return this.run ? { route: this.run.route, s: this.run.s, onTail: this.run.path !== this.common } : null; }

  dispose() { this.scene.remove(this.group); }
}
