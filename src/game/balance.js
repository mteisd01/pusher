// All tunable game-balance numbers live here.
import { L, KIND, TOKEN } from '../core/layout.js';

export const B = {
  startCoins: 120,
  flipperDur: 20,            // seconds the gutter flippers kick (they also kick during fever)
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
  // slot / gate / item: odds multipliers. outZone: width of the OUT zones at both ends of the
  // front edge (medals falling there are lost; measured: a longer side gutter barely changes
  // the payout, the front corners do). xp / jp / gem: rewards (XP gain, JP pool growth, gem rarity
  // boost). walls: guard-wall duration. upgCost: shop price multiplier. regen: coin regeneration cap. rocks: falling-rock interval [s].
  difficulty: {
    easy: { slot: 1.2, gate: 1.25, item: 1.4, outZone: 0, upgCost: 0.8, xp: 1, jp: 1, gem: 1, walls: 1.2, regen: 1.5, rocks: null,
      bossHp: 0.6, bossTime: 90, bossAtk: 1.3, bossReward: 0.8, bossMix: 0, bossEnrage: false, bossRegen: false, bossBarrier: false, bossBeam: 5, color: '#7CFFB2', badge: '' },
    normal: { slot: 0.8, gate: 1, item: 1, outZone: 0, upgCost: 1, xp: 1, jp: 1, gem: 1, walls: 1, regen: 1, rocks: null,
      bossHp: 1, bossTime: 75, bossAtk: 1, bossReward: 1, bossMix: 0, bossEnrage: false, bossRegen: false, bossBarrier: false, bossBeam: 6, color: '#ffffff', badge: '' },
    hard: { slot: 0.65, gate: 0.8, item: 0.7, outZone: 0.8, upgCost: 1.15, xp: 1.1, jp: 1.1, gem: 1.15, walls: 0.9, regen: 1, rocks: null,
      bossHp: 1.1, bossTime: 72, bossAtk: 0.85, bossReward: 1.2, bossMix: 0, bossEnrage: false, bossRegen: false, bossBarrier: false, bossBeam: 7, color: '#ff9e1b', badge: '' },
    expert: { slot: 0.55, gate: 0.7, item: 0.6, outZone: 1.1, upgCost: 1.3, xp: 1.25, jp: 1.2, gem: 1.35, walls: 0.8, regen: 0.8, rocks: null,
      bossHp: 1.15, bossTime: 70, bossAtk: 0.7, bossReward: 1.45, bossMix: 1, bossEnrage: true, bossRegen: false, bossBarrier: false, bossBeam: 8, color: '#ffd34d', badge: '達' },
    shura: { slot: 0.47, gate: 0.62, item: 0.5, outZone: 1.8, upgCost: 1.5, xp: 1.45, jp: 1.35, gem: 1.6, walls: 0.7, regen: 0.5, rocks: [180, 300],
      bossHp: 0.9, bossTime: 66, bossAtk: 0.6, bossReward: 1.75, bossMix: 1, bossEnrage: true, bossRegen: true, bossBarrier: false, bossBeam: 9, color: '#ff2d55', badge: '修' },
    inferno: { slot: 0.4, gate: 0.55, item: 0.42, outZone: 2.7, upgCost: 1.75, xp: 1.7, jp: 1.5, gem: 2.0, walls: 0.6, regen: 0.5, rocks: [120, 220],
      bossHp: 0.95, bossTime: 62, bossAtk: 0.5, bossReward: 2.1, bossMix: 2, bossEnrage: true, bossRegen: true, bossBarrier: true, bossBeam: 10, color: '#d500f9', badge: '獄' },
  },
  maxShowerPhysical: 120,
};

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'shura', 'inferno'];
export const diffDef = id => B.difficulty[id] || B.difficulty.normal;
// value of a rock block pushed off the front edge
export const ROCK_REWARD = 3;

// Boss battles (see game/boss.js). The stage gauge fills with drops (1) and gate passes;
// HP = hp * hpGrow^(stage-1) * difficulty.bossHp; reward = (reward + rewardPerStage*(stage-1)) * bossReward
export const BOSS = {
  gaugeNeed: 1800, gaugePerGate: 3, gaugeRoad: 0.3, introMs: 3000,
  hp: 280, hpGrow: 1.1, reward: 55, rewardPerStage: 12, ballChance: 0.25,
  firstAttack: 8, attackEvery: 14, weakEvery: 16, weakDur: 4, critMult: 5,
  barrierEvery: 22, barrierDur: 4, regenAfter: 5, regenRate: 0.006,
  jamDur: 7, freezeDur: 6, freezeSpeed: 0.5, drain: [2, 6],
  // every attack is announced warnTime s ahead; jam / freeze cannot be repeated for dur*repeatCd s
  // after they end; breaking the jam beam (difficulty.bossBeam medal hits) stuns the boss for stunDur s
  // beamReach: medals within this multiple of the normal gate half-width hit the beam
  warnTime: 2.5, repeatCd: 1.5, stunDur: 3, beamReach: 1.3,
  retryGauge: 0.5, consolation: 0.3,
  // damage per action
  dmg: { silver: 1, gold: 4, rainbow: 15, big: 20, gate: 4, slot: 25, ball: 60, item: 12, grab: 4, rock: 40, combo: 0.5, beam: 30 },
};
export const BOSS_TYPES = [
  { id: 'golem', atk: 'rock' }, { id: 'dragon', atk: 'jam' }, { id: 'kraken', atk: 'drain' }, { id: 'phantom', atk: 'freeze' },
];
// cosmetic rewards of the upper difficulties: theme (beat the stage-3 boss), medal look (stage 5),
// title (first boss kill)
export const DIFF_REWARDS = {
  expert: { theme: 'obsidian', skin: 'platinum', title: 'expertKing' },
  shura: { theme: 'crimson', skin: 'crimson', title: 'shuraKing' },
  inferno: { theme: 'inferno', skin: 'hellfire', title: 'infernoKing' },
};
export const DIFF_REWARD_STAGE = { theme: 3, skin: 5, title: 1 };

// Slot symbols
export const SYM = { SEVEN: 0, BAR: 1, BELL: 2, CHERRY: 3, STAR: 4, JP: 5, GOLD: 6, GEM: 7 };
export const SYM_COUNT = 8;
// Outcomes: weight per 1000 spins (base), and payout description
export const SLOT_TABLE = [
  { sym: SYM.SEVEN, w: 4, kind: 'fever', shower: 12 },
  { sym: SYM.JP, w: 6, kind: 'ball' },
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
// Ball coaster switch: where a JP ball goes (super/premium weights grow with the luck upgrades).
// field: dropped onto the table (croon from stage 1 once pushed off); super: straight to the croon
// from stage 2; premium: straight to the final stage. startStage = croon stage the route starts at.
export const COASTER_ROUTES = [{ id: 'field', w: 72, startStage: 0 }, { id: 'super', w: 22, startStage: 1 }, { id: 'premium', w: 6, startStage: 2 }];
export const routeStart = id => (COASTER_ROUTES.find(r => r.id === id) || COASTER_ROUTES[0]).startStage;
// Crane chance: max medals the claw can hold, chance per medal to slip while lifting
// prizes: what a crane chance puts on the field (glowing targets, sure items); payMult: medals
// carried to the prize chute pay this multiple (the extra is credited on the drop)
export const CRANE_PLAY = { maxGrab: 15, slip: 0.2, payMult: 2, prizes: [1, 2],
  prizeTable: [{ kind: 'token', extra: 'FEVER', w: 2 }, { kind: 'ball', w: 2 }, { kind: 'token', extra: 'DOUBLE', w: 3 }, { kind: 'token', extra: 'DICE', w: 3 }, { kind: 'token', extra: 'STOCK', w: 3 }, { kind: 'chest', w: 3 }, { kind: 'rainbow', w: 2 }] };
export const EVENT_INTERVAL = [200, 400];   // seconds
export const POCKET_CYCLE = { closed: 35, open: 6 };
export const BONUS_ZONE = { half: 1.0, period: 7, mult: 2, stockChance: 0.12 };

// Special drops (big / rainbow / giant medals, items, JP balls) land a little off the middle of
// the table: |x| in [lo, hi] * halfW on a random side (the ends feed the gutters / OUT zones).
export const OFF_CENTER = { lo: 0.15, hi: 0.45 };
export function offCenterX(rand = Math.random, lo = OFF_CENTER.lo, hi = OFF_CENTER.hi) {
  return (rand() < 0.5 ? -1 : 1) * (lo + rand() * (hi - lo)) * L.halfW;
}
// overhead field rail of the ball coaster: z of the rail (in front of the longest pusher stroke)
// and how far left it reaches (a bit past the leftmost drop point)
export const fieldRailZ = () => 1.9;
export const fieldRailReach = W => OFF_CENTER.hi * W + 0.8;
// where a field JP ball enters the physics (falls from the rail at x). pushMax = max pusher front z.
export function ballExit(x, pushMax) {
  return { x, y: 4.0, z: Math.max(fieldRailZ(), pushMax + 0.9), v: { x: -0.4, y: -1, z: 0.3 } };
}
