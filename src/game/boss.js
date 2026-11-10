// Boss battles. A stage gauge fills with medals dropped and gate passes; when it is full a boss
// rises behind the table. Everything the player does deals damage (payouts, gate passes, slot
// wins, items, crane grabs, combos, rocks pushed off); the boss fights back with physical
// attacks on the table. Pure game logic (no rendering): the 3D view is optional (game.bossView),
// so the headless simulator runs the same code.
import { L, KIND } from '../core/layout.js';
import { BOSS, BOSS_TYPES, DIFFICULTIES } from './balance.js';
import { t } from '../i18n.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export class BossSystem {
  constructor(game) {
    this.g = game;
    this.active = null;       // current battle
    this.pending = false;     // gauge full, waiting for the intro slot
    this.jam = 0;             // gate jammed (s)
    this.freeze = 0;          // pusher slowed + guard walls off (s)
    this.cd = { jam: 0, freeze: 0 };   // after a jam / freeze ends the boss cannot repeat it for a while
    this.beamHp = 0; this.beamMax = 0; // the jam beam breaks after this many medals hit it
    this.warn = null;         // { kind, t } telegraphed attack
    this.stun = 0;            // boss stunned (beam broken): no attacks, no regeneration
    this.popAcc = 0; this.popT = 0; this.popX = 0;
  }
  get on() { return !!this.g.settings.f_boss; }
  get st() {
    const s = this.g.save;
    if (!s.boss || typeof s.boss !== 'object') s.boss = {};
    const b = s.boss;
    b.gauge = b.gauge || 0;
    for (const k of ['stage', 'best', 'kills']) if (!b[k] || typeof b[k] !== 'object') b[k] = {};
    return b;
  }
  get diffId() { return this.g.settings.difficulty || 'normal'; }
  get d() { return this.g.diff; }
  stage() { return this.st.stage[this.diffId] || 1; }
  need() { return BOSS.gaugeNeed; }
  gaugeFrac() { return Math.min(1, this.st.gauge / this.need()); }
  typeOf(stage) { return BOSS_TYPES[(stage - 1) % BOSS_TYPES.length]; }
  hpFor(stage) { return Math.round(BOSS.hp * Math.pow(BOSS.hpGrow, stage - 1) * this.d.bossHp); }
  rewardFor(stage) { return Math.round((BOSS.reward + BOSS.rewardPerStage * (stage - 1)) * this.d.bossReward); }

  // ---------- gauge ----------
  addGauge(n) {
    if (!this.on || this.active || this.pending) return;
    const b = this.st;
    b.gauge += n;
    if (b.gauge >= this.need()) {
      b.gauge = this.need();
      this.pending = true;
      this.g.features.enqueue(() => this.intro(), 'boss');
    }
  }

  // ---------- battle ----------
  intro() {
    const g = this.g, stage = this.stage(), type = this.typeOf(stage);
    g.holding = false;
    g.prog.add('bossFights');
    g.audio.siren && g.audio.siren();
    g.audio.setMood && g.audio.setMood('event');
    g.backboard.message('WARNING', '#ff2d2d', 2.6, 130);
    g.ui.banner(`${t('bossWarn')} — ${t('boss_' + type.id)}`, '#ff4040', 2.8);
    g.stage.addShake(0.4);
    if (g.bossView) g.bossView.appear(type.id, stage);
    return new Promise(res => setTimeout(() => { this.start(stage, type); res(); }, BOSS.introMs));
  }

  start(stage, type) {
    const d = this.d, hp = this.hpFor(stage);
    // attack set: own attack; from the 5th stage (or expert+) it borrows the others
    let attacks = [type.atk];
    const others = BOSS_TYPES.map(x => x.atk).filter(a => a !== type.atk);
    if (d.bossMix >= 1 || stage > BOSS_TYPES.length) attacks.push(pick(others));
    if (d.bossMix >= 2) attacks = BOSS_TYPES.map(x => x.atk);
    this.pending = false;
    this.active = {
      stage, type: type.id, hp, hpMax: hp, t: d.bossTime, time: d.bossTime,
      attacks, atkT: BOSS.firstAttack, weakT: BOSS.weakEvery * 0.5, weak: 0,
      idle: 0, barrier: 0, barrierT: d.bossBarrier ? BOSS.barrierEvery : 0, hits: 0, hurt: false, dealt: 0,
    };
  }

  update(dt) {
    const a = this.active, g = this.g;
    if (this.jam > 0 && (this.jam -= dt) <= 0) { this.jam = 0; this.cd.jam = BOSS.jamDur * BOSS.repeatCd; }
    if (this.freeze > 0 && (this.freeze -= dt) <= 0) { this.freeze = 0; this.cd.freeze = BOSS.freezeDur * BOSS.repeatCd; }
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.stun = Math.max(0, this.stun - dt);
    if (this.popT > 0) { this.popT -= dt; if (this.popT <= 0 && this.popAcc > 0) { g.ui.popup(`-${Math.round(this.popAcc)}`, this.popX, 5, L.backWallZ + 0.5, '#ff5252', 1.3); this.popAcc = 0; } }
    if (!a) return;
    const d = this.d;
    if (g.timeStopped()) return;   // a device / lottery holds the input: the boss clock waits too
    a.t -= dt; a.idle += dt;
    // weak point: the core opens for a few seconds (gate passes deal critical damage)
    if (a.weak > 0) a.weak = Math.max(0, a.weak - dt);
    else if ((a.weakT -= dt) <= 0) { a.weak = BOSS.weakDur; a.weakT = BOSS.weakEvery; g.announce('bossWeak', '#7CFFB2', 1.4, [], t('bossWeak')); g.audio.reach && g.audio.reach(); }
    // inferno: barrier phases (only weak-point hits get through)
    if (d.bossBarrier) {
      if (a.barrier > 0) a.barrier = Math.max(0, a.barrier - dt);
      else if ((a.barrierT -= dt) <= 0) { a.barrier = BOSS.barrierDur; a.barrierT = BOSS.barrierEvery; g.announce('bossBarrier', '#b388ff', 1.4, [], t('bossBarrier')); g.audio.wall && g.audio.wall(); }
    }
    // carnage+: the boss regenerates when left alone
    if (d.bossRegen && !this.stun && a.idle > BOSS.regenAfter) a.hp = Math.min(a.hpMax, a.hp + a.hpMax * BOSS.regenRate * dt);
    // attacks (faster when enraged)
    const enraged = d.bossEnrage && a.hp < a.hpMax * 0.3;
    if (enraged && !a.enraged) { a.enraged = true; g.announce('bossEnrage', '#ff1744', 1.6, [], t('bossEnrage')); g.stage.addShake(0.3); }
    // attacks are telegraphed (BOSS.warnTime) so the player can react; jam / freeze never repeat
    // back to back (cooldown after they end) and the jam beam can be broken by medals
    if (this.warn) {
      if ((this.warn.t -= dt) <= 0) { const k = this.warn.kind; this.warn = null; this.attack(k); }
    } else if (!this.stun && (a.atkT -= dt * (enraged ? 2 : 1)) <= 0) {
      a.atkT = BOSS.attackEvery * d.bossAtk * rand(0.8, 1.2);
      const ok = a.attacks.filter(k => !(k === 'jam' && (this.jam > 0 || this.cd.jam > 0)) && !(k === 'freeze' && (this.freeze > 0 || this.cd.freeze > 0)));
      const pool = ok.length ? ok : ['rock', 'drain'];
      const kind = pick(pool);
      this.warn = { kind, t: BOSS.warnTime, dur: BOSS.warnTime };
      g.announce('bwarn_' + kind, '#ffab40', 1.6);
      if (g.bossView && g.bossView.charge) g.bossView.charge(kind);
      g.audio.reach && g.audio.reach();
    }
    if (g.bossView) g.bossView.state({ hp: a.hp / a.hpMax, weak: a.weak > 0, barrier: a.barrier > 0, enraged, jam: this.jam > 0, stun: this.stun > 0, warnK: this.warn ? this.warn.t / this.warn.dur : 0, gateX: g.gateX });
    if (a.hp <= 0) this.defeat();
    else if (a.t <= 0) this.retreat();
  }

  attack(kind) {
    const g = this.g, a = this.active;
    a.hurt = true;
    g.prog.add('bossAttacks');
    if (g.bossView) g.bossView.attack(kind);
    g.announce('batk_' + kind, '#ff6e40', 1.6, [this.beamFor()]);
    switch (kind) {
      case 'rock': {
        const n = 1 + Math.floor(Math.random() * (a.stage > 4 ? 3 : 2));
        for (let i = 0; i < n; i++) setTimeout(() => this.active && g.features.dropRock(undefined, true), 500 + i * 450);
        break;
      }
      case 'jam': this.jam = BOSS.jamDur; this.beamHp = this.beamMax = this.beamFor(); g.audio.wall && g.audio.wall(); break;
      case 'drain': g.physics.cmd('drain', Math.round(rand(...BOSS.drain))); break;
      case 'freeze': this.freeze = BOSS.freezeDur; g.audio.sweep && g.audio.sweep(800, 120, 0.8, 0.08, 0, 'triangle'); break;
    }
  }

  // damage from any player action; src is only used for stats / effects
  // crit: weak-point hit (x critMult); pierce: gets through the barrier without the multiplier
  damage(n, x = 0, crit = false, pierce = false) {
    const a = this.active;
    if (!a || n <= 0) return 0;
    if (a.barrier > 0 && !crit && !pierce) { return 0; }
    const v = n * (crit ? BOSS.critMult : 1);
    a.hp -= v; a.idle = 0; a.hits++; a.dealt += v;
    this.g.prog.add('bossDamage', Math.round(v));
    if (this.g.bossView) this.g.bossView.hit(v, crit);
    if (crit) this.g.ui.popup(`CRITICAL -${Math.round(v)}`, x, 5.5, L.backWallZ + 0.5, '#7CFFB2', 1.6);
    else { this.popAcc += v; this.popX = x; if (this.popT <= 0) this.popT = 0.35; }
    return v;
  }
  onGate(x) { const a = this.active; if (a) this.damage(BOSS.dmg.gate, x, a.weak > 0); }
  beamFor() { return this.d.bossBeam || 6; }
  // a medal hit the jam beam in the gate: enough hits break it (jam ends, boss stunned, weak point opens)
  hitBeam(x) {
    const a = this.active, g = this.g;
    if (!a || this.jam <= 0) return;
    this.beamHp = Math.max(0, this.beamHp - 1);
    g.prog.add('beamHits');
    if (this.beamHp > 0) {
      g.ui.popup(`BEAM ${this.beamHp}/${this.beamMax}`, x, L.gateY + 1, L.dropZ, '#ff9e40', 1);
      g.audio.thump && g.audio.thump(x / L.halfW * 0.8, 0.25, 160);
      if (g.bossView && g.bossView.hit) g.bossView.hit(0, false);
      return;
    }
    this.jam = 0; this.cd.jam = BOSS.jamDur * BOSS.repeatCd;
    this.stun = BOSS.stunDur;
    a.weak = Math.max(a.weak, BOSS.weakDur + 1); a.weakT = Math.max(a.weakT, BOSS.weakEvery * 0.5);
    a.barrier = 0;
    g.prog.add('beamBreaks');
    this.damage(BOSS.dmg.beam, x, false, true);
    g.announce('beamBroken', '#7CFFB2', 2);
    g.backboard.message('BREAK!', '#7CFFB2', 1.6, 120);
    g.effects.burst && g.effects.burst(x, L.gateY, L.dropZ, '#ff9e40', 40, 6, 0.8, 1);
    g.stage.addShake(0.35); g.audio.fanfare && g.audio.fanfare();
  }

  defeat() {
    const g = this.g, a = this.active, b = this.st, id = this.diffId;
    this._clear();
    b.stage[id] = a.stage + 1;
    b.best[id] = Math.max(b.best[id] || 0, a.stage);
    b.kills[id] = (b.kills[id] || 0) + 1;
    b.gauge = 0;
    g.prog.add('bossKills');
    g.prog.max('bossBestStage', a.stage);
    if (!a.hurt) g.prog.add('bossPerfect');
    const r = this.rewardFor(a.stage);
    this.payout(r, true);
    g.ui.banner(`${t('bossDown')} +${r}`, 'rainbow', 3);
    g.backboard.message('BOSS DOWN!', 'rainbow', 3, 110);
    g.audio.fanfare && g.audio.fanfare(); g.effects.confetti(200); g.stage.addShake(0.9); g.vibrate([80, 40, 120]);
    g.audio.setMood && g.audio.setMood('normal');
    if (g.bossView) g.bossView.defeat();
    if (g.onBossDefeated) g.onBossDefeated(id, a.stage);
  }

  retreat() {
    const g = this.g, a = this.active, b = this.st;
    this._clear();
    b.gauge = this.d.bossBarrier ? 0 : Math.round(this.need() * BOSS.retryGauge);
    const frac = Math.max(0, Math.min(1, 1 - a.hp / a.hpMax));
    const r = Math.round(this.rewardFor(a.stage) * frac * BOSS.consolation);
    if (r > 0) this.payout(r, false);
    g.ui.banner(`${t('bossEscape')}${r > 0 ? ` +${r}` : ''}`, '#999', 2.4);
    g.audio.lose && g.audio.lose();
    g.audio.setMood && g.audio.setMood('normal');
    if (g.bossView) g.bossView.retreat();
  }

  // reward: silver + gold shower from the hopper, the rest credited; a boss chest and maybe a JP ball
  payout(n, full) {
    const g = this.g;
    const gold = Math.min(12, Math.floor(n * 0.25 / 5));
    let rest = n - gold * 5;
    const sil = Math.min(60, rest);
    g.shower(gold, KIND.GOLD); g.shower(sil); rest -= sil;
    if (rest > 0) g.credit(rest, 'boss');
    if (!full) return;
    g.spawnItem(KIND.CHEST, 1);
    if (g.settings.f_jp && Math.random() < BOSS.ballChance) setTimeout(() => g.launchBall(), 1500);
  }

  // gate jam / freeze hooks for the game loop
  gateMult() { return this.jam > 0 ? 0 : 1; }
  speedMult() { return this.freeze > 0 ? BOSS.freezeSpeed : 1; }
  wallsBlocked() { return this.freeze > 0; }

  // difficulty switch / feature off in the middle of a battle: the boss just leaves
  _clear() { this.active = null; this.jam = 0; this.freeze = 0; this.warn = null; this.stun = 0; this.cd.jam = this.cd.freeze = 0; this.beamHp = 0; }
  abort() { if (this.active) { this._clear(); if (this.g.bossView) this.g.bossView.retreat(); } this.pending = false; }
  static diffs() { return DIFFICULTIES; }
}
