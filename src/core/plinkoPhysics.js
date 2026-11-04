// Physical plinko board that drops in front of the LCD: a ball falls between two glass
// panes through rows of pins into 9 pockets. Separate small Rapier world, pure logic;
// shared by the worker, the inline engine and the headless simulator.

export const PLINKO_BOARD = {
  w: 9.0, h: 7.6, ball: 0.27, pin: 0.12, rows: 8, top: 6.85, dy: 0.8, pocketH: 0.95, slots: 9,
  pinRest: 0.3, ballRest: 0.2, damp: 0.15, jitter: 0.6,
  aim: 1.9,            // the player can choose the drop x within ±aim
};

export function plinkoPins() {
  const B = PLINKO_BOARD, pins = [], sw = B.w / B.slots;
  for (let r = 0; r < B.rows; r++) {
    const odd = r % 2 === 1, n = odd ? B.slots - 1 : B.slots;
    for (let i = 0; i < n; i++) {
      let x = -B.w / 2 + sw * (odd ? i + 1 : i + 0.5);
      // outermost pins sit close to the side walls so that no ball can rest between pin and wall
      if (!odd && (i === 0 || i === n - 1)) x = Math.sign(x) * (B.w / 2 - 0.2);
      pins.push([x, B.top - r * B.dy]);
    }
  }
  return pins;
}

export class PlinkoPhysics {
  constructor(RAPIER) {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -18, z: 0 });
    this.world.timestep = 1 / 120;
    const B = PLINKO_BOARD, R = RAPIER;
    const fixed = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    const box = (hx, hy, hz, x, y, z, rest = 0.2) => this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRestitution(rest).setFriction(0.1), fixed);
    box(B.w / 2 + 0.3, 0.2, 0.5, 0, -0.2, 0);                   // floor
    box(0.15, B.h / 2, 0.5, -B.w / 2 - 0.15, B.h / 2, 0, 0.4);    // side walls
    box(0.15, B.h / 2, 0.5, B.w / 2 + 0.15, B.h / 2, 0, 0.4);
    box(B.w / 2 + 0.3, B.h / 2, 0.05, 0, B.h / 2, -0.33);         // back / front glass
    box(B.w / 2 + 0.3, B.h / 2, 0.05, 0, B.h / 2, 0.33);
    const sw = B.w / B.slots;
    for (let k = 1; k < B.slots; k++) box(0.04, B.pocketH / 2, 0.3, -B.w / 2 + k * sw, B.pocketH / 2, 0, 0.1);
    for (const [x, y] of plinkoPins()) {
      this.world.createCollider(R.ColliderDesc.cylinder(0.3, B.pin).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setTranslation(x, y, 0).setRestitution(PLINKO_BOARD.pinRest).setFriction(0.05), fixed);
    }
    this.ball = null;
    this.active = false;
    this.t = 0;
    this.pinHits = 0;
    this.queue = new RAPIER.EventQueue(true);
  }

  drop(x) {
    const B = PLINKO_BOARD, R = this.R;
    this.stop();
    x = Math.max(-B.aim, Math.min(B.aim, x)) + (Math.random() - 0.5) * B.jitter;
    this.ball = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, B.h - 0.35, 0).setLinvel((Math.random() - 0.5) * 0.2, -0.5, 0)
      .setLinearDamping(PLINKO_BOARD.damp).enabledTranslations(true, true, false).enabledRotations(false, false, true).setCcdEnabled(true));
    this.world.createCollider(R.ColliderDesc.ball(B.ball).setDensity(2).setRestitution(PLINKO_BOARD.ballRest).setFriction(0.05).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), this.ball);
    this.t = 0; this.still = 0;
    this.active = true;
  }

  stop() {
    if (this.ball) this.world.removeRigidBody(this.ball);
    this.ball = null; this.active = false;
  }

  // returns { slot } once the ball rests in a pocket; pins: number of pin hits this call
  step(dt) {
    if (!this.active) return null;
    const B = PLINKO_BOARD, h = this.world.timestep;
    let n = Math.min(24, Math.max(1, Math.round(Math.min(dt, 0.1) / h)));
    let hits = 0;
    for (let i = 0; i < n; i++) {
      this.world.step(this.queue);
      this.queue.drainCollisionEvents((a, b, started) => { if (started) hits++; });
      this.t += h;
      const p = this.ball.translation(), v = this.ball.linvel();
      const sp = Math.hypot(v.x, v.y);
      if (p.y < B.pocketH - 0.1 && sp < 0.4) { this.still += h; if (this.still > 0.25) { this.active = false; return { slot: Math.max(0, Math.min(B.slots - 1, Math.floor((p.x + B.w / 2) / (B.w / B.slots)))), hits }; } }
      else this.still = 0;
      // a ball balanced on a pin gets a tiny nudge
      if (sp < 0.05 && p.y > B.pocketH) this.ball.applyImpulse({ x: (Math.random() - 0.5) * 0.05, y: 0, z: 0 }, true);
      if (this.t > 20) { this.active = false; return { slot: Math.max(0, Math.min(B.slots - 1, Math.floor((p.x + B.w / 2) / (B.w / B.slots)))), hits }; }
    }
    this.hits = hits;
    return null;
  }

  state() {
    if (!this.ball) return null;
    const p = this.ball.translation(), r = this.ball.rotation();
    return [p.x, p.y, r.z, r.w];
  }
}
