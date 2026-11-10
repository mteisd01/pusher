// Number checker + bingo. Nine numbered plates sit on the back wall along the drop line. Every
// openEvery s one of them (often the number that completes a line: a reach) blinks for `warn` s
// and then opens for openDur s. A dropped medal falling past the open plate (same x as the plate,
// at the gate height) marks that number on the 3x3 bingo card. Every completed line pays, and each
// further line on the same card pays more; a full card is BINGO: a JP lottery that starts at the
// second croon stage, a big payout and a fresh card. Only "where to drop" matters — no new controls.
import { L } from '../core/layout.js';
import { BINGO } from './balance.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Bingo {
  constructor(game) {
    this.g = game;
    this.lit = [];        // numbers (1..9) blinking / open right now
    this.phase = 'idle';  // idle -> warn (blinking) -> open (hits count)
    this.t = BINGO.openEvery * 0.5;
    this.flash = {};      // number -> seconds of hit flash
  }
  get on() { return !!this.g.settings.f_bingo; }
  get st() {
    const s = this.g.save;
    if (!s.bingo || typeof s.bingo !== 'object' || !Array.isArray(s.bingo.card) || s.bingo.card.length !== 9) s.bingo = { card: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]), marks: 0, lines: 0, cards: (s.bingo && s.bingo.cards) || 0 };
    return s.bingo;
  }
  // x of the plate for number n on the drop line
  plateX(n) { const span = L.halfW - 1.6; return -span + (n - 1) * (2 * span / 8); }
  half() { return BINGO.half * Math.pow(L.halfW / 11, 0.5) * (1 + this.g.end.bonus('bingo')); }
  marked(n) { const st = this.st; return !!(st.marks & (1 << st.card.indexOf(n))); }
  linesOf(marks) { return LINES.filter(l => l.every(i => marks & (1 << i))); }

  update(dt) {
    if (!this.on) { this.lit = []; return; }
    for (const k in this.flash) { this.flash[k] -= dt; if (this.flash[k] <= 0) delete this.flash[k]; }
    if ((this.t -= dt) > 0) return;
    if (this.phase === 'idle') { this.relight(); this.phase = 'warn'; this.t = BINGO.warn; }
    else if (this.phase === 'warn') { this.phase = 'open'; this.t = BINGO.openDur * (this.g.fx.fever > 0 ? 1.5 : 1); this.g.audio.gate && this.g.audio.gate(); }
    else { this.phase = 'idle'; this.lit = []; this.t = BINGO.openEvery * (0.8 + Math.random() * 0.4); }
  }
  get open() { return this.phase === 'open'; }
  // light a few unmarked numbers (one of them, when possible, completes a line: a reach)
  relight() {
    const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !this.marked(n));
    const st = this.st, reach = [];
    for (const l of LINES) {
      const miss = l.filter(i => !(st.marks & (1 << i)));
      if (miss.length === 1) reach.push(st.card[miss[0]]);
    }
    const pick = [];
    if (reach.length && Math.random() < BINGO.reachLight) pick.push(reach[Math.floor(Math.random() * reach.length)]);
    for (const n of shuffle(free.slice())) { if (pick.length >= BINGO.lit) break; if (!pick.includes(n)) pick.push(n); }
    this.lit = pick;
  }
  // every dropped medal passing the gate height (x = where it fell)
  onDrop(x) {
    if (!this.on || !this.lit.length || this.phase !== 'open') return;
    const h = this.half();
    for (const n of this.lit) if (Math.abs(x - this.plateX(n)) <= h) { this.mark(n, x); return; }
  }
  mark(n, x) {
    const g = this.g, st = this.st, idx = st.card.indexOf(n);
    if (idx < 0 || this.marked(n)) return;
    const before = this.linesOf(st.marks).length;
    st.marks |= 1 << idx;
    this.flash[n] = 1.2;
    this.lit = this.lit.filter(k => k !== n);
    if (!this.lit.length) { this.phase = 'idle'; this.t = BINGO.openEvery * (0.8 + Math.random() * 0.4); }
    g.prog.add('bingoMarks');
    g.ui.popup(`No.${n}!`, x, L.gateY + 1.2, L.dropZ, '#7fe7ff', 1.2);
    g.audio.bell ? g.audio.bell(1046 + n * 60, 0.3, 0.05) : g.audio.gate();
    const after = this.linesOf(st.marks).length;
    for (let k = before; k < after; k++) this.payLine(k + 1);
    if (st.marks === 0x1ff) this.bingo();
  }
  // k-th line on this card (1..8): pays more for each further line
  payLine(k) {
    const g = this.g, n = Math.round(BINGO.line[Math.min(k, BINGO.line.length) - 1] * (1 + (this.st.cards || 0) * BINGO.cardGrow));
    this.st.lines = (this.st.lines || 0) + 1;
    g.prog.add('bingoLines');
    g.shower(Math.min(40, n)); if (n > 40) g.credit(n - 40, 'bingo');
    g.announce('bingoLine', '#7fe7ff', 1.8, [], `LINE ${k}! +${n}`);
    g.backboard.message(`LINE ${k}`, '#7fe7ff', 1.4, 120);
    g.audio.win && g.audio.win('bar');
    g.boss.damage(BINGO.bossDmg * k, 0);
  }
  bingo() {
    const g = this.g, st = this.st;
    st.cards = (st.cards || 0) + 1;
    g.prog.add('bingos');
    const n = Math.round(BINGO.full * (1 + (st.cards - 1) * BINGO.cardGrow));
    g.shower(Math.min(60, n)); if (n > 60) g.credit(n - 60, 'bingo');
    if (g.settings.f_jp) g.queueJackpot(1);
    g.backboard.message('BINGO!!', 'rainbow', 3, 110);
    g.announce('bingo', 'rainbow', 2.6, [], `BINGO!! +${n}`);
    g.effects.confetti(160); g.stage.addShake(0.4); g.audio.fanfare && g.audio.fanfare();
    g.bigWin(n, 'bingo');
    setTimeout(() => { st.card = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]); st.marks = 0; this.relight(); }, 2500);
  }
  // HUD / render state
  view() {
    const st = this.st;
    return { card: st.card, marks: st.marks, lit: this.lit, phase: this.phase, flash: this.flash, cards: st.cards || 0, lines: this.linesOf(st.marks) };
  }
}
