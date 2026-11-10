// v2 game elements: Lucky Road (sugoroku), random field events, center pocket, bonus zone,
// 3-stage croon jackpot, plinko and the overlay queue that runs mini games one at a time.
import { L, KIND, TOKEN } from '../core/layout.js';
import { ROAD, ROAD_LAP_BONUS, ROAD_GATE_PER_DIE, roadMult, CROON, PLINKO, EVENTS, EVENT_INTERVAL, POCKET_CYCLE, BONUS_ZONE, B, BOSS } from './balance.js';
import { t } from '../i18n.js';
import { infoText } from './info.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Features {
  constructor(game) {
    this.g = game;
    this.queue = [];
    this.busy = false;
    this.rolling = false;
    this.event = null;              // { id, t, dur, ... }
    this.nextEvent = rand(...EVENT_INTERVAL) * 0.5;
    this.pocketT = POCKET_CYCLE.closed * 0.6;
    this.pocketOpen = false;
    this.bonusT = 0;
    this.bonusX = 0;
    this.rockT = null;
  }
  get s() { return this.g.settings; }
  get save() { return this.g.save; }

  // ---------- overlay queue ----------
  // kind: 'crane' / 'plinko' need the player's input and wait while a timed boost (fever, turbo,
  // double, lucky gate, hyper, challenge, gold rush) runs, so they never eat into it
  enqueue(fn, kind = 'other') { this.queue.push({ fn, kind }); }
  static interactive(kind) { return kind === 'crane' || kind === 'plinko'; }
  // queued chances that are on hold right now (HUD chip)
  held() { return this.g.boostActive() ? this.queue.filter(q => Features.interactive(q.kind)).map(q => q.kind) : []; }
  _nextIndex() {
    const hold = this.g.boostActive();
    return this.queue.findIndex(q => !(hold && Features.interactive(q.kind)));
  }
  async _runNext() {
    const i = this._nextIndex();
    if (i < 0) return;
    const fn = this.queue.splice(i, 1)[0].fn;
    this.busy = true;
    this.g.holding = false;
    try { await fn(); } catch (e) { console.error(e); }
    this.busy = false;
  }

  update(dt) {
    const s = this.s, g = this.g;
    if (!this.busy && !this.rolling && this.queue.length && !g.roulette.active && this._nextIndex() >= 0) this._runNext();
    // lucky road: roll stocked dice in a small, non-blocking panel
    if (s.f_sugoroku && !this.busy && !this.rolling && (this.save.dice || 0) > 0 && !this.queue.length && !g.roulette.active) {
      this.save.dice--;
      this.rolling = true;
      this.rollDice().catch(e => console.error(e)).finally(() => { this.rolling = false; });
    }
    // random events
    if (s.f_events) {
      if (this.event) {
        if (!g.timeStopped()) this.event.t -= dt;
        if (this.event.id === 'challenge') this._challengeTick();
        if (this.event.id === 'quake' && this.event.quakes > 0 && (this.event.nextQuake -= dt) <= 0) { this.event.quakes--; this.event.nextQuake = 2; this.g.tableShake(0.8); }
        if (this.event.t <= 0) this._endEvent();
      } else if (!this.busy && !g.boss.active && !g.boss.pending) {
        this.nextEvent -= dt;
        if (this.nextEvent <= 0) this.startEvent();
      }
    }
    // falling rocks (higher difficulties)
    const rk = g.diff.rocks;
    if (rk) {
      if (this.rockT === null) this.rockT = rand(...rk);
      if (!this.busy && !g.boss.active && (this.rockT -= dt) <= 0) { this.rockT = rand(...rk); this.dropRock(); }
    } else this.rockT = null;
    // pocket cycle
    if (s.f_bonusZone) {
      this.pocketT -= dt;
      if (this.pocketT <= 0) {
        this.pocketOpen = !this.pocketOpen;
        this.pocketT = this.pocketOpen ? POCKET_CYCLE.open : POCKET_CYCLE.closed * rand(0.7, 1.3);
        g.physics.cmd('pocket', this.pocketOpen);
        if (this.pocketOpen) { g.announce('pocket', '#7CFFB2', 1.4, [], 'POCKET OPEN!'); g.audio.wall(); }
      }
      this.bonusT += dt;
      this.bonusX = Math.sin(this.bonusT * Math.PI * 2 / BONUS_ZONE.period) * (L.halfW - 1.5);
    } else if (this.pocketOpen) { this.pocketOpen = false; g.physics.cmd('pocket', false); }
  }

  board() { return ROAD; }
  inBonusZone(x) { return this.s.f_bonusZone && Math.abs(x - this.bonusX) <= BONUS_ZONE.half; }

  // ---------- center pocket ----------
  onPocket(e) {
    const g = this.g;
    if (e.kind === KIND.ROCK) { g.ui.popup('ROCK', e.x, 1.2, 2.6, '#c8b89a', 1.2); g.audio.thump(0, 0.4, 90); return; }
    g.prog.add('pockets');
    g.credit(B.value[e.kind] || 1, 'pocket');
    const r = Math.random();
    let msg;
    if (r < 0.35 && this.s.f_slot && this.save.stock < g.stockMax()) { this.save.stock++; msg = '+1 STOCK'; }
    else if (r < 0.45 && this.s.f_sugoroku) { this.addDice(1); msg = '+1 DICE'; }
    else if (r < 0.62 && this.s.f_items) { g.spawnRandomItem(); msg = 'ITEM!'; }
    else { const n = 3; g.shower(n); msg = `+${n}`; }
    g.ui.popup(msg, e.x, 1.2, 2.6, '#7CFFB2', 1.4);
    g.audio.gate();
    g.effects.burst(e.x, 0.3, 2.6, '#7CFFB2', 16, 4, 0.6, 0.8);
  }

  // ---------- lucky road ----------
  addDice(n = 1) { if (this.s.f_sugoroku) this.save.dice = (this.save.dice || 0) + n; }
  onGatePass() {
    if (!this.s.f_sugoroku) return;
    this.save.roadGate = (this.save.roadGate || 0) + 1;
    if (this.save.roadGate >= ROAD_GATE_PER_DIE) { this.save.roadGate = 0; this.addDice(1); this.g.ui.popup('+1 DICE', this.g.gateX, 4, L.dropZ, '#ffd34d', 1.2); }
  }
  squareLabel(sq) {
    const m = roadMult(this.save.roadLap || 0);
    const ja = this.s.lang !== 'en';
    switch (sq.t) {
      case 'start': return 'START';
      case 'coin': return `+${Math.round(sq.n * m)}`;
      case 'shower': return `$${Math.round(sq.n * m)}`;
      case 'back': return `◀${sq.n}`;
      case 'again': return ja ? 'もう一回' : 'AGAIN';
      case 'item': return ja ? 'アイテム' : 'ITEM';
      case 'gem': return ja ? '宝石' : 'GEM';
      case 'plinko': return 'PLINKO';
      case 'crane': return 'CRANE';
      case 'stock': return 'STOCK';
      case 'ball': return 'JP';
      case 'event': return 'EVENT';
      case 'fever': return 'FEVER';
      case 'giant': return 'GIANT';
      case 'boss': return 'GOAL';
      default: return sq.t;
    }
  }
  async rollDice() {
    const g = this.g, save = this.save;
    const from = save.roadPos || 0;
    const steps = 1 + Math.floor(Math.random() * 6);
    g.prog.add('diceRolls');
    let to = await g.mini.roadMove(ROAD, from, steps, save.roadLap || 0, sq => this.squareLabel(sq));
    if (from + steps >= ROAD.length) this._lapDone();
    save.roadPos = to;
    await this._land(ROAD[to]);
  }
  _lapDone() {
    const g = this.g, lap = this.save.roadLap || 0;
    const bonus = ROAD_LAP_BONUS(lap);
    this.save.roadLap = lap + 1;
    g.prog.add('roadLaps');
    g.shower(Math.min(60, bonus)); if (bonus > 60) g.credit(bonus - 60, 'road');
    if (this.s.f_items) g.spawnRandomItem();
    g.announce('rd_lap', 'rainbow', 2.5, [], `LUCKY ROAD CLEAR! +${bonus}`);
    g.audio.fanfare(); g.effects.confetti(150); g.stage.addShake(0.4);
  }
  async _land(sq) {
    const g = this.g, m = roadMult(this.save.roadLap || 0);
    switch (sq.t) {
      case 'coin': { const n = Math.round(sq.n * m); g.credit(n, 'road'); g.announce('rd_coin', '#ffd34d', 1.6, [], `+${n}`); g.audio.win('gold'); break; }
      case 'shower': g.shower(Math.round(sq.n * m)); g.announce('rd_shower', '#7CFFB2', 1.6, [], t('shower')); g.audio.win('bell'); break;
      case 'back': this.save.roadPos = Math.max(0, (this.save.roadPos || 0) - sq.n); g.announce('rd_back', '#ff6b6b', 1.6, [], `◀ ${sq.n}`); g.audio.lose(); break;
      case 'again': this.addDice(1); g.announce('rd_again', '#ffb74d', 1.6, [], 'ONE MORE!'); break;
      case 'item': g.spawnRandomItem(); g.audio.itemGet(); break;
      case 'gem': if (this.s.f_gems) g.spawnItem(KIND.GEM); else g.shower(10); g.audio.itemGet(); break;
      case 'plinko': if (this.s.f_plinko) this.enqueue(() => this.plinko(), 'plinko'); else g.shower(10); break;
      case 'stock': this.save.stock = g.stockMax(); g.announce('rd_stock', '#00e5ff', 1.6, [], 'STOCK MAX'); g.audio.gate(); break;
      case 'ball': if (this.s.f_jp) g.spawnItem(KIND.BALL); else g.shower(15); g.audio.winBig(); break;
      case 'event': if (this.s.f_events && !this.event) this.startEvent(); else g.shower(15); break;
      case 'fever': if (this.s.f_fever) g.startFever(); else g.shower(25); break;
      case 'giant': this.spawnGiant(); break;
      case 'crane': g.startCrane(); break;
      case 'boss': {
        // the last square: big reward + JP ball
        const n = Math.round(30 * m); g.shower(Math.min(60, n)); if (n > 60) g.credit(n - 60, 'road');
        g.spawnItem(KIND.BALL); g.announce('rd_goal', 'rainbow', 2, [], `GOAL BONUS +${n}`); g.audio.winBig();
        g.boss.addGauge(Math.round(g.boss.need() * BOSS.gaugeRoad));
        break;
      }
    }
  }

  spawnGiant() {
    const g = this.g;
    g.physics.cmd('spawn', KIND.GIANT, rand(-4, 4), 7.5, rand(-1, 1.5), null, { x: 0, y: -4, z: 0 }, 0, 0, { x: rand(-1, 1), y: 0, z: rand(-1, 1) });
    g.ui.banner(t('ev_giant'), '#ffd34d', 2);
    setTimeout(() => { g.stage.addShake(0.9); g.audio.thump(0, 0.8, 70); g.vibrate([80, 40, 80]); }, 600);
  }

  // a heavy worthless rock falls onto the field (it blocks medals until pushed off)
  // fromBoss: thrown by the boss onto the pusher shelf (it rides forward with the medals)
  dropRock(x, fromBoss) {
    const g = this.g;
    if (x === undefined) x = rand(-(L.halfW - 2), L.halfW - 2);
    const z = fromBoss ? rand(L.backWallZ + 1.2, L.pusherFrontMin - 0.6) : rand(L.pusherFrontMax + 1.0, L.frontZ - 2.6);
    const a = Math.random() * Math.PI * 2;
    g.physics.cmd('spawn', KIND.ROCK, x, 7.5, z, { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }, { x: 0, y: -3, z: 0 }, 0, 0, { x: rand(-2, 2), y: rand(-1, 1), z: rand(-2, 2) });
    g.objCount++;
    if (!fromBoss) g.announce('ev_rock', '#c8b89a', 1.6, [], t('rockFall'));
    setTimeout(() => { g.stage.addShake(0.35); g.audio.thump(x / L.halfW * 0.8, 0.7, 55); g.vibrate(40); }, 650);
  }

  // ---------- random events ----------
  startEvent(id) {
    const g = this.g;
    let list = EVENTS;
    if (!id) { let r = Math.random() * list.reduce((a, b) => a + b.w, 0); for (const e of list) if ((r -= e.w) < 0) { id = e.id; break; } }
    const def = EVENTS.find(e => e.id === id) || EVENTS[0];
    this.event = { id, t: def.dur, dur: def.dur };
    this.nextEvent = rand(...EVENT_INTERVAL);
    g.prog.add('events');
    g.audio.siren(); g.audio.setMood('event');
    g.backboard.message('EVENT!', '#ff4060', 2.2, 120);
    g.announce('ev_' + id, '#ff8a65', 2.6, [def.dur], t('ev_' + id));
    switch (id) {
      case 'meteor':
        g.shower(20); g.shower(1, KIND.BIG); g.shower(3, KIND.GOLD);
        break;
      case 'giant': setTimeout(() => this.spawnGiant(), 1500); break;
      case 'tower': g.coinTower(rand(-(L.halfW - 2.5), -1.5)); setTimeout(() => g.coinTower(rand(1.5, L.halfW - 2.5)), 1400); break;
      case 'quake': this.event.quakes = 3; this.event.nextQuake = 1.2; break;
      case 'crane': setTimeout(() => g.startCrane(), 1200); break;
      case 'hyper': g.physics.cmd('stroke', g.upg('stroke') * 0.3 + 1.6); break;
      case 'challenge': this.event.start = g.save.stats.won || 0; this.event.target = Math.round(18 + L.halfW * 1.2); break;
    }
  }
  _challengeTick() {
    const e = this.event, g = this.g;
    const got = (g.save.stats.won || 0) - e.start;
    e.progress = got;
    if (got >= e.target && !e.done) {
      e.done = true;
      const r = 80 + g.save.level * 4;
      g.credit(r, 'event'); g.spawnRandomItem();
      g.ui.banner(`CHALLENGE CLEAR! +${r}`, 'rainbow', 2.2); g.audio.fanfare();
      g.prog.add('challenges');
      e.t = Math.min(e.t, 1);
    }
  }
  _endEvent() {
    const g = this.g, e = this.event;
    if (e.id === 'hyper') g.physics.cmd('stroke', g.upg('stroke') * 0.3);
    if (e.id === 'challenge' && !e.done) { g.ui.banner('TIME UP…', '#999'); g.audio.lose(); }
    this.event = null;
    g.audio.setMood('normal');
  }
  goldRush() { return this.event && this.event.id === 'goldRush' && Math.random() < 0.5; }
  // a timed event during which the player wants to keep dropping
  boostEvent() { return !!this.event && ['goldRush', 'hyper', 'luckyGate', 'challenge', 'spinField'].includes(this.event.id); }
  gateMult() { return this.event && this.event.id === 'luckyGate' ? 2.6 : 1; }
  speedMult() { return this.event && this.event.id === 'hyper' ? 1.45 : 1; }

  // ---------- mini games ----------
  // start: croon stage to start at (0 = top; the coaster SUPER / PREMIUM routes skip stages)
  async croon(start = 0) {
    const g = this.g, luck = g.upg('jp') * 0.08 + g.upg('luck') * 0.04;
    const stages = CROON.map((st, i) => ({
      title: ['JP CHANCE', 'SECOND STAGE', 'FINAL STAGE'][i],
      holes: st.holes.map(h => ({ ...h, w: h.good ? 1 + luck : 1 })),
    }));
    let r;
    if (this.s.f_tower3d && g.tower) r = await g.tower.run(stages, luck, g.physics, { camera: this.s.towerCam, startStage: start });
    else { r = await g.mini.croon(stages.slice(start), g.save.jpPool); if (r) r = { ...r, stage: r.stage + start }; }
    const h = r.hole;
    g.prog.max('croonBest', r.stage + (h.good ? 1 : 0));
    if (h.jp) return g.payJackpot();
    if (h.fever) { if (this.s.f_fever) g.startFever(); else g.shower(40); return; }
    if (h.n) { g.shower(Math.min(60, h.n)); if (h.n > 60) g.credit(h.n - 60, 'jp'); g.ui.banner(`+${h.n}`, '#ffd34d'); g.audio.winBig(); g.prog.max('biggestWin', h.n); }
  }
  async plinko() {
    const g = this.g;
    g.prog.add('plinkos');
    let p;
    if (this.s.f_plinko3d && g.plinko3d) {
      g.devMode = 'plinko'; g.holding = false;
      g.plinko3d.setAim(0);
      const slot = await g.plinko3d.run(g.physics, { camera: this.s.towerCam });
      g.devMode = null;
      p = PLINKO[slot] || PLINKO[4];
    } else p = await g.mini.plinko(PLINKO);
    if (p.ball) { if (this.s.f_jp) g.spawnItem(KIND.BALL); else g.shower(30); g.ui.banner('JP BALL!', '#ffd34d'); g.audio.winBig(); }
    else { g.shower(p.n); g.ui.banner(`+${p.n}`, '#ffd34d'); p.n >= 15 ? g.audio.winBig() : g.audio.win('small'); }
  }
}
