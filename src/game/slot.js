// Three-reel slot machine logic (rendered by Backboard)
import { SLOT_TABLE, SYM, SYM_COUNT } from './balance.js';

// Reel strips (symbol ids). Each reel contains every symbol at least once.
const STRIPS = [
  [3, 2, 6, 3, 1, 4, 3, 2, 0, 3, 7, 2, 6, 3, 5, 2, 4, 3, 1, 2],
  [2, 3, 4, 6, 2, 3, 1, 0, 3, 2, 7, 3, 2, 5, 6, 3, 4, 2, 1, 3],
  [3, 6, 2, 3, 4, 1, 2, 3, 5, 2, 0, 3, 6, 2, 7, 3, 1, 4, 2, 3],
];
const N = STRIPS[0].length;

export class Slot {
  constructor(game) {
    this.g = game;
    this.reels = STRIPS.map(s => ({ strip: s, pos: Math.floor(Math.random() * N), speed: 0, state: 'idle', target: 0, from: 0, t: 0 }));
    this.spinning = false;
    this.time = 0;
    this.reach = false;
    this.result = null;
    this.flash = 0;
    this.lastMsg = '';
    this.winLine = null;
  }

  rollOutcome() {
    const st = this.g.settings;
    const mult = this.g.slotLuck();
    let table = SLOT_TABLE.filter(o => {
      if (o.kind === 'ball' && !st.f_jp) return false;
      if (o.kind === 'item' && !st.f_items) return false;
      return true;
    });
    const r = Math.random() * 1000;
    let acc = 0;
    for (const o of table) {
      acc += o.w * mult;
      if (r < acc) return o;
    }
    return null;
  }

  canStart() { return !this.spinning && this.g.save.stock > 0; }

  start() {
    if (!this.canStart()) return false;
    this.g.save.stock--;
    const out = this.rollOutcome();
    this.result = out;
    let syms;
    if (out) syms = [out.sym, out.sym, out.sym];
    else {
      // losing combination; ~30% are teasing "reach" (first two match)
      const a = Math.floor(Math.random() * SYM_COUNT);
      if (Math.random() < 0.3) {
        let c; do { c = Math.floor(Math.random() * SYM_COUNT); } while (c === a);
        syms = [a, a, c];
      } else {
        let b, c;
        do { b = Math.floor(Math.random() * SYM_COUNT); } while (b === a);
        c = Math.floor(Math.random() * SYM_COUNT);
        syms = [a, b, c];
      }
    }
    this.syms = syms;
    this.reach = syms[0] === syms[1];
    const fast = this.g.settings.slotFast ? 0.55 : 1;
    const base = this.g.balance.slotTime * fast;
    this.stopAt = [base * 0.45, base * 0.7, base * (this.reach ? 1.6 : 1)];
    this.time = 0;
    this.spinning = true;
    this.winLine = null;
    this.reachAnnounced = false;
    for (const r of this.reels) { r.state = 'spin'; r.speed = 0; }
    this.g.onSlotStart();
    return true;
  }

  _targetIndex(reel, sym) {
    const idxs = [];
    reel.strip.forEach((s, i) => { if (s === sym) idxs.push(i); });
    return idxs[Math.floor(Math.random() * idxs.length)];
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.spinning) {
      if (this.g.save.stock > 0 && this.g.settings.f_slot) {
        this.idle = (this.idle || 0) + dt;
        if (this.idle > 0.35) { this.idle = 0; this.start(); }
      }
      return;
    }
    this.time += dt;
    let tickPlayed = false;
    this.reels.forEach((r, i) => {
      if (r.state === 'spin') {
        r.speed = Math.min(22, r.speed + dt * 80);
        const prev = Math.floor(r.pos);
        r.pos = (r.pos + r.speed * dt) % N;
        if (Math.floor(r.pos) !== prev && !tickPlayed && i === 0) { this.g.audio.reelTick(); tickPlayed = true; }
        if (this.time >= this.stopAt[i]) {
          // choose stop position ahead of current pos
          const ti = this._targetIndex(r, this.syms[i]);
          let to = ti;
          while (to < r.pos + 3) to += N;
          r.from = r.pos; r.target = to; r.t = 0; r.state = 'stopping';
        }
      } else if (r.state === 'stopping') {
        r.t += dt / 0.42;
        const k = Math.min(1, r.t);
        const e = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.04;
        r.pos = (r.from + (r.target - r.from) * e) % N;
        if (k >= 1) {
          r.pos = r.target % N; r.state = 'stopped';
          this.g.audio.reelStop(i, i === 2);
          if (i === 1 && this.reach && !this.reachAnnounced) { this.reachAnnounced = true; this.g.onReach(); }
        }
      }
    });
    if (this.reels.every(r => r.state === 'stopped')) {
      this.spinning = false;
      this.idle = -0.6;
      if (this.result) { this.winLine = this.syms[0]; this.flash = 2; }
      this.g.onSlotResult(this.result);
    }
  }

  // symbol at reel i, row offset (-1 top, 0 center, 1 bottom)
  symbolAt(i, off) {
    const r = this.reels[i];
    const idx = Math.floor(r.pos + 0.5 + off);
    return r.strip[((idx % N) + N) % N];
  }
}

export { SYM, N as STRIP_LEN };
