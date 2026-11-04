// Physics core (Rapier). Pure logic, no DOM: used by the worker, the inline
// fallback and the headless balance simulator (tools/sim.mjs).
import { L, KIND, POCKET, GIANT } from './layout.js';

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
        d = R.ColliderDesc.ball(0.6).setDensity(1.6).setRestitution(0.15); break;
      case KIND.GEM: {
        const p = [], r = 0.5, h = 0.38;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.push(Math.cos(a) * r, 0.06, Math.sin(a) * r); }
        p.push(0, -h, 0);
        for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; p.push(Math.cos(a) * r * 0.6, 0.2, Math.sin(a) * r * 0.6); }
        d = R.ColliderDesc.convexHull(new Float32Array(p)).setDensity(2); break;
      }
      case KIND.CHEST:
        d = R.ColliderDesc.cuboid(0.55, 0.4, 0.4).setDensity(1.2); break;
      case KIND.TOKEN:
        d = R.ColliderDesc.roundCylinder(0.11 - L.coinBorder, 0.68 - L.coinBorder, L.coinBorder).setDensity(2); break;
      default:
        d = R.ColliderDesc.roundCylinder(L.coinHH - L.coinBorder, L.coinR - L.coinBorder, L.coinBorder).setDensity(2);
    }
    if (kind !== KIND.BALL) d.setRestitution(0.04);
    const thr = kind === KIND.GIANT ? 200 : kind === KIND.BIG ? 90 : kind === KIND.BALL ? 60 : kind === KIND.CHEST ? 50 : 22;
    d.setActiveEvents(this.R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(thr);
    return d.setFriction(kind === KIND.BALL ? 0.5 : 0.3);
  }

  spawn(kind, x, y, z, q, v, extra = 0, flags = 0, angv) {
    const R = this.R;
    const bd = R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.04).setAngularDamping(kind === KIND.BALL ? 0.6 : 0.3);
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

  // radial blast (BOMB item): pushes nearby objects forward/outward
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
      if (o.kind === KIND.BALL) continue;
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
    const list = this.objs, need = list.length * 10 + 8;
    if (!buf || buf.length < need) buf = new Float32Array(Math.ceil(need * 1.3));
    buf[0] = list.length;
    buf[1] = this.pusher.translation().z;
    buf[2] = this.guards[0].y;
    buf[3] = this.phase;
    buf[4] = this.lidY;
    let k = 8;
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
