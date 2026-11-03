// All tunable game-balance numbers live here.
import { KIND, TOKEN } from '../core/layout.js';

export const B = {
  startCoins: 120,
  dropCost: 1,
  holdInterval: 0.2,          // seconds between drops while holding
  autoRateBase: 1.6,          // drops / s
  autoRatePerLv: 0.45,
  value: { [KIND.SILVER]: 1, [KIND.GOLD]: 5, [KIND.RAINBOW]: 25, [KIND.BIG]: 30, [KIND.GIANT]: 50 },
  gate: { half: 0.78, halfPerLv: 0.09, period: 4.6, range: 9.0 },
  stockBase: 4,
  slotTime: 2.4,
  fever: { dur: 20, durPerLv: 4, goldChance: 0.35 },
  walls: { dur: 25, durPerLv: 6 },
  turbo: { dur: 20, speed: 1.65 },
  double: { dur: 20 },
  jp: { base: 500, basePerLv: 150, growPerDrop: 0.25 },
  itemRate: 0.004, itemRatePerLv: 0.002,
  goldRatePerLv: 0.02,
  combo: { steps: [[22, 3], [30, 8], [40, 15], [55, 30], [75, 60]] },
  regen: { capBase: 20, capPerLv: 10, secBase: 40, secPerLv: 4 },
  difficulty: {
    easy: { slot: 1.35, gate: 1.25, item: 1.4, label: 'easy' },
    normal: { slot: 1, gate: 1, item: 1, label: 'normal' },
    hard: { slot: 0.72, gate: 0.8, item: 0.7, label: 'hard' },
  },
  maxShowerPhysical: 120,
};

// Slot symbols
export const SYM = { SEVEN: 0, BAR: 1, BELL: 2, CHERRY: 3, STAR: 4, JP: 5, GOLD: 6, GEM: 7 };
export const SYM_COUNT = 8;
// Outcomes: weight per 1000 spins (base), and payout description
export const SLOT_TABLE = [
  { sym: SYM.SEVEN, w: 5, kind: 'fever', shower: 15 },
  { sym: SYM.JP, w: 8, kind: 'ball' },
  { sym: SYM.BAR, w: 15, kind: 'shower', shower: 10 },
  { sym: SYM.BELL, w: 35, kind: 'shower', shower: 4, dice: 1 },
  { sym: SYM.CHERRY, w: 70, kind: 'shower', shower: 3 },
  { sym: SYM.STAR, w: 25, kind: 'item' },
  { sym: SYM.GOLD, w: 20, kind: 'gold', n: 2 },
  { sym: SYM.GEM, w: 8, kind: 'rainbow', n: 1 },
];

// JP roulette pockets
export const ROULETTE = [
  { id: 'JP', label: 'JP', color: '#ffd700' },
  { id: 'c', label: '20', n: 20, color: '#c62828' },
  { id: 'c', label: '50', n: 50, color: '#1e1e1e' },
  { id: 'c', label: '10', n: 10, color: '#c62828' },
  { id: 'FEVER', label: 'FEVER', color: '#ff2d6f' },
  { id: 'c', label: '30', n: 30, color: '#1e1e1e' },
  { id: 'c', label: '10', n: 10, color: '#c62828' },
  { id: 'c', label: '100', n: 100, color: '#1e1e1e' },
  { id: 'BIG', label: 'BIG×3', n: 3, color: '#2e7d32' },
  { id: 'c', label: '20', n: 20, color: '#c62828' },
  { id: 'c', label: '10', n: 10, color: '#1e1e1e' },
  { id: 'c', label: '30', n: 30, color: '#c62828' },
  { id: 'WALL', label: 'WALL', color: '#1565c0' },
  { id: 'c', label: '20', n: 20, color: '#1e1e1e' },
  { id: 'c', label: '50', n: 50, color: '#c62828' },
  { id: 'c', label: '10', n: 10, color: '#1e1e1e' },
];

// Random item table (used by star symbol, chests and random spawns)
export const ITEM_TABLE = [
  { kind: KIND.TOKEN, extra: TOKEN.WALL, w: 14 },
  { kind: KIND.TOKEN, extra: TOKEN.SHOWER, w: 14 },
  { kind: KIND.TOKEN, extra: TOKEN.TURBO, w: 10 },
  { kind: KIND.TOKEN, extra: TOKEN.DOUBLE, w: 9 },
  { kind: KIND.TOKEN, extra: TOKEN.FEVER, w: 3 },
  { kind: KIND.TOKEN, extra: TOKEN.STOCK, w: 9 },
  { kind: KIND.GEM, w: 22 },
  { kind: KIND.CHEST, w: 10 },
  { kind: KIND.BIG, w: 6 },
  { kind: KIND.BALL, w: 3 },
  { kind: KIND.TOKEN, extra: TOKEN.PLINKO, w: 6 },
  { kind: KIND.TOKEN, extra: TOKEN.DICE, w: 8 },
  { kind: KIND.TOKEN, extra: TOKEN.MAGNET, w: 6 },
  { kind: KIND.TOKEN, extra: TOKEN.BOMB, w: 6 },
];

export const GEM_RARITY_W = [62, 27, 9, 2];
export const GEM_REWARD_NEW = [20, 60, 200, 1000];
export const GEM_REWARD_DUP = [5, 15, 50, 250];

export const UPGRADES = [
  { id: 'stroke', max: 5, cost: 400, grow: 1.9 },
  { id: 'gate', max: 5, cost: 300, grow: 1.8 },
  { id: 'luck', max: 8, cost: 300, grow: 1.7 },
  { id: 'stock', max: 4, cost: 500, grow: 2.0 },
  { id: 'wall', max: 5, cost: 250, grow: 1.8 },
  { id: 'fever', max: 5, cost: 450, grow: 1.9 },
  { id: 'gold', max: 5, cost: 800, grow: 2.0 },
  { id: 'item', max: 5, cost: 350, grow: 1.8 },
  { id: 'jp', max: 5, cost: 700, grow: 1.9 },
  { id: 'auto', max: 6, cost: 150, grow: 1.7 },
  { id: 'multi', max: 2, cost: 1200, grow: 2.5 },
  { id: 'regen', max: 5, cost: 100, grow: 1.8 },
];
export const upgradeCost = (u, lv) => Math.round(u.cost * Math.pow(u.grow, lv) / 10) * 10;

export const xpForLevel = lv => Math.round(40 * Math.pow(lv, 1.45));
export const levelReward = lv => 10 + lv * 2;
export const TITLES = [[1, 'novice'], [5, 'rookie'], [10, 'regular'], [20, 'veteran'], [30, 'expert'], [45, 'master'], [60, 'grandmaster'], [80, 'legend'], [100, 'king']];

export const LOGIN_REWARDS = [30, 50, 60, 90, 120, 180, 300];

// ---------- v2 elements ----------
// Lucky Road (sugoroku) — 24 squares around the board. n scales with lap.
export const ROAD = [
  { t: 'start', color: '#455a64' },
  { t: 'coin', n: 10, color: '#c79100' }, { t: 'item', color: '#1565c0' }, { t: 'coin', n: 15, color: '#c79100' },
  { t: 'back', n: 2, color: '#b71c1c' }, { t: 'shower', n: 15, color: '#2e7d32' }, { t: 'plinko', color: '#6a1b9a' },
  { t: 'coin', n: 20, color: '#c79100' }, { t: 'stock', color: '#00838f' }, { t: 'again', color: '#ef6c00' },
  { t: 'gem', color: '#ad1457' }, { t: 'back', n: 3, color: '#b71c1c' }, { t: 'ball', color: '#37474f' },
  { t: 'coin', n: 25, color: '#c79100' }, { t: 'event', color: '#4527a0' }, { t: 'shower', n: 20, color: '#2e7d32' },
  { t: 'item', color: '#1565c0' }, { t: 'back', n: 4, color: '#b71c1c' }, { t: 'fever', color: '#d81b60' },
  { t: 'coin', n: 30, color: '#c79100' }, { t: 'plinko', color: '#6a1b9a' }, { t: 'again', color: '#ef6c00' },
  { t: 'giant', color: '#8d6e00' }, { t: 'boss', color: '#000000' },
];
export const ROAD_LAP_BONUS = lap => 200 + lap * 80;
export const ROAD_GATE_PER_DIE = 10;        // gate passes per die

// 3-stage croon. JP probability ≈ 1/2 × 1/3 × 1/4 = 1/24 per ball (before luck)
export const CROON = [
  { holes: [{ label: 'NEXT', good: true, color: '#2e7d32' }, { label: '10', n: 10, color: '#7a1f1f' }, { label: 'NEXT', good: true, color: '#2e7d32' }, { label: '15', n: 15, color: '#7a1f1f' }] },
  { holes: [{ label: 'NEXT', good: true, color: '#2e7d32' }, { label: '30', n: 30, color: '#7a1f1f' }, { label: '25', n: 25, color: '#7a1f1f' }] },
  { holes: [{ label: 'JP', good: true, jp: true, color: '#ffd700' }, { label: '100', n: 100, color: '#7a1f1f' }, { label: 'FEVER', fever: true, color: '#ad1457' }, { label: '60', n: 60, color: '#7a1f1f' }] },
];

// Plinko pockets (center most likely)
export const PLINKO = [
  { label: 'JP', ball: true, good: true, color: '#ffd700' }, { label: '40', n: 40, good: true, color: '#ff7043' },
  { label: '15', n: 15, color: '#ffb74d' }, { label: '6', n: 6, color: '#e0e0e0' }, { label: '3', n: 3, color: '#bdbdbd' },
  { label: '6', n: 6, color: '#e0e0e0' }, { label: '15', n: 15, color: '#ffb74d' }, { label: '40', n: 40, good: true, color: '#ff7043' },
  { label: 'JP', ball: true, good: true, color: '#ffd700' },
];

// Random field events
export const EVENTS = [
  { id: 'goldRush', w: 3, dur: 20 },
  { id: 'meteor', w: 3, dur: 6 },
  { id: 'giant', w: 2, dur: 4 },
  { id: 'hyper', w: 3, dur: 15 },
  { id: 'luckyGate', w: 3, dur: 20 },
  { id: 'challenge', w: 3, dur: 30 },
];
export const EVENT_INTERVAL = [150, 300];   // seconds
export const POCKET_CYCLE = { closed: 35, open: 6 };
export const BONUS_ZONE = { half: 1.0, period: 7, mult: 2, stockChance: 0.12 };
