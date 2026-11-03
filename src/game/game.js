// Central game orchestrator: input -> physics -> events -> rewards -> presentation
import * as THREE from 'three';
import { L, KIND, TOKEN } from '../core/layout.js';
import { B, ITEM_TABLE, ROULETTE, UPGRADES, upgradeCost } from './balance.js';
import { Progression } from './progression.js';
import { Slot } from './slot.js';
import { Features } from './features.js';
import { themeById, THEMES } from '../render/themes.js';
import { t } from '../i18n.js';

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
    this.fx = { fever: 0, walls: 0, turbo: 0, double: 0 };
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
    this.features = new Features(this);
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
  get diff() { return B.difficulty[this.settings.difficulty] || B.difficulty.normal; }
  upg(id) { return this.prog.upg(id); }
  stockMax() { return B.stockBase + this.upg('stock'); }
  gateHalf() { return (B.gate.half + B.gate.halfPerLv * this.upg('gate')) * Math.pow(L.halfW / 11, 1.2) * this.diff.gate * (this.fx.fever > 0 ? 1.6 : 1) * this.features.gateMult(); }
  get overlayBusy() { return this.features.busy || this.roulette.active || this.jpRunning; }
  slotLuck() { return (1 + 0.06 * this.upg('luck') + this.prog.gemLuck()) * this.diff.slot * (this.fx.fever > 0 ? 1.4 : 1); }
  itemRate() { return (B.itemRate + B.itemRatePerLv * this.upg('item')) * this.diff.item; }
  autoRate() { return B.autoRateBase + B.autoRatePerLv * this.upg('auto'); }
  regenCap() { return B.regen.capBase + B.regen.capPerLv * this.upg('regen'); }
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
        if (lb.gem) this.spawnItem(KIND.GEM, this.prog.rollGem());
        this.audio.levelUp();
      }), 900);
    }
    if (s.jpPool < this.jpBase()) s.jpPool = this.jpBase();
    if (this.settings.f_hints && (s.tutorial || 0) < 4) this.ui.startHints();
  }

  // ---------- input ----------
  setAim(x) { this.aimX = Math.max(-(L.halfW - 0.7), Math.min(L.halfW - 0.7, x)); }
  press(x) {
    if (this.paused || this.overlayBusy) return;
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
    this.prog.addXp(k);
    if (this.settings.f_jp) this.save.jpPool += B.jp.growPerDrop * k * (1 + Object.keys(this.save.gems).length * 0.01);
    if (this.settings.f_items && Math.random() < this.itemRate() * k) this.spawnRandomItem();
    this.dropsSinceSave = (this.dropsSinceSave || 0) + 1;
  }

  vibrate(ms) { if (this.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

  // ---------- spawning ----------
  shower(n, kind = KIND.SILVER) {
    for (let i = 0; i < n; i++) this.showerQueue.push(kind);
  }
  spawnItem(kind, extra = 0) {
    if (kind === KIND.GEM && extra === 0) extra = this.prog.rollGem();
    this.physics.cmd('spawn', kind, rand(-(L.halfW - 1.5), L.halfW - 1.5), 6.5, rand(L.backWallZ + 1.2, L.pusherFrontMin - 0.8), tiltQ(0.4), { x: 0, y: -1, z: 0 }, extra, 0);
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
      this.physics.cmd('spawn', kind, rand(-(L.halfW - 0.7), L.halfW - 0.7), rand(5.5, 7.5), rand(L.backWallZ + 0.7, L.frontZ - 3.5), tiltQ(1.2), { x: 0, y: rand(-3, 0), z: 0 }, 0, 0, { x: rand(-4, 4), y: 0, z: rand(-4, 4) });
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
    this.objCount = msg.n;
    this.physMs = msg.ms;
    for (const e of msg.ev) {
      if (e.t === 'out') this._onOut(e);
      else if (e.t === 'stroke') this._onStroke();
      else if (e.t === 'gate') this._onGate(e);
      else if (e.t === 'hit') this.audio.impact(e, L.halfW);
      else if (e.t === 'mv') this.motion = e.v;
    }
  }

  _onGate(e) {
    if (!this.settings.f_slot) return;
    if (Math.abs(e.x - this.gateX) > this.gateHalf()) return;
    this.prog.add('gatePasses');
    this.features.onGatePass();
    this.gateFlash = 1;
    this.effects.burst(e.x, L.gateY, L.dropZ, this.theme().accent, 10, 3, 0.5, 0.5);
    if (this.save.stock < this.stockMax()) {
      this.save.stock++;
      this.audio.gate();
    } else {
      this.save.jpPool += 2;
      this.audio.stock();
    }
  }

  _onOut(e) {
    const s = this.settings;
    if (e.pocket && s.f_bonusZone) { this.features.onPocket(e); return; }
    if (!e.won) {
      this.prog.add('lost');
      if (e.kind >= KIND.BALL) { this.toast('💨', t('lostItem')); this.audio.lost(); }
      return;
    }
    const mult = this.fx.double > 0 ? 2 : 1;
    const fxPos = [e.x, 0.2, L.frontZ + 0.2];
    switch (e.kind) {
      case KIND.SILVER: case KIND.GOLD: case KIND.RAINBOW: case KIND.BIG: case KIND.GIANT: {
        const zone = this.features.inBonusZone(e.x);
        const v = B.value[e.kind] * mult * (zone && e.kind !== KIND.SILVER ? 2 : 1);
        this.credit(v, 'win');
        if (zone && Math.random() < 0.18) {
          if (s.f_slot && this.save.stock < this.stockMax()) { this.save.stock++; this.ui.popup('+1 STOCK', e.x, 1.2, L.frontZ, '#7CFFB2', 1.3); }
          this.audio.gate();
        }
        this.prog.addXp(e.kind === KIND.SILVER ? 0 : Math.ceil(v / 5));
        this.strokeCoins += 1;
        this._pop(v, e.x, e.kind);
        this.audio.payout(e.kind === KIND.SILVER ? 1 : 3, e.x / L.halfW * 0.8, e.kind === KIND.BIG || e.kind === KIND.GIANT);
        const col = e.kind === KIND.GOLD ? '#ffcc33' : e.kind === KIND.RAINBOW ? `hsl(${Math.random() * 360},100%,60%)` : e.kind === KIND.BIG ? '#ffd34d' : '#e8f0ff';
        this.effects.burst(...fxPos, col, e.kind === KIND.SILVER ? 4 : 14, 3, e.kind === KIND.SILVER ? 0.35 : 0.6, 0.6);
        this.payoutFlash += e.kind === KIND.SILVER ? 0.15 : 0.6;
        break;
      }
      case KIND.BALL:
        this.prog.add('items');
        if (s.f_jp) { this.jpQueue++; this.backboard.message(t('jpChance'), '#ffd34d', 2, 80); this.audio.itemGet(); }
        else this.credit(20, 'win');
        break;
      case KIND.GEM: {
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
        this.prog.add('items'); this.prog.add('chests');
        const r = Math.random();
        if (r < 0.5) { const n = Math.round(rand(15, 60)); this.credit(n, 'item'); this.toast('🧰', `${t('chest')} +${n}`); }
        else if (r < 0.75 && s.f_gems) { this.spawnItem(KIND.GEM); this.toast('🧰', `${t('chest')} → 💎`); }
        else { this.spawnRandomItem(); this.toast('🧰', `${t('chest')} → 🎁`); }
        this.effects.burst(...fxPos, '#ffd34d', 30, 5, 0.8, 1);
        this.audio.itemGet();
        break;
      }
      case KIND.TOKEN:
        this.prog.add('items');
        this.activateToken(e.extra);
        this.effects.burst(...fxPos, '#ffffff', 24, 5, 0.7, 1);
        break;
    }
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
    this.ui.banner(`PUSH COMBO ${n}! +${bonus}`, n >= 40 ? 'rainbow' : '#ffd34d');
    this.audio.combo(n);
    this.stage.addShake(0.12);
  }

  activateToken(tok) {
    const s = this.settings;
    this.audio.itemGet();
    const name = t('tok')[tok];
    this.ui.banner(name, '#7fe7ff');
    switch (tok) {
      case TOKEN.WALL:
        if (!s.f_walls) { this.shower(10); break; }
        this.fx.walls += B.walls.dur + B.walls.durPerLv * this.upg('wall');
        this.prog.add('walls'); this.audio.wall();
        break;
      case TOKEN.SHOWER: this.shower(25); break;
      case TOKEN.TURBO: this.fx.turbo += B.turbo.dur; break;
      case TOKEN.DOUBLE: this.fx.double += B.double.dur; break;
      case TOKEN.FEVER: if (s.f_fever) this.startFever(); else this.shower(30); break;
      case TOKEN.STOCK: this.save.stock = this.stockMax(); break;
      case TOKEN.PLINKO: if (s.f_plinko) this.features.enqueue(() => this.features.plinko()); else this.shower(12); break;
      case TOKEN.DICE: if (s.f_sugoroku) this.features.addDice(2); else this.shower(8); break;
      case TOKEN.MAGNET: this.fx.magnet = (this.fx.magnet || 0) + 12; break;
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

  startFever() {
    const first = this.fx.fever <= 0;
    this.fx.fever += B.fever.dur + B.fever.durPerLv * this.upg('fever');
    if (first) {
      this.prog.add('fevers');
      this.audio.fever = true;
      this.backboard.message('FEVER!!', 'rainbow', 2.5, 120);
      this.ui.banner('FEVER TIME!!', 'rainbow');
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
    const s = this.settings;
    switch (o.kind) {
      case 'fever':
        this.prog.add('sevens');
        if (s.f_fever) this.startFever(); else this.backboard.message('777', '#ff2d55', 2, 140);
        this.shower(o.shower + (s.f_fever ? 0 : 40));
        this.audio.winBig();
        break;
      case 'ball': this.spawnItem(KIND.BALL); this.backboard.message('JP BALL!', '#ffd34d', 2, 100); this.audio.winBig(); break;
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
    this.jpRunning = true;
    this.holding = false;
    this.prog.add('jpLottery');
    let idx = Math.floor(Math.random() * ROULETTE.length);
    if (Math.random() < 0.02 * this.upg('jp') + 0.01 * this.upg('luck')) idx = 0;
    if (this.settings.f_croon) {
      this.jpRunning = false;
      this.features.enqueue(() => this.features.croon());
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

  // ---------- shop ----------
  buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    const lv = this.upg(id);
    if (!u || lv >= u.max) return false;
    const cost = upgradeCost(u, lv);
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
    for (const k in this.fx) if (this.fx[k] > 0) { this.fx[k] = Math.max(0, this.fx[k] - dt); if (k === 'fever' && this.fx.fever === 0) this.audio.fever = false; }
    const walls = this.fx.walls > 0 || !s.sideLoss;
    if (walls !== this.wallsSent) { this.physics.cmd('walls', walls); this.wallsSent = walls; }
    const speed = (this.fx.turbo > 0 ? B.turbo.speed : 1) * (this.fx.fever > 0 ? 1.15 : 1) * this.features.speedMult();
    if (speed !== this.speedSent) { this.physics.cmd('speed', speed); this.speedSent = speed; }
    const mag = this.fx.magnet > 0;
    if (mag !== this.magSent) { this.physics.cmd('magnet', mag); this.magSent = mag; }
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
    this.audio.pileMotion && this.audio.pileMotion(this.motion || 0, dt);
    this.prog.add('playTime', dt);
    this._missionTimer = (this._missionTimer || 0) + dt;
    if (this._missionTimer > 30) { this._missionTimer = 0; this.prog.ensureMissions(); }
    this.prog.checkAchievements();
    this.payoutFlash = Math.max(0, this.payoutFlash - dt * 3);
  }

  lightMode() {
    if (this.fx.fever > 0) return 'fever';
    if (this.slot.flash > 0 || this.overlayBusy) return 'win';
    if (this.features.event) return 'fever';
    if (this.slot.spinning) return 'spin';
    return 'idle';
  }
}
