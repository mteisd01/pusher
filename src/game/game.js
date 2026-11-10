// Central game orchestrator: input -> physics -> events -> rewards -> presentation
import * as THREE from 'three';
import { L, KIND, TOKEN, CRANE } from '../core/layout.js';
import { B, ITEM_TABLE, ROULETTE, UPGRADES, upgradeCost, WHEEL, WHEEL_NEED, COIN_TOWER, COASTER_ROUTES, CRANE_PLAY, ballExit, offCenterX, routeStart, diffDef, ROCK_REWARD, BOSS, DIFF_REWARDS, DIFF_REWARD_STAGE } from './balance.js';
import { BossSystem } from './boss.js';
import { Progression } from './progression.js';
import { Slot } from './slot.js';
import { Features } from './features.js';
import { themeById, THEMES } from '../render/themes.js';
import { t } from '../i18n.js';
import { infoText, TOKEN_INFO } from './info.js';

const rand = (a, b) => a + Math.random() * (b - a);
const yawQ = () => { const a = Math.random() * Math.PI * 2; return { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }; };
const tiltQ = (amt) => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-amt, amt), rand(0, Math.PI * 2), rand(-amt, amt))); return { x: q.x, y: q.y, z: q.z, w: q.w }; };

export class Game {
  constructor(o) {
    Object.assign(this, o); // stage, coins, backboard, effects, audio, physics, ui, save, roulette
    this.t = t;
    this.balance = B;
    this.prog = new Progression(this);
    this.slot = new Slot(this);
    this.fx = { fever: 0, walls: 0, turbo: 0, double: 0, flipper: 0 };
    this.time = 0;
    this.aimX = 0; this.launcherX = 0;
    this.holding = false; this.holdTimer = 0; this.autoTimer = 0; this.sweep = 0;
    this.gateX = 0; this.gateFlash = 0;
    this.combo = 0; this.comboTimer = 0; this.comboPaid = 0;
    this.showerQueue = []; this.showerTimer = 0;
    this.jpQueue = 0;
    this.popAgg = { n: 0, x: 0, t: 0 };
    this.payoutFlash = 0;
    this.objCount = 0;
    this.lastNoCoinToast = 0;
    this.sessionStart = performance.now();
    this.wallsSent = null; this.speedSent = null;
    this.pauseReasons = new Set();
    this.strokeCoins = 0;
    this.devMode = null;          // 'crane' | 'plinko' while an on-table device takes the input
    this.features = new Features(this);
    this.boss = new BossSystem(this);
  }

  get paused() { return this.pauseReasons.size > 0; }
  setPause(reason, on) {
    const was = this.paused;
    if (on) this.pauseReasons.add(reason); else this.pauseReasons.delete(reason);
    if (was !== this.paused) {
      this.holding = false;
      this.audio.setPaused && this.audio.setPaused(this.paused);
      this.ui.onPauseChange && this.ui.onPauseChange(this.paused, this.pauseReasons.has('user'));
    }
  }

  get settings() { return this.save.settings; }
  get diff() { return diffDef(this.settings.difficulty); }
  upg(id) { return this.prog.upg(id); }
  stockMax() { return B.stockBase + this.upg('stock'); }
  // gate width without the boss jam (the jam beam occupies this width)
  gateHalfRaw() { return (B.gate.half + B.gate.halfPerLv * this.upg('gate')) * Math.pow(L.halfW / 11, 1.2) * this.diff.gate * (this.fx.fever > 0 ? 1.6 : 1) * this.features.gateMult(); }
  gateHalf() { return this.gateHalfRaw() * this.boss.gateMult(); }
  get overlayBusy() { return this.features.busy || this.roulette.active || this.jpRunning; }
  // while a device or lottery holds the input, timed effects (fever, turbo, events, the boss
  // clock…) stand still so a chance never costs boost time
  timeStopped() { return !!(this.devMode || this.overlayBusy || (this.tower && this.tower.active)); }
  // a timed boost is running (interactive chances wait for it to end)
  boostActive() { return this.fx.fever > 0 || this.fx.turbo > 0 || this.fx.double > 0 || this.features.boostEvent(); }
  slotLuck() { return (1 + 0.06 * this.upg('luck') + this.prog.gemLuck()) * this.diff.slot * (this.fx.fever > 0 ? 1.4 : 1); }
  itemRate() { return (B.itemRate + B.itemRatePerLv * this.upg('item')) * this.diff.item; }
  autoRate() { return B.autoRateBase + B.autoRatePerLv * this.upg('auto'); }
  regenCap() { return Math.round((B.regen.capBase + B.regen.capPerLv * this.upg('regen')) * this.diff.regen); }
  regenSec() { return B.regen.secBase - B.regen.secPerLv * this.upg('regen'); }
  jpBase() { return B.jp.base + B.jp.basePerLv * this.upg('jp'); }
  theme() { return themeById(this.settings.theme); }

  start() {
    const s = this.save;
    // offline regeneration
    if (this.settings.f_regen && s.lastSeen) {
      const el = (Date.now() - s.lastSeen) / 1000;
      const n = Math.max(0, Math.min(this.regenCap() - s.coins, Math.floor(el / this.regenSec())));
      if (n > 0 && el > 60) { s.coins += n; setTimeout(() => this.toast('⏳', t('offlineEarn', n)), 1500); }
    }
    this.prog.ensureMissions();
    if (this.settings.f_login) {
      const lb = this.prog.checkLogin();
      if (lb) setTimeout(() => this.ui.showLogin(lb, () => {
        this.credit(lb.reward, 'login');
        if (lb.gem) this.spawnItem(KIND.GEM, this.prog.rollGem(Math.random, this.diff.gem));
        this.audio.levelUp();
      }), 900);
    }
    if (s.jpPool < this.jpBase()) s.jpPool = this.jpBase();
    if (this.settings.f_hints && (s.tutorial || 0) < 4) this.ui.startHints();
  }

  // ---------- input ----------
  setAim(x) {
    this.aimX = Math.max(-(L.halfW - 0.7), Math.min(L.halfW - 0.7, x));
    if (this.devMode === 'plinko' && this.plinko3d) this.plinko3d.setAimWorld(this.aimX);
  }
  press(x) {
    if (this.paused) return;
    if (this.devMode) {
      if (x !== undefined) this.setAim(x);
      if (this.devMode === 'crane') { this.physics.cmd('craneAim', this.aimX); this.physics.cmd('craneDrop'); }
      else if (this.devMode === 'plinko' && this.plinko3d) this.plinko3d.drop();
      return;
    }
    if (this.overlayBusy) return;
    if (x !== undefined) this.setAim(x);
    this.launcherX = this.aimX;
    this.drop();
    this.holding = true; this.holdTimer = 0;
  }
  release() { this.holding = false; }

  canAfford(n) { return this.save.coins >= n * B.dropCost; }

  drop() {
    const n = 1 + this.upg('multi');
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (!this.canAfford(1)) break;
      if (this.objCount > this.settings.maxObjects + 80) break;
      this.save.coins -= B.dropCost;
      const off = n > 1 ? (i - (n - 1) / 2) * 0.75 : 0;
      const x = Math.max(-(L.halfW - 0.6), Math.min(L.halfW - 0.6, this.launcherX + off + rand(-0.08, 0.08)));
      const gold = this.features.goldRush() || (this.fx.fever > 0 && Math.random() < B.fever.goldChance) || Math.random() < B.goldRatePerLv * this.upg('gold');
      this.physics.cmd('spawn', gold ? KIND.GOLD : KIND.SILVER, x, L.dropY - 0.1, L.dropZ + rand(-0.15, 0.15), tiltQ(0.25), { x: rand(-0.2, 0.2), y: -2.5, z: rand(-0.1, 0.25) }, 0, 1);
      k++;
    }
    if (!k) {
      if (this.time - this.lastNoCoinToast > 3) { this.lastNoCoinToast = this.time; this.toast('🪙', t('outOfCoins')); }
      return;
    }
    this.audio.drop(this.launcherX / L.halfW * 0.8);
    this.vibrate(8);
    this.prog.add('dropped', k);
    this.boss.addGauge(k);
    this.prog.addXp(k);
    if (this.settings.f_jp) this.save.jpPool += B.jp.growPerDrop * k * (1 + Object.keys(this.save.gems).length * 0.01) * this.diff.jp;
    if (this.settings.f_items && Math.random() < this.itemRate() * k) this.spawnRandomItem();
    this.dropsSinceSave = (this.dropsSinceSave || 0) + 1;
  }

  vibrate(ms) { if (this.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

  // ---------- spawning ----------
  shower(n, kind = KIND.SILVER) {
    for (let i = 0; i < n; i++) this.showerQueue.push(kind);
  }
  spawnItem(kind, extra = 0) {
    if (kind === KIND.BALL) { this.launchBall(); return; }
    if (kind === KIND.GEM && extra === 0) extra = this.prog.rollGem(Math.random, this.diff.gem);
    // items land on the shelf a little off the middle (not at the ends, where they slide into a gutter)
    this.physics.cmd('spawn', kind, offCenterX(Math.random, 0.05, 0.5), 6.5, rand(L.backWallZ + 1.2, L.pusherFrontMin - 0.8), tiltQ(0.4), { x: 0, y: -1, z: 0 }, extra, 0);
  }
  // JP balls never start on the shelf (a ball rolls in place on the moving pusher):
  // they come in over the ball coaster, or straight onto the field when it is off.
  launchBall() {
    const co = this.settings.f_coaster && this.machines && this.machines.coaster;
    const route = this.pickBallRoute();
    const dropX = offCenterX();
    const toCroon = r => {
      this.prog.add('items'); this.queueJackpot(routeStart(r));
      this.backboard.message(r === 'premium' ? 'PREMIUM!!' : 'SUPER!', r === 'premium' ? '#ffd34d' : '#c070ff', 2, 80);
      this.announce('route_' + r, r === 'premium' ? '#ffd34d' : '#c070ff', 2);
      r === 'premium' ? this.audio.winBig() : this.audio.itemGet();
    };
    if (co) {
      co.launch(route, (r, pos, vel) => {
        if (r !== 'field') { toCroon(r); return; }
        this.physics.cmd('spawn', KIND.BALL, pos.x, pos.y, pos.z, null, vel, 0, 0);
        this.objCount++;
      }, dropX);
      this.prog.add('coasters');
      return;
    }
    if (route !== 'field') { toCroon(route); return; }
    const e = ballExit(dropX, L.pusherFrontMax + this.upg('stroke') * 0.3);
    this.physics.cmd('spawn', KIND.BALL, e.x, e.y, e.z, null, e.v, 0, 0);
    this.objCount++;
  }
  // a JP lottery waits in the queue; startStage: croon stage it starts at (coaster SUPER / PREMIUM)
  queueJackpot(startStage = 0) { this.jpQueue++; (this.jpStarts || (this.jpStarts = [])).push(startStage); }
  pickBallRoute() {
    const luck = 1 + 0.1 * this.upg('luck') + 0.1 * this.upg('jp');
    const list = COASTER_ROUTES.map(r => ({ ...r, w: r.id === 'field' ? r.w : r.w * luck }));
    let x = Math.random() * list.reduce((a, b) => a + b.w, 0);
    for (const r of list) if ((x -= r.w) < 0) return r.id;
    return 'field';
  }

  // ---------- crane ----------
  startCrane() {
    if (!this.settings.f_crane) { this.shower(8); return; }
    this.features.enqueue(() => this.runCrane(), 'crane');
  }
  runCrane() {
    this.devMode = 'crane';
    this.holding = false;
    this.prog.add('cranes');
    this.physics.cmd('craneStart', CRANE_PLAY.maxGrab, CRANE_PLAY.slip);
    this.physics.cmd('craneAim', this.aimX);
    // prize capsules: sure items placed on the field in the claw's reach
    const np = CRANE_PLAY.prizes[0] + Math.floor(Math.random() * (CRANE_PLAY.prizes[1] - CRANE_PLAY.prizes[0] + 1));
    for (let i = 0; i < np; i++) {
      const tb = CRANE_PLAY.prizeTable;
      let r = Math.random() * tb.reduce((a, b) => a + b.w, 0), p = tb[0];
      for (const it of tb) if ((r -= it.w) < 0) { p = it; break; }
      if (p.kind === 'ball' && !this.settings.f_jp) p = tb[0];
      const kind = p.kind === 'ball' ? KIND.BALL : p.kind === 'chest' ? KIND.CHEST : p.kind === 'rainbow' ? KIND.RAINBOW : KIND.TOKEN;
      const extra = p.kind === 'token' ? TOKEN[p.extra] : 0;
      const x = offCenterX(Math.random, 0.05, 0.5), z = rand(L.pusherFrontMax + 1.2, CRANE.z1 - 0.2);
      this.physics.cmd('spawn', kind, x, 3.5, z, null, { x: 0, y: -2, z: 0 }, extra, 0);
      this.objCount++;
      setTimeout(() => this.effects.burst(x, 0.6, z, '#ff4fa0', 24, 4, 0.7, 0.9), 400);
    }
    this.backboard.message('CRANE CHANCE', '#ff4fa0', 2, 80);
    this.announce('crane', '#ff4fa0', 2.4, [], 'CRANE CHANCE!');
    this.audio.brass && this.audio.brass(0, [64, 67, 72], 0.5, 0.15);
    return new Promise(res => { this._craneDone = res; });
  }
  _onCrane(e) {
    if (e.ph === 'close') { this.devMode = 'craneBusy'; this.audio.thump(0, 0.3, 140); }
    else if (e.ph === 'grab') {
      this.prog.add('craneGrabs', e.n);
      this.boss.damage(e.n * BOSS.dmg.grab + (e.items || 0) * BOSS.dmg.item, this.aimX);
      this.ui.popup(e.n ? `GRAB ×${e.n}` : 'MISS…', this.aimX, 4, 0, e.n ? '#ff4fa0' : '#999', 1.3);
      e.n ? this.audio.gate() : this.audio.lose();
    } else if (e.ph === 'drop') {
      // the prize chute pays the carried medals again on top of their normal value
      const v = (e.kinds || []).reduce((a, k) => a + (k <= KIND.BIG || k === KIND.GIANT ? B.value[k] || 0 : 0), 0) * (CRANE_PLAY.payMult - 1);
      if (v > 0) { this.credit(v, 'crane'); this.ui.popup(`PRIZE ×${CRANE_PLAY.payMult} +${v}`, e.x, 2.5, L.frontZ, '#ff4fa0', 1.6); }
      this.effects.burst(e.x, 1.2, L.frontZ + 0.4, '#ff4fa0', 30, 5, 0.8, 1);
      this.audio.payout(4, e.x / L.halfW * 0.8, false); this.stage.addShake(0.15);
    }
    else if (e.ph === 'done') { this.devMode = null; const r = this._craneDone; this._craneDone = null; r && r(); }
  }

  spawnRandomItem() {
    let table = ITEM_TABLE.filter(it => {
      if (it.kind === KIND.BALL && !this.settings.f_jp) return false;
      if (it.kind === KIND.GEM && !this.settings.f_gems) return false;
      if (it.kind === KIND.TOKEN && it.extra === TOKEN.WALL && !this.settings.f_walls) return false;
      if (it.kind === KIND.TOKEN && it.extra === TOKEN.FEVER && !this.settings.f_fever) return false;
      return true;
    });
    let r = Math.random() * table.reduce((a, b) => a + b.w, 0);
    for (const it of table) { if ((r -= it.w) < 0) { this.spawnItem(it.kind, it.extra || 0); return it; } }
  }

  _processShower(dt) {
    if (!this.showerQueue.length) return;
    this.showerTimer -= dt;
    let budget = 0;
    while (this.showerTimer <= 0 && this.showerQueue.length && budget < 4) {
      this.showerTimer += 1 / 28;
      budget++;
      const kind = this.showerQueue.shift();
      if (this.objCount >= this.settings.maxObjects && kind <= KIND.GOLD) {
        // table full: pay directly
        this.credit(B.value[kind] || 1, 'shower');
        continue;
      }
      const hop = this.settings.f_hopper && this.machines && this.machines.hopper;
      // big / rainbow / giant medals land a little off the middle (the ends feed the gutters / OUT zones)
      const special = kind >= KIND.RAINBOW;
      if (hop) {
        // poured from the hopper bucket that sweeps over the table
        if (special && hop.specialX == null) hop.specialX = offCenterX();
        const pt = hop.pourPoint(special);
        if (!pt) { this.showerQueue.unshift(kind); this.showerTimer = 0.05; break; }
        if (special) {
          hop._lastSpecial = hop.specialX; hop.specialX = null;
          this.physics.cmd('spawn', kind, pt.x, pt.y, pt.z, tiltQ(0.3), { x: rand(-0.3, 0.3), y: -1, z: rand(0.5, 2.5) }, 0, 0, { x: rand(-2, 2), y: 0, z: rand(-2, 2) });
        } else this.physics.cmd('spawn', kind, pt.x, pt.y, pt.z, tiltQ(1.2), { x: rand(-1.2, 1.2), y: rand(-2, 0), z: rand(-1.5, 4.5) }, 0, 0, { x: rand(-6, 6), y: 0, z: rand(-6, 6) });
        if (Math.random() < 0.5) this.audio.drop(pt.x / L.halfW * 0.8);
      } else if (special) this.physics.cmd('spawn', kind, offCenterX(), rand(5.5, 7.5), rand(-3.5, 0.5), tiltQ(0.3), { x: 0, y: rand(-3, 0), z: 0 }, 0, 0, { x: rand(-2, 2), y: 0, z: rand(-2, 2) });
      else this.physics.cmd('spawn', kind, rand(-(L.halfW - 0.7), L.halfW - 0.7), rand(5.5, 7.5), rand(L.backWallZ + 0.7, L.frontZ - 3.5), tiltQ(1.2), { x: 0, y: rand(-3, 0), z: 0 }, 0, 0, { x: rand(-4, 4), y: 0, z: rand(-4, 4) });
      this.objCount++;
    }
    if (this.showerTimer < -0.5) this.showerTimer = 0;
  }

  // ---------- economy ----------
  credit(n, src) {
    if (n <= 0) return;
    this.save.coins += Math.round(n);
    this.prog.max('maxWallet', this.save.coins);
    if (src === 'win') this.prog.add('won', n);
  }

  // ---------- physics events ----------
  onPhysicsFrame(msg) {
    if (msg.croon && this.tower) this.tower.onPhysics(msg.croon);
    if (msg.plinko && this.plinko3d) this.plinko3d.onPhysics(msg.plinko);
    this.objCount = msg.n;
    this.physMs = msg.ms;
    for (const e of msg.ev) {
      if (e.t === 'out') this._onOut(e);
      else if (e.t === 'stroke') this._onStroke();
      else if (e.t === 'gate') this._onGate(e);
      else if (e.t === 'catch') this._onCatch(e);
      else if (e.t === 'crane') this._onCrane(e);
      else if (e.t === 'kick') { this.ui.popup('KICK!', e.x, 3, L.backWallZ + 1, '#ff7043', 1.2); this.audio.thump(0, 0.5, 90); this.kickWarn = 0; }
      else if (e.t === 'drain') this._onDrain(e);
      else if (e.t === 'flip') this._onFlip(e);
      else if (e.t === 'hit') this.audio.impact(e, L.halfW);
      else if (e.t === 'mv') this.motion = e.v;
    }
  }

  _onGate(e) {
    if (!this.settings.f_slot) return;
    if (this.boss.jam > 0) { if (Math.abs(e.x - this.gateX) <= this.gateHalfRaw() * BOSS.beamReach) this.boss.hitBeam(e.x); return; }
    if (Math.abs(e.x - this.gateX) > this.gateHalf()) return;
    this.prog.add('gatePasses');
    this.features.onGatePass();
    this.boss.addGauge(BOSS.gaugePerGate);
    this.boss.onGate(e.x);
    this.gateFlash = 1;
    this.effects.burst(e.x, L.gateY, L.dropZ, this.theme().accent, 10, 3, 0.5, 0.5);
    if (this.save.stock < this.stockMax()) {
      this.save.stock++;
      this.audio.gate();
    } else {
      this.save.jpPool += 2 * this.diff.jp;
      this.audio.stock();
    }
  }

  _onOut(e) {
    const s = this.settings;
    if (e.pocket && s.f_bonusZone) { this.features.onPocket(e); return; }
    if (!e.won) {
      this.prog.add('lost');
      if (e.corner) { this.cornerOut = (this.cornerOut || 0) + 1; if (this.time - (this.cornerPopT || 0) > 1.2) { this.cornerPopT = this.time; this.ui.popup('OUT', e.x, 0.5, L.frontZ, '#ff5252', 1.1); } }
      if (e.kind >= KIND.BALL && e.kind !== KIND.ROCK) { this.toast('💨', t('lostItem')); this.audio.lost(); }
      return;
    }
    const mult = this.fx.double > 0 ? 2 : 1;
    const fxPos = [e.x, 0.2, L.frontZ + 0.2];
    switch (e.kind) {
      case KIND.SILVER: case KIND.GOLD: case KIND.RAINBOW: case KIND.BIG: case KIND.GIANT: {
        const zone = this.features.inBonusZone(e.x);
        const v = B.value[e.kind] * mult * (zone && e.kind !== KIND.SILVER ? 2 : 1);
        this.credit(v, 'win');
        const bd = BOSS.dmg;
        this.boss.damage(e.kind === KIND.SILVER ? bd.silver : e.kind === KIND.GOLD ? bd.gold : e.kind === KIND.RAINBOW ? bd.rainbow : bd.big, e.x);
        if (zone && Math.random() < 0.18) {
          if (s.f_slot && this.save.stock < this.stockMax()) { this.save.stock++; this.ui.popup('+1 STOCK', e.x, 1.2, L.frontZ, '#7CFFB2', 1.3); }
          this.audio.gate();
        }
        this.prog.addXp(e.kind === KIND.SILVER ? 0 : Math.ceil(v / 5));
        this.strokeCoins += 1;
        this.coins.addTray(e.kind, e.x);
        this._pop(v, e.x, e.kind);
        this.audio.payout(e.kind === KIND.SILVER ? 1 : 3, e.x / L.halfW * 0.8, e.kind === KIND.BIG || e.kind === KIND.GIANT);
        const col = e.kind === KIND.GOLD ? '#ffcc33' : e.kind === KIND.RAINBOW ? `hsl(${Math.random() * 360},100%,60%)` : e.kind === KIND.BIG ? '#ffd34d' : '#e8f0ff';
        this.effects.burst(...fxPos, col, e.kind === KIND.SILVER ? 4 : 14, 3, e.kind === KIND.SILVER ? 0.35 : 0.6, 0.6);
        this.payoutFlash += e.kind === KIND.SILVER ? 0.15 : 0.6;
        break;
      }
      case KIND.ROCK:
        this.prog.add('rocks');
        if (this.boss.active) { this.boss.damage(BOSS.dmg.rock, e.x, false, true); this.ui.popup(`COUNTER -${BOSS.dmg.rock}`, e.x, 5.5, L.backWallZ + 0.5, '#ffd34d', 1.4); }
        this.credit(ROCK_REWARD, 'rock');
        this.ui.popup(`ROCK +${ROCK_REWARD}`, e.x, 0.6, L.frontZ, '#c8b89a', 1.3);
        this.audio.thump(e.x / L.halfW * 0.8, 0.5, 80);
        this.effects.burst(...fxPos, '#9e8b6e', 24, 4, 0.7, 0.9);
        break;
      case KIND.BALL:
        this.boss.damage(BOSS.dmg.ball, e.x);
        this.prog.add('items');
        if (s.f_jp) { this.queueJackpot(0); this.backboard.message(t('jpChance'), '#ffd34d', 2, 80); this.audio.itemGet(); }
        else this.credit(20, 'win');
        break;
      case KIND.GEM: {
        this.boss.damage(BOSS.dmg.item, e.x);
        this.prog.add('items');
        const r = this.prog.collectGem(e.extra);
        const name = `${t('gemType')[r.type]}${this.settings.lang === 'en' ? ' ' : '・'}${t('gemRarity')[r.rarity]}`;
        this.credit(r.reward, 'item');
        this.toast('💎', `${name}${r.isNew ? ' NEW!' : ''} +${r.reward}`);
        if (r.setBonus) { this.credit(r.setBonus, 'item'); this.toast('🏆', `${t('gemSetBonus')}: ${t('gemType')[r.type]} +${r.setBonus}`); }
        this.effects.burst(...fxPos, ['#ff1744', '#2979ff', '#00e676', '#ffc400', '#d500f9', '#ffffff'][r.type], 20 + r.rarity * 15, 5, 0.8, 1.2);
        this.audio.itemGet();
        break;
      }
      case KIND.CHEST: {
        this.boss.damage(BOSS.dmg.item, e.x);
        this.prog.add('items'); this.prog.add('chests');
        if (e.extra === 1) { this._bossChest(fxPos); break; }
        const r = Math.random();
        if (r < 0.5) { const n = Math.round(rand(15, 60)); this.credit(n, 'item'); this.toast('🧰', `${t('chest')} +${n}`); }
        else if (r < 0.75 && s.f_gems) { this.spawnItem(KIND.GEM); this.toast('🧰', `${t('chest')} → 💎`); }
        else { this.spawnRandomItem(); this.toast('🧰', `${t('chest')} → 🎁`); }
        this.effects.burst(...fxPos, '#ffd34d', 30, 5, 0.8, 1);
        this.audio.itemGet();
        break;
      }
      case KIND.TOKEN:
        this.boss.damage(BOSS.dmg.item, e.x);
        this.prog.add('items');
        this.activateToken(e.extra);
        this.effects.burst(...fxPos, '#ffffff', 24, 5, 0.7, 1);
        break;
    }
  }

  // flipper kick: medals knocked back from the gutters, summed up as a SAVE popup
  _onFlip(e) {
    this.audio.thump(0, 0.18, 220);
    if (!e.n) return;
    this.prog.add('flipSaves', e.n);
    this.flipSave = (this.flipSave || 0) + e.n;
    clearTimeout(this._flipT);
    this._flipT = setTimeout(() => { if (this.flipSave) { this.ui.popup(`SAVE +${this.flipSave}`, (this._flipSide = -(this._flipSide || 1)) * (L.halfW - 1.5), 1.2, L.sideWallEnd + 1.5, '#9fa8ff', 1.3); this.flipSave = 0; } }, 600);
  }

  _pop(v, x, kind) {
    if (!this.settings.f_floatText) return;
    const a = this.popAgg;
    if (kind !== KIND.SILVER) { this.ui.popup(`+${v}`, x, 0.4, L.frontZ, kind === KIND.RAINBOW ? 'rainbow' : '#ffd34d', 1.3); return; }
    a.n += v; a.x = a.x * 0.6 + x * 0.4;
    if (a.t <= 0) a.t = 0.25;
  }

  // "Push combo": coins won during a single pusher stroke
  _onStroke() {
    const n = this.strokeCoins;
    this.strokeCoins = 0;
    this.combo = n;
    if (!this.settings.f_combo || n < B.combo.steps[0][0]) return;
    this.prog.max('maxCombo', n);
    this.prog.checkMissions('combo', n);
    let bonus = 0;
    for (const [k, b] of B.combo.steps) if (n >= k) bonus = b;
    this.credit(bonus, 'combo');
    this.boss.damage(Math.round(n * BOSS.dmg.combo), 0);
    this.ui.banner(`PUSH COMBO ${n}! +${bonus}`, n >= 40 ? 'rainbow' : '#ffd34d');
    this.audio.combo(n);
    this.stage.addShake(0.12);
  }

  activateToken(tok) {
    const s = this.settings;
    this.audio.itemGet();
    const durs = { [TOKEN.WALL]: Math.round((B.walls.dur + B.walls.durPerLv * this.upg('wall')) * this.diff.walls), [TOKEN.TURBO]: B.turbo.dur, [TOKEN.DOUBLE]: B.double.dur, [TOKEN.FEVER]: this.feverDur(), [TOKEN.MAGNET]: 12, [TOKEN.FLIPPER]: B.flipperDur };
    this.announce(TOKEN_INFO[tok], '#7fe7ff', 1.8, [durs[tok] || '']);
    switch (tok) {
      case TOKEN.WALL:
        if (!s.f_walls) { this.shower(10); break; }
        this.fx.walls += (B.walls.dur + B.walls.durPerLv * this.upg('wall')) * this.diff.walls;
        this.prog.add('walls'); this.audio.wall();
        break;
      case TOKEN.SHOWER: this.shower(25); break;
      case TOKEN.TURBO: this.fx.turbo += B.turbo.dur; break;
      case TOKEN.DOUBLE: this.fx.double += B.double.dur; break;
      case TOKEN.FEVER: if (s.f_fever) this.startFever(); else this.shower(30); break;
      case TOKEN.STOCK: this.save.stock = this.stockMax(); break;
      case TOKEN.PLINKO: if (s.f_plinko) this.features.enqueue(() => this.features.plinko(), 'plinko'); else this.shower(12); break;
      case TOKEN.DICE: if (s.f_sugoroku) this.features.addDice(2); else this.shower(8); break;
      case TOKEN.MAGNET: this.fx.magnet = (this.fx.magnet || 0) + 12; break;
      case TOKEN.SHAKE: setTimeout(() => this.tableShake(1), 500); break;
      case TOKEN.CRANE: this.startCrane(); break;
      case TOKEN.FLIPPER: if (s.f_flipper) { this.fx.flipper = (this.fx.flipper || 0) + B.flipperDur; this.prog.add('flips'); } else this.shower(6); break;
      case TOKEN.BOMB: {
        const x = rand(-L.halfW + 3, L.halfW - 3), z = rand(1, L.frontZ - 2.5);
        setTimeout(() => {
          this.physics.cmd('blast', x, z, 3.2, 7);
          this.effects.burst(x, 0.5, z, '#ff9e1b', 60, 9, 1, 0.9);
          this.stage.addShake(0.7); this.audio.thump(0, 0.9, 60); this.audio.noiseHit(0, 0.5, 'lowpass', 1200, 0.5);
          this.vibrate(60);
        }, 700);
        break;
      }
    }
  }

  feverDur() { return B.fever.dur + B.fever.durPerLv * this.upg('fever'); }
  startFever() {
    const first = this.fx.fever <= 0;
    this.fx.fever += this.feverDur();
    if (first) {
      this.prog.add('fevers');
      this.audio.fever = true;
      this.backboard.message('FEVER!!', 'rainbow', 2.5, 120);
      this.announce('tok_fever', 'rainbow', 1.8, [this.feverDur()], 'FEVER TIME!!');
      this.effects.confetti(80);
      this.audio.fanfare();
      this.stage.addShake(0.5);
    }
  }

  // ---------- slot callbacks ----------
  onSlotStart() { this.prog.add('slotSpins'); this.audio.reelStart && this.audio.reelStart(); }
  onReach() { this.backboard.message(t('reach'), '#ff4060', 1.4, 110); this.audio.reach(); }
  onSlotResult(o) {
    if (!o) { this.audio.lose(); return; }
    this.prog.add('slotWins');
    this.prog.addXp(5);
    this.boss.damage(BOSS.dmg.slot * (o.kind === 'fever' || o.kind === 'ball' || o.kind === 'rainbow' ? 2 : 1), 0);
    const s = this.settings;
    switch (o.kind) {
      case 'fever':
        this.prog.add('sevens');
        if (s.f_fever) this.startFever(); else this.backboard.message('777', '#ff2d55', 2, 140);
        this.shower(o.shower + (s.f_fever ? 0 : 40));
        this.audio.winBig();
        break;
      case 'ball': this.launchBall(); this.backboard.message('JP BALL!', '#ffd34d', 2, 100); this.audio.winBig(); break;
      case 'shower':
        this.shower(o.shower);
        if (o.dice) this.features.addDice(o.dice);
        this.backboard.message(o.shower >= 20 ? t('bigWin') : `+${o.shower}`, '#fff200', 1.6, o.shower >= 20 ? 110 : 120);
        o.shower >= 10 ? this.audio.win('bar') : this.audio.win(o.sym === 2 ? 'bell' : 'cherry');
        break;
      case 'item': if (s.f_items) this.spawnRandomItem(); else this.shower(8); this.backboard.message('ITEM!', '#7fe7ff', 1.6, 120); this.audio.win('item'); break;
      case 'gold': this.shower(o.n, KIND.GOLD); this.backboard.message('GOLD!', '#ffcc33', 1.6, 120); this.audio.win('gold'); break;
      case 'rainbow': this.shower(o.n, KIND.RAINBOW); this.backboard.message('RAINBOW!', 'rainbow', 2, 110); this.audio.winBig(); break;
    }
    if (o.kind === 'fever' || o.kind === 'ball' || o.kind === 'rainbow') { this.effects.confetti(50); this.stage.addShake(0.3); }
  }

  // ---------- jackpot ----------
  async _runJackpot() {
    this.jpQueue--;
    const start = (this.jpStarts && this.jpStarts.shift()) || 0;
    this.jpRunning = true;
    this.holding = false;
    this.prog.add('jpLottery');
    let idx = Math.floor(Math.random() * ROULETTE.length);
    if (Math.random() < 0.02 * this.upg('jp') + 0.01 * this.upg('luck')) idx = 0;
    if (this.settings.f_croon) {
      this.jpRunning = false;
      this.features.enqueue(() => this.features.croon(start), 'croon');
      return;
    }
    const res = await this.roulette.run(idx, this.save.jpPool, this.settings.jpSkip, t('jpChance'));
    this.jpRunning = false;
    switch (res.id) {
      case 'JP': this.payJackpot(); break;
      case 'c': {
        const n = res.n;
        this.shower(Math.min(60, n)); if (n > 60) this.credit(n - 60, 'jp');
        this.prog.max('biggestWin', n);
        this.ui.banner(`+${n}`, '#ffd34d'); this.audio.winBig(); this.effects.confetti(40);
        break;
      }
      case 'FEVER': if (this.settings.f_fever) this.startFever(); else this.shower(40); break;
      case 'BIG': this.shower(3, KIND.BIG); this.ui.banner(t('bigMedal') + ' ×3', '#ffd34d'); this.audio.winBig(); break;
      case 'WALL': this.activateToken(TOKEN.WALL); break;
    }
  }

  payJackpot() {
    const pool = Math.floor(this.save.jpPool);
    this.save.jpPool = this.jpBase();
    this.prog.add('jpWins');
    this.prog.max('biggestWin', pool);
    let rest = pool;
    const bigs = Math.min(8, Math.floor(rest * 0.4 / 30));
    this.shower(bigs, KIND.BIG); rest -= bigs * 30;
    const sil = Math.min(B.maxShowerPhysical, rest); this.shower(sil); rest -= sil;
    if (rest > 0) this.credit(rest, 'jp');
    this.backboard.message('JACKPOT!!', 'rainbow', 4, 110);
    this.ui.banner(`JACKPOT!! ${pool.toLocaleString()}`, 'rainbow', 3.5);
    this.audio.jackpot();
    this.effects.confetti(300);
    this.stage.addShake(1);
    this.vibrate([60, 40, 60, 40, 120]);
  }

  onLevelUp(lv, reward) {
    this.audio.levelUp();
    this.ui.banner(`${t('levelUp')} Lv${lv}`, '#7CFFB2');
    this.toast('⭐', `Lv${lv}  +${reward}`);
    const th = THEMES.find(x => x.unlock === lv);
    if (th) this.toast('🎨', `${t('themes')}: ${th.name[this.settings.lang === 'en' ? 'en' : 'ja'] || th.name.ja}`);
    this.effects.confetti(60);
  }
  onAchievement(a) {
    if (this.settings.f_achievePopups) this.ui.achievement(a);
  }
  onMissionDone(m) { this.toast('✅', `${t('missionDone')}: ${this.ui.missionText(m)}`); this.audio.itemGet(); }
  toast(icon, text) { this.ui.toast(icon, text); }
  // banner with a plain explanation underneath; the first time an id shows up, also an info card
  announce(id, color = '#7fe7ff', dur = 1.8, args = [], title) {
    const inf = infoText(id, ...args);
    if (!inf) { this.ui.banner(title || id, color, dur); return; }
    this.ui.banner(title || inf.name, color, dur, inf.desc);
    const seen = this.save.seenInfo || (this.save.seenInfo = {});
    if (!seen[id] && this.settings.f_hints !== false) { seen[id] = 1; this.ui.infoCard && this.ui.infoCard(inf); }
  }

  // ---------- shop ----------
  upgradeCost(u, lv) { return Math.round(upgradeCost(u, lv) * (this.diff.upgCost || 1) / 10) * 10; }
  buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    const lv = this.upg(id);
    if (!u || lv >= u.max) return false;
    const cost = this.upgradeCost(u, lv);
    if (this.save.coins < cost) { this.toast('🪙', t('notEnough')); return false; }
    this.save.coins -= cost;
    this.save.upgrades[id] = lv + 1;
    this.prog.dirtyAch = true;
    this.audio.levelUp();
    if (id === 'stroke') this.physics.cmd('stroke', this.upg('stroke') * 0.3);
    return true;
  }

  gateXAt(time) {
    const range = Math.min(B.gate.range, L.halfW - 2);
    const w = Math.PI * 2 / B.gate.period;
    return Math.sin(time * w + Math.sin(time * w * 0.37) * 0.9) * range;
  }

  // ---------- main update ----------
  update(dt) {
    this.time += dt;
    const s = this.settings;
    // fx timers
    const stopped = this.timeStopped();
    if (!stopped) for (const k in this.fx) if (this.fx[k] > 0) { this.fx[k] = Math.max(0, this.fx[k] - dt); if (k === 'fever' && this.fx.fever === 0) this.audio.fever = false; }
    const walls = (this.fx.walls > 0 || !s.sideLoss) && !this.boss.wallsBlocked();
    if (walls !== this.wallsSent) { this.physics.cmd('walls', walls); this.wallsSent = walls; }
    const speed = (this.fx.turbo > 0 ? B.turbo.speed : 1) * (this.fx.fever > 0 ? 1.15 : 1) * this.features.speedMult() * this.boss.speedMult();
    if (speed !== this.speedSent) { this.physics.cmd('speed', speed); this.speedSent = speed; }
    const oz = +((this.diff.outZone || 0) * L.halfW / 11).toFixed(2);   // same share of the front edge on every table size
    if (oz !== this.outSent) { this.physics.cmd('outZone', oz); this.outSent = oz; }
    const mag = this.fx.magnet > 0;
    if (mag !== this.magSent) { this.physics.cmd('magnet', mag); this.magSent = mag; }
    const flip = !!s.f_flipper && (this.fx.flipper > 0 || this.fx.fever > 0);
    if (flip !== this.flipSent) { this.physics.cmd('flippers', flip); this.flipSent = flip; }
    const tt = !!s.f_turntable && (this.fx.fever > 0 || (this.features.event && this.features.event.id === 'spinField'));
    if (tt !== this.ttSent) { this.physics.cmd('turntable', tt); this.ttSent = tt; }
    if (this.devMode === 'crane') this.physics.cmd('craneAim', this.aimX);
    // gate motion (speed wobbles so that timing matters)
    this.gateX = this.gateXAt(this.time);
    this.gateFlash = Math.max(0, this.gateFlash - dt * 2.5);
    // input repeat
    if (!this.overlayBusy) {
      if (this.holding && s.holdRepeat) {
        this.holdTimer += dt;
        this.launcherX = this.aimX;
        if (this.holdTimer >= B.holdInterval) { this.holdTimer -= B.holdInterval; this.drop(); }
      } else if (s.autoDrop) {
        this.autoTimer += dt;
        const iv = 1 / this.autoRate();
        if (s.autoMode === 'sweep') { this.sweep += dt; this.launcherX = Math.sin(this.sweep * 0.7) * (L.halfW - 1); }
        else if (s.autoMode === 'center') this.launcherX = 0;
        else if (s.autoMode === 'follow') this.launcherX = this.aimX;
        if (this.autoTimer >= iv) {
          this.autoTimer = Math.min(this.autoTimer - iv, iv);
          if (s.autoMode === 'random') this.launcherX = rand(-(L.halfW - 1), L.halfW - 1);
          this.drop();
        }
      } else this.launcherX = this.aimX;
    }
    // popup aggregation
    const a = this.popAgg;
    if (a.t > 0) { a.t -= dt; if (a.t <= 0 && a.n > 0) { this.ui.popup(`+${a.n}`, a.x, 0.3, L.frontZ, '#fff', 1); a.n = 0; } }
    // regeneration
    if (s.f_regen && this.save.coins < this.regenCap()) {
      this.save.regenAcc = (this.save.regenAcc || 0) + dt;
      if (this.save.regenAcc >= this.regenSec()) { this.save.regenAcc = 0; this.save.coins++; }
    } else this.save.regenAcc = 0;
    this._processShower(dt);
    if (s.f_slot) this.slot.update(dt);
    if (this.jpQueue > 0 && !this.overlayBusy && !this.features.queue.length) this._runJackpot();
    this.features.update(dt);
    this.boss.update(dt);
    this.audio.pileMotion && this.audio.pileMotion(this.motion || 0, dt);
    this.prog.add('playTime', dt);
    this._missionTimer = (this._missionTimer || 0) + dt;
    if (this._missionTimer > 30) { this._missionTimer = 0; this.prog.ensureMissions(); }
    this.prog.checkAchievements();
    this.payoutFlash = Math.max(0, this.payoutFlash - dt * 3);
  }

  // ---------- boss ----------
  _onDrain(e) {
    for (const [x, z] of e.pts) this.effects.burst(x, 0.4, z, '#b388ff', 8, 3, 0.5, 0.6);
    if (e.pts.length) { this.ui.popup(`-${e.pts.length}`, 0, 1.5, 2.5, '#b388ff', 1.4); this.audio.sweep && this.audio.sweep(600, 150, 0.6, 0.07, 0, 'sawtooth'); }
  }
  // the chest a boss drops: a gem (boosted rarity), coins and an item
  _bossChest(fxPos) {
    const n = Math.round(rand(30, 80) * this.diff.bossReward);
    this.credit(n, 'boss');
    if (this.settings.f_gems) this.spawnItem(KIND.GEM, this.prog.rollGem(Math.random, this.diff.gem * 1.5));
    if (this.settings.f_items) this.spawnRandomItem();
    this.toast('👑', `${t('bossChest')} +${n}`);
    this.effects.burst(...fxPos, '#ffd34d', 50, 6, 0.9, 1.2);
    this.audio.itemGet();
  }
  // cosmetic unlocks of the upper difficulties
  onBossDefeated(diff, stage) {
    const r = DIFF_REWARDS[diff];
    if (!r) return;
    const u = this.unlocks();
    const give = (list, id, kind) => { if (stage >= DIFF_REWARD_STAGE[kind] && !u[list].includes(id)) { u[list].push(id); this.toast('🎁', t('unlock_' + kind, t(kind + '_' + id))); this.audio.levelUp(); } };
    give('themes', r.theme, 'theme'); give('skins', r.skin, 'skin'); give('titles', r.title, 'title');
  }
  unlocks() {
    const s = this.save;
    if (!s.unlocks || typeof s.unlocks !== 'object') s.unlocks = {};
    for (const k of ['themes', 'skins', 'titles']) if (!Array.isArray(s.unlocks[k])) s.unlocks[k] = [];
    return s.unlocks;
  }

  // ---------- table gimmicks ----------
  tableShake(k = 1) {
    this.physics.cmd('shake', k);
    this.stage.addShake(0.9 * k);
    this.audio.thump(0, 0.8 * k, 45); this.audio.noiseHit(0, 0.35 * k, 'lowpass', 600, 0.9);
    this.audio.pileMotion(400, 0.2);
    this.vibrate(120);
    this.prog.add('shakes');
  }

  // a stack of medals dropped onto the pusher shelf: it rides forward and topples
  coinTower(x) {
    if (x === undefined) x = rand(-(L.halfW - 2.5), L.halfW - 2.5);
    const z = (L.backWallZ + L.pusherFrontMin) / 2 + rand(-0.4, 0.4);
    const n = COIN_TOWER.coins;
    for (let i = 0; i < n; i++) {
      const kind = i >= n - COIN_TOWER.gold ? KIND.GOLD : KIND.SILVER;
      this.physics.cmd('spawn', kind, x + rand(-0.02, 0.02), 5.2 + i * (L.coinHH * 2 + 0.004), z, null, { x: 0, y: -2, z: 0 }, 0, 0);
    }
    this.objCount += n;
    this.ui.popup('TOWER!', x, 3, z, '#ffd34d', 1.4);
    this.audio.brass && this.audio.brass(0, [67, 71, 74], 0.5, 0.18);
    this.prog.add('towers');
  }

  _onCatch(e) {
    const s = this.settings;
    this.save.wheelMeter = (this.save.wheelMeter || 0) + 1;
    this.prog.add('catches');
    if (this.machines && this.machines.cup) this.machines.cup.flash = 0.8;
    if (s.f_meterTube && this.machines && this.machines.field) this.machines.field.addCatch(e.x, 2.3, L.dropZ);
    this.ui.popup('CATCH!', e.x, 2.6, L.dropZ, '#7CFFB2', 1.2);
    this.audio.gate();
    if (s.f_wheel && this.machines && this.machines.wheel && this.save.wheelMeter >= WHEEL_NEED && !this.wheelBusy) this.spinWheel();
    else if (!s.f_wheel) { this.credit(1, 'catch'); this.save.wheelMeter = 0; }
  }

  async spinWheel() {
    const w = this.machines.wheel;
    this.save.wheelMeter = Math.max(0, (this.save.wheelMeter || 0) - WHEEL_NEED);
    this.wheelBusy = true;
    if (this.machines.field) this.machines.field.empty();
    let r = Math.random() * WHEEL.reduce((a, b) => a + b.w, 0), idx = 0;
    for (let i = 0; i < WHEEL.length; i++) if ((r -= WHEEL[i].w) < 0) { idx = i; break; }
    const seg = WHEEL[idx];
    this.audio.reelStart && this.audio.reelStart();
    this.backboard.message('LUCKY WHEEL', '#7CFFB2', 1.6, 80);
    await w.spin(idx, this.audio);
    this.wheelBusy = false;
    this.prog.add('wheels');
    const s = this.settings;
    const wid = seg.n ? 'wh_coins' : seg.item ? 'wh_item' : seg.dice ? 'tok_dice' : seg.tower ? 'wh_tower' : seg.shake ? 'tok_shake' : seg.double ? 'wh_double' : seg.ball ? 'wh_ball' : seg.crane ? 'tok_crane' : 'tok_flipper';
    this.announce(wid, seg.color, 1.8, [seg.double || ''], `WHEEL: ${seg.label}`);
    if (seg.n) { this.shower(seg.n); seg.n >= 50 ? this.audio.winBig() : this.audio.win('small'); }
    else if (seg.item) { this.spawnRandomItem(); this.audio.itemGet(); }
    else if (seg.dice) { if (s.f_sugoroku) this.features.addDice(seg.dice); else this.shower(8); this.audio.itemGet(); }
    else if (seg.tower) this.coinTower();
    else if (seg.shake) this.tableShake(1);
    else if (seg.double) { this.fx.double += seg.double; this.audio.itemGet(); }
    else if (seg.ball) { if (s.f_jp) { this.launchBall(); this.audio.winBig(); } else this.shower(30); }
    else if (seg.crane) this.startCrane();
    else if (seg.flipper) this.activateToken(TOKEN.FLIPPER);
    if (this.save.wheelMeter >= WHEEL_NEED) setTimeout(() => { if (!this.wheelBusy) this.spinWheel(); }, 800);
  }

  beaconMode() {
    if (this.tower && this.tower.active) return 'jp';
    if (this.boss.active) return this.boss.active.weak ? 'win' : 'fever';
    if (this.devMode) return 'win';
    if (this.fx.fever > 0) return 'fever';
    if (this.features.event) return 'event';
    if (this.slot.flash > 0 || this.overlayBusy || this.wheelBusy) return 'win';
    return 'idle';
  }

  lightMode() {
    if (this.fx.fever > 0 || this.boss.active) return 'fever';
    if (this.slot.flash > 0 || this.overlayBusy) return 'win';
    if (this.features.event) return 'fever';
    if (this.slot.spinning) return 'spin';
    return 'idle';
  }
}
