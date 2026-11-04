// Physics core (Rapier). Pure logic, no DOM: used by the worker, the inline
// fallback and the headless balance simulator (tools/sim.mjs).
import { L, KIND, POCKET, GIANT, CUP, cupXAt, BALLP, CRANE, TURNTABLE, FLIPPER, PACK_HEAD, ROCK } from './layout.js';

export class PusherPhysics {
  constructor(RAPIER, opts = {}) {
    this.R = RAPIER;
    this.hz = opts.hz || 60;
    this.world = new RAPIER.World({ x: 0, y: L.gravity, z: 0 });
    this.world.timestep = 1 / this.hz;
    this.setIterations(opts.iterations || 2);
    this.objs = [];
    this.map = new Map();
    this.time = 0;
    this.phase = 0;
    this.speed = 1;
    this.period = 3.4;
    this.strokeBonus = 0;
    this.wallsUp = false;
    this.paused = false;
    this.acc = 0;
    this.nextId = 1;
    this.queue = new RAPIER.EventQueue(true);
    this.surf = new Map();      // static collider handle -> surface type (1 plate, 2 glass, 3 wall)
    this.colObj = new Map();    // dynamic collider handle -> obj
    this.pairSeen = new Map();  // contact pair key -> last step it carried force (hysteresis)
    this.stepNo = 0;
    this.pusherVz = 0;
    this.hits = [];
    this._buildStatic();
  }

  setIterations(n) {
    try { this.world.integrationParameters.numSolverIterations = n; } catch (e) { /* older api */ }
  }
  setHz(hz) { this.hz = hz; this.world.timestep = 1 / hz; }

  _box(hx, hy, hz, x, y, z, fric = 0.3, rest = 0.05, surf = 1) {
    const c = this.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(fric).setRestitution(rest);
    const col = this.world.createCollider(c);
    this.surf.set(col.handle, surf);
    return col;
  }

  _buildStatic() {
    const R = this.R, W = L.halfW;
    // field floor, split around the center pocket
    const P = POCKET, pz0 = P.z - P.hd, pz1 = P.z + P.hd;
    this._box(W, 0.5, (pz0 - L.backZ) / 2, 0, -0.5, (pz0 + L.backZ) / 2, 0.3, 0.05);
    this._box(W, 0.5, (L.frontZ - pz1) / 2, 0, -0.5, (L.frontZ + pz1) / 2, 0.3, 0.05);
    for (const s of [-1, 1]) this._box((W - P.hw) / 2, 0.5, P.hd, s * (P.hw + (W - P.hw) / 2), -0.5, P.z, 0.3, 0.05);
    // pocket lid (kinematic): flush with the floor when closed, sinks when open
    this.lid = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(P.x, -0.5, P.z));
    const lc = this.world.createCollider(R.ColliderDesc.cuboid(P.hw - 0.01, 0.5, P.hd - 0.01).setFriction(0.3), this.lid);
    this.surf.set(lc.handle, 1);
    this.lidY = -0.5; this.pocketOpen = false;
    this.magnet = false;
    this.cupOn = false; this.cupX = 0;
    this.kickAfter = 30;
    this._box(W + 1, L.wallH / 2, 0.5, 0, L.pusherH + 0.07 + L.wallH / 2, L.backWallZ - 0.5, 0.15, 0.1, 3); // back wall over pusher
    this._box(W + 1, L.wallH / 2, 0.5, 0, L.wallH / 2, L.backZ - 0.5, 0.15, 0.1, 3);       // rear
    for (const s of [-1, 1]) {
      const z0 = L.backZ, z1 = L.sideWallEnd;
      this._box(0.5, L.wallH / 2, (z1 - z0) / 2, s * (W + 0.5), L.wallH / 2, (z0 + z1) / 2, 0.12, 0.1, 2);
      // gutter floor outside the side walls slopes away (catch -> lost)
    }
    // Retractable guard walls covering the side gutters
    this.guards = [];
    for (const s of [-1, 1]) {
      const b = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(s * (W + 0.5), -7, (L.sideWallEnd + L.frontZ) / 2));
      const gc = this.world.createCollider(R.ColliderDesc.cuboid(0.5, 1.5, (L.frontZ - L.sideWallEnd) / 2 + 0.05).setFriction(0.12), b);
      this.surf.set(gc.handle, 2);
      this.guards.push({ body: b, side: s, y: -7 });
    }
    this.pusher = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, L.pusherH / 2, this.pusherZ(0)));
    const pc = this.world.createCollider(
      R.ColliderDesc.cuboid(W - 0.02, L.pusherH / 2 - 0.005, L.pusherLen / 2).setFriction(0.4).setRestitution(0.02), this.pusher);
    this.surf.set(pc.handle, 1);
    this.pusherCol = pc.handle;
    this._buildDevices();
  }

  // ---------------------------------------------------------------- on-table devices
  _kin(x, y, z) { return this.world.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z)); }

  _buildDevices() {
    const R = this.R, W = L.halfW;
    // ball kicker: a plunger hidden in the back wall over the shelf
    this.kick = { body: this._kin(0, L.pusherH + 0.45, L.backWallZ - 0.9), state: 0, t: 0, x: 0, z: L.backWallZ - 0.9 };
    const kc = this.world.createCollider(R.ColliderDesc.cuboid(0.75, 0.33, 0.5).setFriction(0.2), this.kick.body);
    this.surf.set(kc.handle, 3);
    // turntables (slightly raised discs, they only turn while active)
    this.turntables = [];
    this.ttOn = false; this.ttAngle = 0;
    for (const sx of [-1, 1]) {
      const x = sx * (W - TURNTABLE.dx);
      const b = this._kin(x, 0.0, TURNTABLE.z);
      const c = this.world.createCollider(R.ColliderDesc.roundCylinder(0.006, TURNTABLE.r - 0.01, 0.01).setTranslation(0, 0, 0).setFriction(0.45), b);
      this.surf.set(c.handle, 1);
      this.turntables.push({ body: b, x, w: -sx * TURNTABLE.w });
    }
    // gutter flippers
    this.flippers = [];
    this.flipOn = false; this.flipT = 0;
    for (const sx of [-1, 1]) {
      const f = { side: sx, a: FLIPPER.rest, px: sx * (W + 0.2), pz: L.sideWallEnd + 0.35, body: null };
      f.body = this._kin(0, -3, 0);
      const c = this.world.createCollider(R.ColliderDesc.cuboid(0.1, 0.22, FLIPPER.len / 2).setFriction(0.2).setRestitution(0.3), f.body);
      this.surf.set(c.handle, 3);
      this._placeFlipper(f, true);
      this.flippers.push(f);
    }
    // crane claw: three kinematic fingers
    this.crane = { phase: 'idle', x: -(W - CRANE.parkDx), z: CRANE.parkZ, y: CRANE.idleY, tx: 0, claw: 1, t: 0, grabbed: [], fingers: [], slip: 0.25, maxGrab: 15, dropX: 0 };
    for (let i = 0; i < 3; i++) {
      const b = this._kin(0, CRANE.idleY - 0.5, CRANE.parkZ);
      const c = this.world.createCollider(R.ColliderDesc.capsule(CRANE.finger / 2, 0.08).setFriction(0.5), b);
      this.surf.set(c.handle, 3);
      this.crane.fingers.push(b);
    }
    this._placeClaw();
  }

  _placeFlipper(f, now) {
    // bar from the pivot along direction a (0 = +z, positive = towards the table centre)
    const dx = -f.side * Math.sin(f.a), dz = Math.cos(f.a), h = FLIPPER.len / 2;
    const pos = { x: f.px + dx * h, y: 0.22, z: f.pz + dz * h };
    const yaw = Math.atan2(dx, dz), q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    if (now) { f.body.setTranslation(pos, true); f.body.setRotation(q, true); }
    else { f.body.setNextKinematicTranslation(pos); f.body.setNextKinematicRotation(q); }
  }

  _placeClaw() {
    const c = this.crane, open = 1 - c.claw;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + 0.3;
      const tilt = -0.25 + open * 0.75;          // outward tilt of the finger
      const ca = Math.cos(a), sa = Math.sin(a), half = CRANE.finger / 2 + 0.08;
      const r = CRANE.hubR * 0.8 + Math.sin(tilt) * half;
      const pos = { x: c.x + ca * r, y: c.y - Math.cos(tilt) * half, z: c.z + sa * r };
      // rotate the capsule (y axis) by tilt around the tangent (-sa, 0, ca)
      const s2 = Math.sin(-tilt / 2), q = { x: -sa * s2, y: 0, z: ca * s2, w: Math.cos(-tilt / 2) };
      c.fingers[i].setNextKinematicTranslation(pos);
      c.fingers[i].setNextKinematicRotation(q);
    }
  }

  // highest surface/object top under the claw
  _craneFloor() {
    const c = this.crane;
    let top = c.z < this.pusherFrontAt(this.phase) - 0.3 ? L.pusherH : 0;
    for (const o of this.objs) {
      if (Math.hypot(o.x - c.x, o.z - c.z) < CRANE.grabR && o.y < 4) top = Math.max(top, o.y + (o.kind === KIND.BALL ? 0.6 : 0.1));
    }
    return top;
  }

  craneStart(maxGrab = 15, slip = 0.25) {
    const c = this.crane;
    if (c.phase !== 'idle') return;
    Object.assign(c, { phase: 'aim', t: 0, maxGrab, slip, tx: c.x });
  }
  craneAim(x) { this.crane.tx = Math.max(-(L.halfW - 1.1), Math.min(L.halfW - 1.1, x)); }
  craneDrop() { const c = this.crane; if (c.phase === 'aim') { c.phase = 'down'; c.t = 0; c.stopY = this._craneStop(); } }
  // claw height where the finger tips just dig into whatever is below (shelf, floor or pile)
  _craneStop() {
    const c = this.crane, surf = c.z < this.pusherFrontAt(this.phase) - 0.3 ? L.pusherH : 0;
    return Math.max(this._craneFloor() - 0.35, surf) + CRANE.finger + 0.05;
  }

  _setKinematic(o, on) {
    const T = this.R.RigidBodyType;
    o.body.setBodyType(on ? T.KinematicPositionBased : T.Dynamic, true);
  }

  _craneStep(h, ev) {
    const c = this.crane;
    if (c.phase === 'idle') return;
    c.t += h;
    const mv = (cur, tgt, sp) => cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), sp * h);
    switch (c.phase) {
      case 'aim': {
        c.claw = Math.max(0, c.claw - h / 0.5);
        c.x = mv(c.x, c.tx, 7);
        // front-back sweep (starts at the back end, eases in from the park position)
        const mid = (CRANE.z0 + CRANE.z1) / 2, amp = (CRANE.z1 - CRANE.z0) / 2;
        const zt = mid - Math.cos(c.t * CRANE.sweep * Math.PI) * amp;
        c.z = mv(c.z, zt, 6);
        if (c.t > 10) this.craneDrop();
        break;
      }
      case 'down':
        if (c.y - c.stopY < 1.5) c.stopY = this._craneStop();   // the pusher may move under the claw
        c.y = mv(c.y, c.stopY, 4.5);
        if (Math.abs(c.y - c.stopY) < 1e-3 || c.t > 2.5) { c.phase = 'close'; c.t = 0; ev.push({ t: 'crane', ph: 'close', x: c.x, z: c.z }); }
        break;
      case 'close':
        c.claw = Math.min(1, c.claw + h / 0.45);
        if (c.claw >= 1) {
          // grab what is inside the claw (items first)
          const tipY = c.y - CRANE.finger;
          const cand = this.objs.filter(o => !o.dead && !o.grab && Math.hypot(o.x - c.x, o.z - c.z) < CRANE.grabR && o.y > tipY - 0.45 && o.y < c.y + 0.3)
            .sort((a, b) => (b.kind > KIND.GOLD) - (a.kind > KIND.GOLD) || Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))
            .slice(0, c.maxGrab);
          for (const o of cand) {
            const t = o.body.translation();
            o.grab = { dx: t.x - c.x, dy: t.y - c.y, dz: t.z - c.z, slipAt: Math.random() < c.slip * (0.5 + Math.hypot(t.x - c.x, t.z - c.z) / CRANE.grabR) ? 0.2 + Math.random() * 1.2 : -1 };
            this._setKinematic(o, true);
            c.grabbed.push(o);
          }
          ev.push({ t: 'crane', ph: 'grab', n: cand.length, items: cand.filter(o => o.kind > KIND.GOLD).length });
          c.phase = 'up'; c.t = 0;
        }
        break;
      case 'up':
        c.y = mv(c.y, CRANE.idleY, 3);
        if (c.y >= CRANE.idleY - 1e-3) { c.phase = 'carry'; c.t = 0; c.dropX = Math.max(-(L.halfW - 1.5), Math.min(L.halfW - 1.5, c.x)); }
        break;
      case 'carry':
        c.x = mv(c.x, c.dropX, 5); c.z = mv(c.z, L.frontZ - 1.4, 5);
        if (Math.abs(c.z - (L.frontZ - 1.4)) < 1e-3 && Math.abs(c.x - c.dropX) < 1e-3) { c.phase = 'open'; c.t = 0; }
        break;
      case 'open':
        c.claw = Math.max(0, c.claw - h / 0.3);
        if (c.claw < 0.6 && c.grabbed.length) { for (const o of c.grabbed) this._release(o, { x: 0, y: -1, z: 0.6 }); c.grabbed.length = 0; ev.push({ t: 'crane', ph: 'drop', x: c.x }); }
        if (c.claw <= 0 && c.t > 0.8) { c.phase = 'return'; c.t = 0; }
        break;
      case 'return': {
        const px = -(L.halfW - CRANE.parkDx);
        c.claw = Math.min(1, c.claw + h / 0.6);
        c.x = mv(c.x, px, 7); c.z = mv(c.z, CRANE.parkZ, 7);
        if (Math.abs(c.z - CRANE.parkZ) < 1e-3 && Math.abs(c.x - px) < 1e-3) { c.phase = 'idle'; ev.push({ t: 'crane', ph: 'done' }); }
        break;
      }
    }
    // carried objects follow the claw (and may slip while lifting / carrying)
    if (c.grabbed.length) {
      const sway = c.phase === 'carry' ? Math.sin(c.t * 9) * 0.03 : 0;
      for (let i = c.grabbed.length - 1; i >= 0; i--) {
        const o = c.grabbed[i], g = o.grab;
        if (o.dead || !g) { c.grabbed.splice(i, 1); continue; }
        if (g.slipAt >= 0 && (c.phase === 'up' || c.phase === 'carry') && (c.phase === 'carry' || c.t > g.slipAt)) {
          if (c.phase === 'up' || Math.random() < h * 0.8) { this._release(o, { x: (Math.random() - 0.5) * 0.6, y: c.phase === 'up' ? 2 : 0, z: c.phase === 'carry' ? 3 : 0 }); c.grabbed.splice(i, 1); continue; }
        }
        o.body.setNextKinematicTranslation({ x: c.x + g.dx + sway, y: c.y + g.dy, z: c.z + g.dz });
      }
    }
    this._placeClaw();
  }

  _release(o, v) {
    o.grab = null;
    if (o.dead) return;
    this._setKinematic(o, false);
    o.body.setLinvel(v, true);
    o.body.setAngvel({ x: (Math.random() - 0.5) * 4, y: 0, z: (Math.random() - 0.5) * 4 }, true);
    o.rest = false; o.body.setAngularDamping(o.kind === KIND.BALL ? BALLP.angDamp : 0.3); o.body.setLinearDamping(0.04);
  }

  _devicesStep(h, ev) {
    // kicker: push a JP ball that has stayed on the shelf too long
    const k = this.kick;
    for (const o of this.objs) {
      if (o.kind !== KIND.BALL || o.grab) continue;
      if (this._onShelf(o)) o.shelfT = (o.shelfT || 0) + h; else o.shelfT = 0;
      if (BALLP.tilt && o.y < 1.6 && o.z > this.pusherFrontAt(this.phase) - 0.2) o.body.applyImpulse({ x: 0, y: 0, z: o.body.mass() * BALLP.tilt * h }, true);
      if (k.state === 0 && o.shelfT > this.kickAfter) { k.state = 1; k.t = 0; k.x = Math.max(-(L.halfW - 0.8), Math.min(L.halfW - 0.8, o.x)); o.shelfT = 0; ev.push({ t: 'kick', x: k.x }); }
    }
    if (k.state !== 0) {
      k.t += h;
      const z0 = L.backWallZ - 0.9, z1 = L.pusherFrontMin - 1.0;
      let f;
      if (k.t < 0.15) f = 0;                       // ready (lamp flashes)
      else if (k.t < 0.95) { const u = (k.t - 0.15) / 0.8; f = u * u * (3 - 2 * u); }
      else if (k.t < 1.25) f = 1;
      else if (k.t < 2.25) f = 1 - (k.t - 1.25);
      else { f = 0; k.state = 0; }
      k.z = z0 + (z1 - z0) * f;
      k.body.setNextKinematicTranslation({ x: k.x, y: L.pusherH + 0.45, z: k.z });
    }
    // turntables
    if (this.ttOn) {
      this.ttAngle += h;
      for (const t of this.turntables) { const a = this.ttAngle * t.w; t.body.setNextKinematicRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }); }
    }
    // flippers
    if (this.flipOn || this.flippers[0].a !== FLIPPER.rest) {
      this.flipT += h;
      const ph = this.flipT % FLIPPER.period;
      let a;
      if (!this.flipOn) a = FLIPPER.rest;
      else if (ph < 0.2) a = FLIPPER.rest + (FLIPPER.kick - FLIPPER.rest) * Math.sin(ph / 0.2 * Math.PI / 2);
      else if (ph < 0.75) a = FLIPPER.kick - (FLIPPER.kick - FLIPPER.rest) * (ph - 0.2) / 0.55;
      else a = FLIPPER.rest;
      if (ph < h && this.flipOn) ev.push({ t: 'flip' });
      for (const f of this.flippers) { f.a = !this.flipOn ? f.a + Math.sign(FLIPPER.rest - f.a) * Math.min(Math.abs(FLIPPER.rest - f.a), h * 3) : a; this._placeFlipper(f); }
    }
    this._craneStep(h, ev);
  }

  strokeRange() { return [L.pusherFrontMin, L.pusherFrontMax + this.strokeBonus]; }
  pusherFrontAt(phase) {
    const [a, b] = this.strokeRange();
    return a + (b - a) * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
  }
  pusherZ(phase) { return this.pusherFrontAt(phase) - L.pusherLen / 2; }

  desc(kind) {
    const R = this.R;
    let d;
    switch (kind) {
      case KIND.BIG:
        d = R.ColliderDesc.roundCylinder(L.bigCoinHH - L.coinBorder, L.bigCoinR - L.coinBorder, L.coinBorder).setDensity(2.4); break;
      case KIND.GIANT:
        d = R.ColliderDesc.roundCylinder(GIANT.hh - 0.04, GIANT.r - 0.04, 0.04).setDensity(3.2); break;
      case KIND.BALL:
        d = R.ColliderDesc.ball(BALLP.r).setDensity(BALLP.density).setRestitution(BALLP.restitution); break;
      case KIND.GEM: {
        const p = [], r = 0.5, h = 0.38;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.push(Math.cos(a) * r, 0.06, Math.sin(a) * r); }
        p.push(0, -h, 0);
        for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; p.push(Math.cos(a) * r * 0.6, 0.2, Math.sin(a) * r * 0.6); }
        d = R.ColliderDesc.convexHull(new Float32Array(p)).setDensity(2); break;
      }
      case KIND.CHEST:
        d = R.ColliderDesc.cuboid(0.55, 0.4, 0.4).setDensity(1.2); break;
      case KIND.ROCK:
        d = R.ColliderDesc.roundCuboid(ROCK.hx - ROCK.border, ROCK.hy - ROCK.border, ROCK.hz - ROCK.border, ROCK.border).setDensity(ROCK.density); break;
      case KIND.TOKEN:
        d = R.ColliderDesc.roundCylinder(0.11 - L.coinBorder, 0.68 - L.coinBorder, L.coinBorder).setDensity(2); break;
      default:
        d = R.ColliderDesc.roundCylinder(L.coinHH - L.coinBorder, L.coinR - L.coinBorder, L.coinBorder).setDensity(2);
    }
    if (kind !== KIND.BALL) d.setRestitution(0.04);
    const thr = kind === KIND.GIANT ? 200 : kind === KIND.BIG || kind === KIND.ROCK ? 90 : kind === KIND.BALL ? 60 : kind === KIND.CHEST ? 50 : 22;
    d.setActiveEvents(this.R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(thr);
    return d.setFriction(kind === KIND.BALL ? BALLP.friction : kind === KIND.ROCK ? 0.45 : 0.3);
  }

  spawn(kind, x, y, z, q, v, extra = 0, flags = 0, angv) {
    const R = this.R;
    const bd = R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.04).setAngularDamping(kind === KIND.BALL ? BALLP.angDamp : 0.3);
    if (q) bd.setRotation(q);
    if (v) bd.setLinvel(v.x, v.y, v.z);
    if (angv) bd.setAngvel(angv);
    if (flags & 1) bd.setSoftCcdPrediction(0.35);
    const body = this.world.createRigidBody(bd);
    const col = this.world.createCollider(this.desc(kind), body);
    const o = { id: this.nextId++, body, col: col.handle, kind, extra, flags, x, y, z, vy: v ? v.y : 0, gated: !(flags & 1) };
    this.colObj.set(col.handle, o);
    this.objs.push(o);
    this.map.set(o.id, o);
    return o;
  }

  remove(o) {
    if (o.dead) return;
    this.world.removeRigidBody(o.body);
    this.map.delete(o.id);
    this.colObj.delete(o.col);
    o.dead = true;
  }

  clear() {
    for (const o of this.objs) this.remove(o);
    this.objs.length = 0;
  }

  // Lay coins out in a stable, staggered arrangement (no free-fall chaos)
  prefill(count, rnd = Math.random) {
    const S = 1.03, placed = [];
    const W = L.halfW - 0.55;
    const front = this.pusherFrontAt(this.phase);
    const layers = [
      { y: L.coinHH + 0.002, z0: front + 0.6, z1: L.frontZ - 0.75, off: 0 },
      { y: L.coinHH * 3 + 0.006, z0: front + 1.1, z1: L.frontZ - 1.6, off: 0.5 },
      { y: L.pusherH + L.coinHH + 0.004, z0: L.backWallZ + 0.6, z1: front - 0.6, off: 0, top: true },
      { y: L.coinHH * 5 + 0.01, z0: front + 1.8, z1: L.frontZ - 3.2, off: 0 },
    ];
    for (const ly of layers) {
      for (let z = ly.z0; z <= ly.z1; z += S * 0.87) {
        const row = Math.round((z - ly.z0) / (S * 0.87));
        const sh = ((row % 2) * 0.5 + ly.off) * S;
        for (let x = -W + sh; x <= W; x += S) {
          if (ly.top && Math.abs(x) > W - 0.2) continue;
          placed.push([x + (rnd() - 0.5) * 0.04, ly.y, z + (rnd() - 0.5) * 0.04, ly.top ? 0.55 : 1]);
        }
      }
    }
    // Choose subset: always fill bottom layer first, sparser upper layers
    let n = 0;
    for (const p of placed) {
      if (n >= count) break;
      if (p[3] < 1 && rnd() > p[3]) continue;
      const a = rnd() * Math.PI * 2;
      this.spawn(rnd() < 0.03 ? KIND.GOLD : KIND.SILVER, p[0], p[1], p[2], { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
      n++;
    }
    return n;
  }

  // Advance simulation by dt; returns events
  step(dt, ev) {
    if (this.paused) return 0;
    if (this.pendingEv && this.pendingEv.length) { ev.push(...this.pendingEv); this.pendingEv.length = 0; }
    this.acc += Math.min(dt, 0.1);
    const h = 1 / this.hz;
    let n = 0;
    while (this.acc >= h - 1e-6 && n < 6) {
      this.acc -= h; n++;
      this.time += h;
      const ph = this.phase + h * this.speed / this.period;
      if (ph >= 1) ev.push({ t: 'stroke' });
      const z0 = this.pusherZ(this.phase);
      this.phase = ph % 1;
      const z1 = this.pusherZ(this.phase);
      this.pusherVz = (z1 - z0) / h;
      this.pusher.setNextKinematicTranslation({ x: 0, y: L.pusherH / 2, z: z1 });
      this.stepNo++;
      if (this.stepNo % 6 === 0) this._restDamping();
      const lidT = this.pocketOpen ? -1.6 : -0.5;
      if (this.lidY !== lidT) {
        this.lidY += Math.sign(lidT - this.lidY) * Math.min(Math.abs(lidT - this.lidY), h * 4);
        this.lid.setNextKinematicTranslation({ x: POCKET.x, y: this.lidY, z: POCKET.z });
      }
      if (this.magnet) this._magnet(h);
      this._devicesStep(h, ev);
      this.cupX = cupXAt(this.time);
      for (const g of this.guards) {
        const ty = this.wallsUp ? 1.25 : -7;
        if (g.y !== ty) {
          g.y += Math.sign(ty - g.y) * Math.min(Math.abs(ty - g.y), h * 14);
          g.body.setNextKinematicTranslation({ x: g.side * (L.halfW + 0.5), y: g.y, z: (L.sideWallEnd + L.frontZ) / 2 });
        }
      }
      this.world.step(this.queue);
      this._collectHits();
    }
    if (n === 6) this.acc = 0;
    if (n === 0) return 0;
    // strongest new impacts of this frame -> audio
    if (this.hits.length) {
      this.hits.sort((a, b) => b.s - a.s);
      for (let i = 0; i < Math.min(14, this.hits.length); i++) ev.push(this.hits[i]);
      this.hits.length = 0;
    }
    const list = this.objs;
    let w = 0, motion = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const t = o.body.translation();
      // medals that fell over the front edge are counted once they reach the payout tray
      if (t.y < L.lostY || Math.abs(t.x) > L.halfW + 6 || (t.y < L.trayY && t.z > L.frontZ + 0.1 && Math.abs(t.x) < L.halfW + 0.3)) {
        const won = o.z > L.frontZ - 0.3 && Math.abs(o.x) < L.halfW + 0.3;
        const pocket = !won && Math.abs(o.x - POCKET.x) < POCKET.hw + 0.4 && Math.abs(o.z - POCKET.z) < POCKET.hd + 0.4;
        ev.push({ t: 'out', id: o.id, kind: o.kind, extra: o.extra, won, pocket, x: o.x });
        this.remove(o);
        continue;
      }
      // catcher cup on the shelf: player-dropped medals falling into it are caught
      if (this.cupOn && (o.flags & 1) && o.y >= CUP.y && t.y < CUP.y && Math.abs(t.x - this.cupX) < CUP.r && Math.abs(t.z - CUP.z) < CUP.r) {
        ev.push({ t: 'catch', id: o.id, x: t.x, kind: o.kind });
        this.remove(o);
        continue;
      }
      // gate crossing for player-dropped coins
      if (!o.gated && o.y >= L.gateY && t.y < L.gateY) {
        o.gated = true;
        ev.push({ t: 'gate', id: o.id, x: t.x, kind: o.kind });
      }
      // overall motion of the pile (drives the "shuffling" ambience)
      if (!o.body.isSleeping()) {
        const v = o.body.linvel();
        const sp = Math.abs(v.x) + Math.abs(v.z - (this._onShelf(o) ? this.pusherVz : 0));
        if (sp > 0.25 && t.y < 2.5) motion += Math.min(sp, 3);
      }
      o.x = t.x; o.y = t.y; o.z = t.z;
      list[w++] = o;
    }
    list.length = w;
    ev.push({ t: 'mv', v: motion });
    return n;
  }

  // pull coins near the side gutters back toward the center
  _magnet(h) {
    const W = L.halfW;
    for (const o of this.objs) {
      if (Math.abs(o.x) < W - 3 || o.z < L.sideWallEnd - 2 || o.y > 2) continue;
      const m = o.body.mass();
      o.body.applyImpulse({ x: -Math.sign(o.x) * m * 9 * h, y: 0, z: 0 }, true);
    }
  }

  // whole-table shake: every medal on the field gets a small kick (SHAKE item / event)
  shake(k = 1) {
    for (const o of this.objs) {
      if (o.y > 3 || o.kind === KIND.BALL) continue;
      const m = o.body.mass();
      o.body.applyImpulse({ x: (Math.random() - 0.5) * 2.4 * m * k, y: (1.5 + Math.random() * 2) * m * k, z: (Math.random() * 1.0 - 0.3) * m * k }, true);
      o.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.05 * m * k, y: 0, z: (Math.random() - 0.5) * 0.05 * m * k }, true);
    }
  }

  // radial blast (BOMB item): pushes nearby objects forward/outward
  // boss attack: n medals resting on the field are sucked away (removed); the positions go to
  // the game for the effect
  drain(n) {
    const cand = this.objs.filter(o => !o.dead && !o.grab && o.kind <= KIND.GOLD && o.y < 1.2 && o.z > L.pusherFrontMax + 0.5 && o.z < L.frontZ - 0.4 && Math.abs(o.x) < L.halfW - 0.6);
    const pts = [];
    for (let i = 0; i < n && cand.length; i++) {
      const o = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
      pts.push([o.x, o.z]);
      this.remove(o);
    }
    this.objs = this.objs.filter(o => !o.dead);
    (this.pendingEv = this.pendingEv || []).push({ t: 'drain', pts });
  }

  blast(x, z, r, k) {
    for (const o of this.objs) {
      const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz);
      if (d > r || o.y > 2.5) continue;
      const f = (1 - d / r) * k * o.body.mass();
      o.body.applyImpulse({ x: dx / (d + 0.3) * f * 0.6, y: f * 0.5, z: (dz / (d + 0.3) * 0.4 + 0.8) * f }, true);
    }
  }

  _onShelf(o) { return o.y > L.pusherH - 0.1 && o.y < L.pusherH + 1.2 && o.z < this.pusherFrontAt(this.phase) && o.z > L.backWallZ - 0.2; }

  // Rapier never lets the pile sleep (the moving pusher keeps the island awake), and with
  // few solver iterations resting coins shiver forever. Coins that are (relative to what
  // they rest on) nearly still get heavy damping; anything really moving gets normal damping.
  _restDamping() {
    for (const o of this.objs) {
      if (o.kind === KIND.BALL || o.grab) continue;
      const v = o.body.linvel(), a = o.body.angvel();
      const vz = v.z - (this._onShelf(o) ? this.pusherVz : 0);
      const lin = Math.hypot(v.x, v.y, vz), ang = Math.hypot(a.x, a.y, a.z);
      if (!o.rest && lin < 0.3 && ang < 1.6 && o.y < 3) { o.rest = true; o.body.setAngularDamping(25); o.body.setLinearDamping(2.5); }
      else if (o.rest && (lin > 0.9 || ang > 4 || o.y >= 3)) { o.rest = false; o.body.setAngularDamping(0.3); o.body.setLinearDamping(0.04); }
    }
  }

  _relSpeed(o, other, colHandle) {
    const v = o.body.linvel();
    let ox = 0, oy = 0, oz = 0;
    if (other) { const w = other.body.linvel(); ox = w.x; oy = w.y; oz = w.z; }
    else if (colHandle === this.pusherCol) oz = this.pusherVz;
    return Math.hypot(v.x - ox, v.y - oy, v.z - oz);
  }

  // Turn newly-started strong contacts into audio impact events. A pair only counts as new
  // when it has not carried force for a while (hysteresis), the bodies actually approach
  // each other with some speed (filters solver jitter) and the object is off cooldown.
  _collectHits() {
    const seen = this.pairSeen, now = this.stepNo;
    this.queue.drainContactForceEvents(e => {
      const h1 = e.collider1(), h2 = e.collider2();
      const key = h1 < h2 ? h1 * 1048576 + h2 : h2 * 1048576 + h1;
      const last = seen.get(key);
      seen.set(key, now);
      if (last !== undefined && now - last < 20) return;
      if (this.hits.length > 40) return;
      const a = this.colObj.get(h1), b = this.colObj.get(h2);
      const o = a || b;
      if (!o) return;
      const other = a && b ? (a === o ? b : a) : null;
      const rel = this._relSpeed(o, other, a ? h2 : h1);
      if (rel < 0.6) return;
      if (o.hitAt && this.time - o.hitAt < 0.12) return;
      o.hitAt = this.time;
      const surf = other ? 0 : (this.surf.get(a ? h2 : h1) || 1);
      const f = e.maxForceMagnitude();
      const t = o.body.translation();
      const k2 = other ? Math.max(o.kind, other.kind) : o.kind;
      const s = Math.min(1, Math.log(1 + f / 25) / 3.2) * Math.min(1, 0.45 + rel * 0.18);
      this.hits.push({ t: 'hit', x: t.x, y: t.y, z: t.z, s, kind: k2, surf });
    });
    if (now % 300 === 0) for (const [k, v] of seen) if (now - v > 60) seen.delete(k);
  }

  // Pack transforms: [id, kind, extra, x, y, z, qx, qy, qz, qw] per object
  pack(buf) {
    const list = this.objs, need = list.length * 10 + PACK_HEAD;
    if (!buf || buf.length < need) buf = new Float32Array(Math.ceil(need * 1.3));
    buf[0] = list.length;
    buf[1] = this.pusher.translation().z;
    buf[2] = this.guards[0].y;
    buf[3] = this.phase;
    buf[4] = this.lidY;
    buf[5] = this.cupX;
    const c = this.crane;
    buf[6] = c.x; buf[7] = c.z; buf[8] = c.y; buf[9] = c.claw;
    buf[10] = this.kick.z; buf[11] = this.kick.x;
    buf[12] = this.ttAngle; buf[13] = this.flippers[0].a; buf[14] = this.flippers[1].a;
    buf[15] = c.phase === 'idle' ? 0 : c.phase === 'aim' ? 1 : 2;
    let k = PACK_HEAD;
    for (const o of list) {
      const t = o.body.translation(), r = o.body.rotation();
      buf[k++] = o.id; buf[k++] = o.kind; buf[k++] = o.extra;
      buf[k++] = t.x; buf[k++] = t.y; buf[k++] = t.z;
      buf[k++] = r.x; buf[k++] = r.y; buf[k++] = r.z; buf[k++] = r.w;
    }
    return buf;
  }

  snapshot() {
    return {
      phase: this.phase,
      objs: this.objs.map(o => {
        const t = o.body.translation(), r = o.body.rotation();
        return [o.kind, o.extra, t.x, t.y, t.z, r.x, r.y, r.z, r.w];
      }),
    };
  }

  restore(snap) {
    this.clear();
    if (typeof snap.phase === 'number') this.phase = snap.phase;
    this.pusher.setTranslation({ x: 0, y: L.pusherH / 2, z: this.pusherZ(this.phase) }, true);
    for (const a of snap.objs) {
      if (!Array.isArray(a) || a.length < 9 || a.some(v => !Number.isFinite(v))) continue;
      const o = this.spawn(a[0] | 0, a[2], a[3] + 0.003, a[4], { x: a[5], y: a[6], z: a[7], w: a[8] }, null, a[1] | 0);
      o.body.sleep();
    }
  }
}
