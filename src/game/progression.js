// Levels, achievements, daily missions, login bonus and gem collection.
import { UPGRADES, xpForLevel, levelReward, TITLES, LOGIN_REWARDS, GEM_RARITY_W, GEM_REWARD_NEW, GEM_REWARD_DUP } from './balance.js';

// Achievements: [id, stat, target, reward, icon]
const A = [];
const tiers = (stat, list, icon) => list.forEach(([target, reward], i) => A.push({ id: `${stat}_${i}`, stat, target, reward: Math.max(5, Math.round(reward / 3 / 5) * 5), icon, tier: i }));
tiers('dropped', [[1, 10], [100, 30], [1000, 100], [10000, 500], [100000, 3000]], '⬇');
tiers('won', [[10, 10], [500, 50], [5000, 300], [50000, 1500], [500000, 8000]], '💰');
tiers('slotSpins', [[1, 10], [50, 50], [500, 300], [5000, 2000]], '🎰');
tiers('slotWins', [[1, 20], [100, 200], [1000, 1500]], '🍒');
tiers('sevens', [[1, 100], [10, 600], [50, 3000]], '7');
tiers('jpLottery', [[1, 50], [20, 400], [100, 2000]], '🎯');
tiers('jpWins', [[1, 300], [5, 1500], [25, 6000]], '👑');
tiers('fevers', [[1, 50], [10, 300], [50, 1500]], '🔥');
tiers('maxCombo', [[10, 30], [25, 100], [50, 300], [100, 1500]], '⛓');
tiers('items', [[1, 20], [50, 200], [500, 1500]], '🎁');
tiers('chests', [[1, 30], [25, 400]], '🧰');
tiers('gatePasses', [[1, 10], [100, 100], [1000, 800], [10000, 5000]], '🚪');
tiers('gemsUnique', [[1, 30], [6, 150], [12, 500], [24, 5000]], '💎');
tiers('level', [[5, 100], [10, 300], [25, 1000], [50, 3000], [100, 20000]], '⭐');
tiers('maxWallet', [[1000, 100], [10000, 800], [100000, 5000]], '🏦');
tiers('biggestWin', [[50, 50], [300, 300], [1000, 1500]], '💥');
tiers('playTime', [[3600, 200], [36000, 1500], [180000, 6000]], '⏱');
tiers('loginStreak', [[3, 50], [7, 300], [30, 2000]], '📅');
tiers('upgradesTotal', [[1, 30], [10, 300], [30, 1500], [55, 10000]], '🔧');
tiers('walls', [[1, 20], [30, 400]], '🛡');
tiers('missionsDone', [[1, 30], [30, 500], [200, 3000]], '✅');
tiers('roadLaps', [[1, 100], [5, 500], [20, 2500]], '🎲');
tiers('events', [[1, 30], [20, 300], [100, 1500]], '🚨');
tiers('challenges', [[1, 50], [10, 400]], '⏱');
tiers('pockets', [[1, 20], [50, 300], [500, 2000]], '🕳');
tiers('plinkos', [[1, 20], [25, 300]], '📍');
tiers('croonBest', [[2, 50], [3, 300]], '🎯');
tiers('catches', [[1, 20], [50, 300], [500, 2000]], '🥅');
tiers('wheels', [[1, 30], [25, 300], [200, 2000]], '🎡');
tiers('towers', [[1, 30], [20, 300]], '🗼');
tiers('shakes', [[1, 20], [30, 300]], '🌋');
tiers('cranes', [[1, 30], [25, 400]], '🏗');
tiers('craneGrabs', [[30, 60], [500, 600]], '🦾');
tiers('coasters', [[1, 20], [50, 400]], '🎢');
tiers('rocks', [[1, 20], [20, 300]], '🪨');
tiers('bossFights', [[1, 50], [10, 400], [50, 2000]], '👹');
tiers('bossKills', [[1, 100], [10, 800], [50, 4000]], '⚔');
tiers('bossBestStage', [[3, 200], [8, 1200], [15, 5000]], '🏯');
tiers('bossPerfect', [[1, 150], [10, 1500]], '✨');
tiers('bossKills_expert', [[1, 300], [10, 2000]], '達');
tiers('bossKills_shura', [[1, 500], [10, 3000]], '修');
tiers('bossKills_inferno', [[1, 800], [10, 5000]], '獄');
export const ACHIEVEMENTS = A;

const MISSION_POOL = [
  { id: 'dropped', base: [150, 300, 600] },
  { id: 'won', base: [100, 250, 500] },
  { id: 'slotSpins', base: [10, 25, 50], feat: 'f_slot' },
  { id: 'gatePasses', base: [10, 25, 50], feat: 'f_slot' },
  { id: 'items', base: [2, 5, 10], feat: 'f_items' },
  { id: 'combo', base: [12, 20, 30], feat: 'f_combo', special: true },
  { id: 'fevers', base: [1, 1, 2], feat: 'f_fever' },
  { id: 'jpLottery', base: [1, 1, 2], feat: 'f_jp' },
  { id: 'gems', base: [1, 2, 3], feat: 'f_gems' },
  { id: 'pockets', base: [3, 6, 10], feat: 'f_bonusZone' },
  { id: 'diceRolls', base: [3, 6, 10], feat: 'f_sugoroku' },
  { id: 'catches', base: [3, 6, 12], feat: 'f_catcher' },
  { id: 'wheels', base: [1, 2, 3], feat: 'f_wheel' },
  { id: 'craneGrabs', base: [5, 10, 20], feat: 'f_crane' },
  { id: 'events', base: [1, 2, 3], feat: 'f_events' },
  { id: 'bossDamage', base: [150, 300, 600], feat: 'f_boss' },
];

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export class Progression {
  constructor(game) { this.g = game; }
  get s() { return this.g.save; }

  stat(k) { return this.s.stats[k] || 0; }
  add(k, n = 1) {
    this.s.stats[k] = (this.s.stats[k] || 0) + n;
    this.checkMissions(k);
    this.dirtyAch = true;
  }
  max(k, v) { if (v > (this.s.stats[k] || 0)) { this.s.stats[k] = v; this.dirtyAch = true; } }

  upg(id) { return this.s.upgrades[id] || 0; }
  upgradesTotal() { return UPGRADES.reduce((a, u) => a + this.upg(u.id), 0); }

  title() {
    let t = TITLES[0][1];
    for (const [lv, id] of TITLES) if (this.s.level >= lv) t = id;
    return t;
  }

  addXp(n) {
    const s = this.s;
    s.xp += n * (this.g.diff ? this.g.diff.xp : 1);
    let ups = 0;
    while (s.xp >= xpForLevel(s.level)) {
      s.xp -= xpForLevel(s.level);
      s.level++;
      ups++;
      const r = levelReward(s.level);
      this.g.credit(r, 'level');
      this.g.onLevelUp(s.level, r);
    }
    if (ups) { this.max('level', s.level); }
  }

  // ---- achievements ----
  achValue(a) {
    if (a.stat === 'gemsUnique') return Object.keys(this.s.gems).length;
    if (a.stat === 'level') return this.s.level;
    if (a.stat === 'upgradesTotal') return this.upgradesTotal();
    if (a.stat === 'loginStreak') return this.s.login.streak;
    if (a.stat.startsWith('bossKills_')) return ((this.s.boss && this.s.boss.kills) || {})[a.stat.slice(10)] || 0;
    return this.stat(a.stat);
  }
  checkAchievements() {
    if (!this.dirtyAch) return;
    this.dirtyAch = false;
    for (const a of ACHIEVEMENTS) {
      if (this.s.achievements[a.id]) continue;
      if (this.achValue(a) >= a.target) {
        this.s.achievements[a.id] = Date.now();
        this.g.credit(a.reward, 'achievement');
        this.g.onAchievement(a);
      }
    }
  }

  // ---- daily missions ----
  ensureMissions() {
    const d = today(), s = this.s;
    if (s.missions && s.missions.date === d) return;
    const st = this.g.settings;
    const pool = MISSION_POOL.filter(m => !m.feat || st[m.feat]);
    const pick = [];
    const rnd = seeded(hash(d + s.created));
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    const tier = Math.min(2, Math.floor(s.level / 12));
    s.missions = {
      date: d, bonus: false,
      list: pick.map(m => ({
        id: m.id, target: m.base[tier], special: !!m.special,
        start: m.special ? 0 : this.stat(m.id), progress: 0, done: false, claimed: false,
        reward: Math.round((35 + s.level * 4) * (1 + tier * 0.5)),
      })),
    };
  }
  checkMissions(statKey, value) {
    const ms = this.s.missions;
    if (!ms || !this.g.settings.f_missions) return;
    for (const m of ms.list) {
      if (m.done) continue;
      if (m.special) {
        if (m.id === statKey && value !== undefined) m.progress = Math.max(m.progress, value);
      } else if (m.id === statKey) m.progress = this.stat(m.id) - m.start;
      if (m.progress >= m.target) { m.progress = m.target; m.done = true; this.g.onMissionDone(m); }
    }
  }
  claimMission(i) {
    const m = this.s.missions.list[i];
    if (!m || !m.done || m.claimed) return false;
    m.claimed = true;
    this.g.credit(m.reward, 'mission');
    this.addXp(m.reward);
    this.add('missionsDone');
    if (!this.s.missions.bonus && this.s.missions.list.every(x => x.claimed)) {
      this.s.missions.bonus = true;
      const b = 90 + this.s.level * 6;
      this.g.credit(b, 'mission');
      this.g.toast('✅', `${this.g.t('allMissions')} +${b}`);
    }
    return true;
  }

  // ---- login bonus ----
  checkLogin() {
    const d = today(), L = this.s.login;
    if (L.last === d) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yd = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    L.streak = L.last === yd ? L.streak + 1 : 1;
    L.last = d; L.total++;
    this.max('loginStreak', L.streak);
    this.dirtyAch = true;
    const day = ((L.streak - 1) % 7);
    return { day: day + 1, reward: LOGIN_REWARDS[day] + Math.floor(this.s.level * 2), gem: day === 6 };
  }

  // ---- gems ----
  // boost (difficulty reward): rarity r is boost^r times more likely
  rollGem(rnd = Math.random, boost = 1) {
    const type = Math.floor(rnd() * 6);
    const w = GEM_RARITY_W.map((x, i) => x * Math.pow(boost, i));
    let r = rnd() * w.reduce((a, b) => a + b), rarity = 0;
    for (let i = 0; i < w.length; i++) { if ((r -= w[i]) < 0) { rarity = i; break; } }
    return type * 4 + rarity;
  }
  collectGem(code) {
    const id = String(code);
    const isNew = !this.s.gems[id];
    this.s.gems[id] = (this.s.gems[id] || 0) + 1;
    const rarity = code % 4, type = Math.floor(code / 4);
    // duplicates of boosted rarities pay proportionally less, so the rarity boost speeds up the
    // collection without inflating the coin income
    const boost = this.g.diff ? this.g.diff.gem : 1;
    const reward = isNew ? GEM_REWARD_NEW[rarity] : Math.max(1, Math.round(GEM_REWARD_DUP[rarity] / Math.pow(boost, rarity)));
    this.add('gems');
    this.dirtyAch = true;
    let setBonus = 0;
    if (isNew && !this.s.gemSets[type] && [0, 1, 2, 3].every(r => this.s.gems[type * 4 + r])) {
      this.s.gemSets[type] = Date.now();
      setBonus = 500;
    }
    return { isNew, reward, rarity, type, setBonus };
  }
  // permanent bonus from collection: +1% slot luck per unique gem
  gemLuck() { return Math.min(0.25, Object.keys(this.s.gems).length * 0.01 + Object.keys(this.s.gemSets).length * 0.03); }
}

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { let s = seed || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
