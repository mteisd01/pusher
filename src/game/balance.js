// All tunable game-balance numbers live here.
import { L, KIND, TOKEN } from '../core/layout.js';

export const B = {
  startCoins: 120,
  flipperDur: 12,            // seconds the gutter flippers kick
  dropCost: 1,
  holdInterval: 0.2,          // seconds between drops while holding
  autoRateBase: 1.6,          // drops / s
  autoRatePerLv: 0.45,
  value: { [KIND.SILVER]: 1, [KIND.GOLD]: 5, [KIND.RAINBOW]: 25, [KIND.BIG]: 30, [KIND.GIANT]: 50 },
  gate: { half: 0.7, halfPerLv: 0.08, period: 4.6, range: 9.0 },
  stockBase: 4,
  slotTime: 2.4,
  fever: { dur: 15, durPerLv: 3, goldChance: 0.25 },
  walls: { dur: 25, durPerLv: 6 },
  turbo: { dur: 20, speed: 1.65 },
  double: { dur: 20 },
  jp: { base: 500, basePerLv: 150, growPerDrop: 0.25 },
  itemRate: 0.003, itemRatePerLv: 0.0015,
  goldRatePerLv: 0.02,
  combo: { steps: [[30, 3], [40, 8], [55, 15], [75, 30]] },
  regen: { capBase: 20, capPerLv: 10, secBase: 40, secPerLv: 4 },
  difficulty: {
    easy: { slot: 1.2, gate: 1.25, item: 1.4, label: 'easy' },
    normal: { slot: 0.8, gate: 1, item: 1, label: 'normal' },
    hard: { slot: 0.65, gate: 0.8, item: 0.7, label: 'hard' },
  },
  maxShowerPhysical: 120,
};

// Slot symbols
export const SYM = { SEVEN: 0, BAR: 1, BELL: 2, CHERRY: 3, STAR: 4, JP: 5, GOLD: 6, GEM: 7 };
export const SYM_COUNT = 8;
// Outcomes: weight per 1000 spins (base), and payout description
export const SLOT_TABLE = [
  { sym: SYM.SEVEN, w: 4, kind: 'fever', shower: 12 },
  { sym: SYM.JP, w: 5, kind: 'ball' },
  { sym: SYM.BAR, w: 15, kind: 'shower', shower: 8 },
  { sym: SYM.BELL, w: 30, kind: 'shower', shower: 3, dice: 1 },
  { sym: SYM.CHERRY, w: 60, kind: 'shower', shower: 2 },
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
  { kind: KIND.TOKEN, extra: TOKEN.FEVER, w: 2 },
  { kind: KIND.TOKEN, extra: TOKEN.STOCK, w: 9 },
  { kind: KIND.GEM, w: 22 },
  { kind: KIND.CHEST, w: 10 },
  { kind: KIND.BIG, w: 6 },
  { kind: KIND.BALL, w: 2 },
  { kind: KIND.TOKEN, extra: TOKEN.PLINKO, w: 6 },
  { kind: KIND.TOKEN, extra: TOKEN.DICE, w: 8 },
  { kind: KIND.TOKEN, extra: TOKEN.MAGNET, w: 6 },
  { kind: KIND.TOKEN, extra: TOKEN.BOMB, w: 6 },
  { kind: KIND.TOKEN, extra: TOKEN.SHAKE, w: 6 },
  { kind: KIND.TOKEN, extra: TOKEN.CRANE, w: 5 },
  { kind: KIND.TOKEN, extra: TOKEN.FLIPPER, w: 6 },
];

export const GEM_RARITY_W = [62, 27, 9, 2];
export const GEM_REWARD_NEW = [10, 25, 80, 300];
export const GEM_REWARD_DUP = [2, 5, 15, 60];

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
export const levelReward = lv => 5 + lv;
export const TITLES = [[1, 'novice'], [5, 'rookie'], [10, 'regular'], [20, 'veteran'], [30, 'expert'], [45, 'master'], [60, 'grandmaster'], [80, 'legend'], [100, 'king']];

export const LOGIN_REWARDS = [30, 50, 60, 90, 120, 180, 300];

// ---------- v2 elements ----------
// Lucky Road (sugoroku) — 24 squares around the board. n scales with lap.
export const ROAD = [
  { t: 'start', color: '#455a64' },
  { t: 'coin', n: 3, color: '#c79100' }, { t: 'item', color: '#1565c0' }, { t: 'coin', n: 4, color: '#c79100' },
  { t: 'back', n: 2, color: '#b71c1c' }, { t: 'shower', n: 5, color: '#2e7d32' }, { t: 'plinko', color: '#6a1b9a' },
  { t: 'coin', n: 5, color: '#c79100' }, { t: 'stock', color: '#00838f' }, { t: 'again', color: '#ef6c00' },
  { t: 'gem', color: '#ad1457' }, { t: 'back', n: 3, color: '#b71c1c' }, { t: 'ball', color: '#37474f' },
  { t: 'coin', n: 6, color: '#c79100' }, { t: 'event', color: '#4527a0' }, { t: 'shower', n: 8, color: '#2e7d32' },
  { t: 'crane', color: '#d81b60' }, { t: 'back', n: 4, color: '#b71c1c' }, { t: 'fever', color: '#d81b60' },
  { t: 'coin', n: 8, color: '#c79100' }, { t: 'back', n: 2, color: '#b71c1c' }, { t: 'again', color: '#ef6c00' },
  { t: 'giant', color: '#8d6e00' }, { t: 'boss', color: '#000000' },
];
export const ROAD_LAP_BONUS = lap => 60 + Math.min(lap, 10) * 20;
export const ROAD_GATE_PER_DIE = 30;        // gate passes per die
export const roadMult = lap => 1 + Math.min(lap, 10) * 0.1;

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
  { id: 'goldRush', w: 3, dur: 15 },
  { id: 'meteor', w: 3, dur: 6 },
  { id: 'giant', w: 2, dur: 4 },
  { id: 'hyper', w: 3, dur: 15 },
  { id: 'luckyGate', w: 3, dur: 20 },
  { id: 'challenge', w: 3, dur: 30 },
  { id: 'tower', w: 3, dur: 8 },
  { id: 'quake', w: 2, dur: 7 },
  { id: 'crane', w: 2, dur: 4 },
  { id: 'spinField', w: 2, dur: 20 },
];

// Lucky wheel beside the screen: spun after WHEEL_NEED medals fell into the catcher cup
export const WHEEL_NEED = 12;
export const WHEEL = [
  { label: '3', n: 3, w: 22, color: '#c62828' },
  { label: 'CRANE', crane: true, w: 8, color: '#d81b60' },
  { label: 'ITEM', item: true, w: 10, color: '#1565c0' },
  { label: '10', n: 10, w: 14, color: '#ef6c00' },
  { label: 'TOWER', tower: true, w: 10, color: '#6a1b9a' },
  { label: '3', n: 3, w: 22, color: '#c62828' },
  { label: 'FLIP', flipper: true, w: 6, color: '#5c6bc0' },
  { label: 'DICE', dice: 1, w: 6, color: '#2e7d32' },
  { label: '25', n: 25, w: 4, color: '#ad1457' },
  { label: 'SHAKE', shake: true, w: 10, color: '#00838f' },
  { label: '×2', double: 8, w: 6, color: '#4527a0' },
  { label: 'BALL', ball: true, w: 2, color: '#f9a825' },
];
// Medal tower (event / wheel): stacked medals dropped onto the pusher shelf
export const COIN_TOWER = { coins: 10, gold: 2 };
// Ball coaster switch: where a JP ball goes (jp/chance weights grow with the luck upgrades)
export const COASTER_ROUTES = [{ id: 'field', w: 60 }, { id: 'chance', w: 32 }, { id: 'jp', w: 8 }];
// Crane chance: max medals the claw can hold, chance per medal to slip while lifting
export const CRANE_PLAY = { maxGrab: 15, slip: 0.3 };
export const EVENT_INTERVAL = [200, 400];   // seconds
export const POCKET_CYCLE = { closed: 35, open: 6 };
export const BONUS_ZONE = { half: 1.0, period: 7, mult: 2, stockChance: 0.12 };

// Ball coaster exits: where a JP ball enters the main table (field = side ramp just in front of
// the pusher, chance = lane near the front edge). pushMax = current max pusher front z.
export const BALL_EXIT = {
  field: { dx: 2.2, y: 1.9, z: 1.9, v: [4.5, 6.5] },
  chance: { dx: 2.2, y: 1.9, z: 3.2, v: [3.5, 6.0] },
};
export function ballExit(route, pushMax, rand = Math.random) {
  const R = (a, b) => a + rand() * (b - a);
  const W = L.halfW;
  const ex = BALL_EXIT[route] || BALL_EXIT.field;
  const z = Math.max(ex.z, pushMax + 0.9);
  return { x: W - ex.dx, y: ex.y, z, v: { x: -R(ex.v[0], ex.v[1]), y: -1, z: R(0, 0.5) } };
}
