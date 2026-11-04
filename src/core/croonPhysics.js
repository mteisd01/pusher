// Physical croon (rotating funnel dish with holes) for the 3D jackpot tower.
// A separate small Rapier world: one kinematic dish (trimesh with real holes) and one ball.
// Pure logic, shared by the worker, the inline engine and the headless simulators.

export const CROON_DISH = { R: 2.0, rimH: 0.55, valley: 1.05, outerDrop: 0.42, dome: 0.3, ball: 0.2, hole: 0.26 };

// Height of the dish surface at radius r (valley ring with the holes, raised centre dome)
export function dishHeight(r) {
  const D = CROON_DISH;
  return r >= D.valley ? D.outerDrop * (r - D.valley) / (D.R - D.valley) : D.dome * (D.valley - r) / D.valley;
}

// Hole layout for a stage: n holes on the valley ring, good holes may be wider (luck)
export function holeLayout(holes, luck = 0) {
  const n = holes.length;
  return holes.map((h, i) => ({ a: i / n * Math.PI * 2, r: CROON_DISH.hole * (h.good ? 1 + luck * 0.5 : 1) }));
}

// Triangulated dish surface with holes cut out (+ the rim wall). Used for physics & visuals.
export function dishGeometry(layout, nr = 22, na = 120) {
  const D = CROON_DISH;
  const pos = [], idx = [], col = [];
  const vid = (r, a) => { pos.push(Math.cos(a) * r, dishHeight(r), Math.sin(a) * r); return pos.length / 3 - 1; };
  const grid = [];
  for (let i = 0; i <= nr; i++) {
    const r = i / nr * D.R, row = [];
    for (let j = 0; j < na; j++) row.push(vid(Math.max(r, 0.001), j / na * Math.PI * 2));
    grid.push(row);
  }
  const inHole = (x, z) => {
    for (const h of layout) {
      const hx = Math.cos(h.a) * D.valley, hz = Math.sin(h.a) * D.valley;
      if ((x - hx) ** 2 + (z - hz) ** 2 < h.r * h.r) return true;
    }
    return false;
  };
  const tri = (a, b, c) => {
    const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
    if (!inHole(cx, cz)) idx.push(a, c, b);
  };
  for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
    const j2 = (j + 1) % na;
    tri(grid[i][j], grid[i + 1][j], grid[i + 1][j2]);
    tri(grid[i][j], grid[i + 1][j2], grid[i][j2]);
  }
  const surfCount = idx.length;
  // rim wall
  const top = [];
  const yr = dishHeight(D.R);
  for (let j = 0; j < na; j++) { const a = j / na * Math.PI * 2; pos.push(Math.cos(a) * D.R, yr + D.rimH, Math.sin(a) * D.R); top.push(pos.length / 3 - 1); }
  for (let j = 0; j < na; j++) {
    const j2 = (j + 1) % na, a = grid[nr][j], b = grid[nr][j2], c = top[j], d = top[j2];
    idx.push(a, b, c, b, d, c);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), surfCount };
}

export class CroonPhysics {
  constructor(RAPIER) {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -16, z: 0 });
    this.world.timestep = 1 / 120;
    this.active = false;
    this.angle = 0;
    this.omega = 0.8;
    this.dish = null; this.ball = null;
    this.layout = [];
    this.t = 0;
  }

  // start a stage: layout from holeLayout(); dir/omega: dish spin; seed angle for the ball entry
  start(layout, omega, entryAngle = Math.random() * Math.PI * 2, speed = 6.5) {
    const R = this.R, D = CROON_DISH;
    this.stop();
    this.layout = layout;
    this.omega = omega;
    this.angle = Math.random() * Math.PI * 2;
    const g = dishGeometry(layout, 18, 96);
    this.dish = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(R.ColliderDesc.trimesh(g.positions, g.indices).setFriction(0.06).setRestitution(0.25), this.dish);
    this._setRot(this.angle);
    const er = D.R - D.ball - 0.08;
    const x = Math.cos(entryAngle) * er, z = Math.sin(entryAngle) * er;
    this.ball = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, dishHeight(er) + D.ball + 0.25, z)
      .setLinvel(-Math.sin(entryAngle) * speed, -0.5, Math.cos(entryAngle) * speed).setLinearDamping(0.02).setAngularDamping(0.2).setCcdEnabled(true));
    this.world.createCollider(R.ColliderDesc.ball(D.ball).setDensity(3).setFriction(0.3).setRestitution(0.3), this.ball);
    this.t = 0;
    this.active = true;
  }

  _setRot(a) {
    const q = { x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) };
    this.dish.setNextKinematicRotation(q);
  }

  stop() {
    if (this.ball) this.world.removeRigidBody(this.ball);
    if (this.dish) this.world.removeRigidBody(this.dish);
    this.ball = this.dish = null;
    this.active = false;
  }

  // advance; returns { hole } once the ball dropped through a hole
  step(dt) {
    if (!this.active) return null;
    const D = CROON_DISH, h = this.world.timestep;
    let n = Math.min(24, Math.round(Math.min(dt, 0.1) / h));
    if (n < 1) n = 1;
    for (let i = 0; i < n; i++) {
      this.angle += this.omega * h;
      this._setRot(this.angle);
      this.world.step();
      this.t += h;
      const p = this.ball.translation();
      if (p.y < -0.35) {
        // which hole? compare with the dish-relative angle of the ball
        const a = Math.atan2(p.z, p.x) - this.angle;
        let best = 0, bd = 1e9;
        this.layout.forEach((hl, k) => { let d = Math.abs(((a - hl.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; best = k; } });
        this.active = false;
        return { hole: best };
      }
      // escaped (should not happen behind the dome glass): put it back on the rim
      const rr = Math.hypot(p.x, p.z);
      if (rr > D.R + 0.3 || p.y > 2.5) this.ball.setTranslation({ x: p.x / rr * (D.R - 0.4), y: 0.6, z: p.z / rr * (D.R - 0.4) }, true);
      // a ball resting on the centre dome or stuck for very long gets a gentle nudge
      if (this.t > 18 && Math.floor(this.t * 2) !== Math.floor((this.t - h) * 2)) {
        const v = this.ball.linvel();
        // speed relative to the spinning dish surface under the ball
        const rvx = v.x + this.omega * p.z, rvz = v.z - this.omega * p.x;
        if (Math.hypot(rvx, rvz) < 0.25) this.ball.applyImpulse({ x: (Math.random() - 0.5) * 0.12, y: 0.05, z: (Math.random() - 0.5) * 0.12 }, true);
      }
    }
    return null;
  }

  state() {
    if (!this.ball) return null;
    const p = this.ball.translation(), r = this.ball.rotation();
    return [p.x, p.y, p.z, r.x, r.y, r.z, r.w, this.angle];
  }
}
