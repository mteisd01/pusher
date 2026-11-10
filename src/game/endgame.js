// Long-term goals once the shop is bought out: endless mastery levels (coin sinks), an optional
// rebirth that trades the run for permanent star perks, and a capsule gacha with charms (small
// permanent bonuses, duplicates level them up, SSR pity). All bonuses are read through bonus(key).
import { B, UPGRADES, MASTERY, REBIRTH, STAR_PERKS, GACHA, CHARMS, CHARM_MAX } from './balance.js';

export class Endgame {
  constructor(game) { this.g = game; this._cache = null; }
  get s() { return this.g.save; }
  get st() {
    const s = this.s;
    if (!s.endgame || typeof s.endgame !== 'object') s.endgame = {};
    const e = s.endgame;
    for (const k of ['mastery', 'stars', 'charms']) if (!e[k] || typeof e[k] !== 'object') e[k] = {};
    e.starPts = e.starPts || 0; e.rebirths = e.rebirths || 0; e.wonBase = e.wonBase || 0; e.pulls = e.pulls || 0; e.pity = e.pity || 0;
    return e;
  }
  dirty() { this._cache = null; }

  // sum of every source for a bonus key (mastery + star perks + charms)
  bonus(key) {
    if (!this._cache) {
      const c = {}, e = this.st, add = (k, v) => { c[k] = (c[k] || 0) + v; };
      for (const m of MASTERY) add(m.key, (e.mastery[m.id] || 0) * m.per);
      for (const p of STAR_PERKS) add(p.key, (e.stars[p.id] || 0) * p.per);
      for (const ch of CHARMS) add(ch.key, (e.charms[ch.id] || 0) * ch.per);
      this._cache = c;
    }
    return this._cache[key] || 0;
  }

  // ---------- mastery ----------
  masteryLv(id) { return this.st.mastery[id] || 0; }
  masteryCost(m) { return Math.round(m.cost * Math.pow(m.grow, this.masteryLv(m.id)) * (this.g.diff.upgCost || 1) * Math.max(0.5, 1 - this.bonus('discount')) / 10) * 10; }
  buyMastery(id) {
    const m = MASTERY.find(x => x.id === id);
    if (!m) return false;
    const cost = this.masteryCost(m);
    if (this.s.coins < cost) return false;
    this.s.coins -= cost;
    this.st.mastery[id] = this.masteryLv(id) + 1;
    this.g.prog.add('masteryLv');
    this.dirty();
    return true;
  }

  // ---------- rebirth ----------
  wonSince() { return Math.max(0, (this.s.stats.won || 0) - this.st.wonBase); }
  shopMaxed() { return UPGRADES.every(u => (this.s.upgrades[u.id] || 0) >= u.max); }
  canRebirth() { return this.shopMaxed() || this.wonSince() >= REBIRTH.won; }
  starsFor() { return Math.floor(Math.sqrt(this.wonSince() / REBIRTH.starDiv)); }
  rebirth() {
    if (!this.canRebirth()) return 0;
    const g = this.g, s = this.s, e = this.st, stars = Math.max(1, this.starsFor());
    e.starPts += stars; e.rebirths++; e.wonBase = s.stats.won || 0;
    e.mastery = {};
    s.upgrades = {};
    s.coins = B.startCoins + Math.round(this.bonus('startCoins'));
    s.jpPool = 0; s.jpTiers = {}; g.jpPools(); s.jpPool = g.jpBase();
    s.jpMiss = 0; s.stock = 0; s.stockQ = [];
    if (s.boss) { s.boss.stage = {}; s.boss.gauge = 0; }
    s.roadPos = 0; s.roadLap = 0;
    g.boss.abort && g.boss.abort();
    g.physics.cmd('stroke', 0);
    g.prog.add('rebirths');
    g.prog.dirtyAch = true;
    this.dirty();
    return stars;
  }
  starCost(p) { return p.cost + (this.st.stars[p.id] || 0) * p.costGrow; }
  buyStar(id) {
    const p = STAR_PERKS.find(x => x.id === id), e = this.st;
    if (!p || (e.stars[id] || 0) >= p.max) return false;
    const c = this.starCost(p);
    if (e.starPts < c) return false;
    e.starPts -= c; e.stars[id] = (e.stars[id] || 0) + 1;
    this.dirty();
    return true;
  }

  // ---------- capsule gacha ----------
  price(n) { return Math.round(((n >= 10 ? GACHA.priceTen : GACHA.price) + GACHA.pricePerLv * this.s.level * (n >= 10 ? 9 : 1)) / 10) * 10; }
  _rarity(minR) {
    const e = this.st;
    if (e.pity + 1 >= GACHA.pity) return 3;
    let r = Math.random() * 100, k = 0;
    for (; k < 3; k++) if ((r -= GACHA.rates[k]) < 0) break;
    return Math.max(k, minR);
  }
  // returns [{ charm, lv, refund }] or null when not affordable
  pull(n = 1) {
    const s = this.s, e = this.st, cost = this.price(n);
    if (s.coins < cost) return null;
    s.coins -= cost;
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = this._rarity(n >= 10 && i === n - 1 && !out.some(o => o.charm.r >= 1) ? 1 : 0);
      e.pity = r === 3 ? 0 : e.pity + 1;
      const pool = CHARMS.filter(c => c.r === r);
      const ch = pool[Math.floor(Math.random() * pool.length)];
      const lv = e.charms[ch.id] || 0;
      let refund = 0;
      if (lv >= CHARM_MAX) { refund = Math.round(GACHA.price * GACHA.dupRefund); s.coins += refund; }
      else e.charms[ch.id] = lv + 1;
      out.push({ charm: ch, lv: e.charms[ch.id], isNew: lv === 0, refund });
      e.pulls++;
    }
    this.g.prog.add('gachaPulls', n);
    this.g.prog.max('charmsOwned', Object.keys(e.charms).length);
    this.dirty();
    return out;
  }
}
