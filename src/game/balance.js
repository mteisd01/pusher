// All tunable game-balance numbers live here.
import { KIND, TOKEN } from '../core/layout.js';

export const B = {
  startCoins: 120,
  dropCost: 1,
  holdInterval: 0.2,          // seconds between drops while holding
  autoRateBase: 1.6,          // drops / s
  autoRatePerLv: 0.45,
  value: { [KIND.SILVER]: 1, [KIND.GOLD]: 5, [KIND.RAINBOW]: 25, [KIND.BIG]: 30 },
  gate: { half: 0.95, halfPerLv: 0.1, period: 4.6, range: 9.0 },
  stockBase: 4,
  slotTime: 2.4,
  fever: { dur: 30, durPerLv: 5 },
  walls: { dur: 25, durPerLv: 6 },
  turbo: { dur: 20, speed: 1.65 },
  double: { dur: 20 },
  jp: { base: 500, basePerLv: 150, growPerDrop: 0.25 },
  itemRate: 0.006, itemRatePerLv: 0.003,
  goldRatePerLv: 0.02,
  combo: { window: 1.4, steps: [[10, 3], [20, 8], [30, 15], [50, 30], [75, 60], [100, 120]] },
  regen: { capBase: 30, capPerLv: 15, secBase: 24, secPerLv: 3 },
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
  { sym: SYM.SEVEN, w: 6, kind: 'fever', shower: 30 },
  { sym: SYM.JP, w: 11, kind: 'ball' },
  { sym: SYM.BAR, w: 18, kind: 'shower', shower: 20 },
  { sym: SYM.BELL, w: 40, kind: 'shower', shower: 10 },
  { sym: SYM.CHERRY, w: 75, kind: 'shower', shower: 5 },
  { sym: SYM.STAR, w: 28, kind: 'item' },
  { sym: SYM.GOLD, w: 24, kind: 'gold', n: 3 },
  { sym: SYM.GEM, w: 9, kind: 'rainbow', n: 1 },
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
export const levelReward = lv => 20 + lv * 5;
export const TITLES = [[1, 'novice'], [5, 'rookie'], [10, 'regular'], [20, 'veteran'], [30, 'expert'], [45, 'master'], [60, 'grandmaster'], [80, 'legend'], [100, 'king']];

export const LOGIN_REWARDS = [50, 80, 100, 150, 200, 300, 500];
