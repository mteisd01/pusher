// Full-game headless balance simulator: real physics + real game logic, stubbed presentation.
// usage: node tools/gamesim.mjs [minutes=10] [strategy=random|aim] [dropsPerSec=4] [size=wide] [difficulty=normal]
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { L, configureLayout, cupXAt } from '../src/core/layout.js';
const [mins, strat, rate, size, diff] = [process.argv[2] || 10, process.argv[3] || 'random', process.argv[4] || 4, process.argv[5] || 'wide', process.argv[6] || 'normal'];
const { diffDef } = await import('../src/game/balance.js');
configureLayout(size);

globalThis.document = globalThis.document || { documentElement: {} };
const { PusherPhysics } = await import('../src/core/physics.js');
const { Game } = await import('../src/game/game.js');
const { newSave, decodeBoard } = await import('../src/save.js');
await RAPIER.init();
const phys = new PusherPhysics(RAPIER, { hz: 60, iterations: 2 });
const boardFile = new URL(`../src/data/board_${size}.txt`, import.meta.url);
if (fs.existsSync(boardFile)) phys.restore(decodeBoard(fs.readFileSync(boardFile, 'utf8').trim())); else phys.prefill(500);
const physics = {
  cmd(...c) {
    switch (c[0]) {
      case 'spawn': phys.spawn(c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9]); break;
      case 'walls': phys.wallsUp = !!c[1]; break;
      case 'speed': phys.speed = c[1]; break;
      case 'stroke': phys.strokeBonus = c[1]; break;
      case 'pocket': phys.pocketOpen = !!c[1]; break;
      case 'magnet': phys.magnet = !!c[1]; break;
      case 'blast': phys.blast(c[1], c[2], c[3], c[4]); break;
      case 'drain': phys.drain(c[1]); break;
      case 'outZone': phys.outZone = c[1]; break;
      case 'cup': phys.cupOn = !!c[1]; break;
      case 'shake': phys.shake(c[1]); break;
      case 'craneStart': phys.craneStart(c[1], c[2]); break;
      case 'craneAim': phys.craneAim(c[1]); break;
      case 'craneDrop': phys.craneDrop(); break;
      case 'turntable': phys.ttOn = !!c[1]; break;
      case 'flippers': phys.flipOn = !!c[1]; if (c[1]) phys.flipT = 0; break;
      default: if (phys['cmd_' + c[0]]) phys['cmd_' + c[0]](...c.slice(1));
    }
  },
};
const noop = () => {};
const proxy = new Proxy({}, { get: (t, k) => k === 'then' ? undefined : (t[k] || noop) });
const save = newSave();
save.coins = 100000;
for (const k of ['maxWallet_0', 'maxWallet_1', 'maxWallet_2']) save.achievements[k] = 1; // don't count wallet achievements
save.settings.difficulty = diff;
save.settings.f_login = false; save.settings.f_hints = false; save.settings.f_regen = false;
// OFF=f_rush,f_bingo switches features off (compare with / without them)
for (const k of (process.env.OFF || '').split(',').filter(Boolean)) save.settings[k] = false;
const tally = {};
const roulette = { active: false, run: async idx => { const { ROULETTE } = await import('../src/game/balance.js'); return ROULETTE[idx]; } };
const mini = {
  roadMove: async (board, from, steps) => (from + steps) % board.length,
  croon: async stages => {
    for (let i = 0; i < stages.length; i++) {
      const hs = stages[i].holes, tot = hs.reduce((a, h) => a + (h.w || 1), 0);
      let r = Math.random() * tot, hole = hs[0];
      for (const h of hs) { if ((r -= (h.w || 1)) < 0) { hole = h; break; } }
      if (!hole.good || i === stages.length - 1) return { stage: i, hole };
    }
  },
  plinko: async pk => { let k = 0; for (let i = 0; i < 8; i++) k += Math.random() < 0.5 ? 1 : 0; return pk[k]; },
};
// the real croon physics for the 3D tower lottery
const { CroonPhysics, holeLayout } = await import('../src/core/croonPhysics.js');
const croonPhys = new CroonPhysics(RAPIER);
const tower = {
  active: false,
  run: async (stages, luck, _p, opts = {}) => {
    for (let i = opts.startStage || 0; i < stages.length; i++) {
      croonPhys.start(holeLayout(stages[i].holes, luck), [0.75, -0.95, 1.15][i]);
      let r = null; for (let f = 0; f < 60 * 60 && !r; f++) r = croonPhys.step(1 / 60);
      croonPhys.stop();
      const hole = stages[i].holes[r ? r.hole : 1];
      if (!hole.good || i === stages.length - 1) return { stage: i, hole };
    }
  },
};
const game = new Game({ stage: proxy, coins: proxy, backboard: proxy, effects: proxy, audio: proxy, physics, ui: proxy, save, roulette, mini, tower });
// ball coaster: hands the ball over at the real exit points right away
const { ballExit } = await import('../src/game/balance.js');
const routes = {};
const coaster = { busy: false, launch: (route, cb, dropX = 0) => { routes[route] = (routes[route] || 0) + 1; if (route !== 'field') return cb(route, null, null); const e = ballExit(dropX, phys.strokeRange()[1]); cb(route, { x: e.x, y: e.y, z: e.z }, e.v); } };
game.machines = { wheel: { spin: async () => {} }, cup: {}, coaster };
// the real plinko physics (random drop position)
const { PlinkoPhysics, PLINKO_BOARD } = await import('../src/core/plinkoPhysics.js');
const plk = new PlinkoPhysics(RAPIER);
game.plinko3d = { setAim() {}, setAimWorld() {}, run: async () => { plk.drop((Math.random() * 2 - 1) * PLINKO_BOARD.aim); let r = null; while (!r) r = plk.step(1 / 60); return r.slot; } };
physics.cmd('cup', true);
const credit = game.credit.bind(game);
game.credit = (n, src) => { tally[src] = (tally[src] || 0) + Math.round(n); credit(n, src); };
const fights = [];
for (const k of ['defeat', 'retreat']) { const f = game.boss[k].bind(game.boss); game.boss[k] = () => { const a = game.boss.active; fights.push(`${k === 'defeat' ? 'WIN' : 'lose'} s${a.stage} ${(a.time - a.t).toFixed(0)}s hp${Math.round(a.hpMax)} left${Math.round(Math.max(0, a.hp))}`); f(); }; }
game.start();
const dt = 1 / 60, frames = mins * 60 * 60;
const ev = [];
let dropAcc = 0;
const start = save.coins;
const marks = [];
let steady = null; // after the initial (baked) pile has settled to the new equilibrium
const t0 = performance.now();
for (let f = 0; f < frames; f++) {
  // input strategy
  dropAcc += dt * rate;
  if (dropAcc >= 1) {
    dropAcc -= 1;
    let x;
    if (strat === 'cup') {
      // track the catcher cup (leading it by the fall time)
      x = cupXAt(phys.time + 0.3);
    } else if (strat === 'aim' && save.stock < game.stockMax()) {
      const tt = game.time + 0.18, range = Math.min(game.balance.gate.range, L.halfW - 2);
      x = game.gateXAt ? game.gateXAt(tt) : Math.sin(tt * Math.PI * 2 / game.balance.gate.period) * range;
    } else x = (Math.random() * 2 - 1) * (L.halfW - 0.8);
    game.setAim(x); game.launcherX = game.aimX; game.drop();
  }
  game.update(dt);
  ev.length = 0; ev.impacts = 0;
  phys.step(dt, ev);
  game.onPhysicsFrame({ ev, n: phys.objs.length, ms: 0 });
  if (f % 30 === 0) await new Promise(r => setImmediate(r)); // let async game code (mini games) progress
  if (f % (60 * 60) === 0) marks.push(`${Math.round(f / 3600)}m:${save.coins - start}`);
  if (f === 8 * 3600) steady = { coins: save.coins, dropped: save.stats.dropped || 0, ach: tally.achievement || 0, objs: phys.objs.length };
}
const st = save.stats;
const dropped = st.dropped || 0;
const net = save.coins - start;
console.log(`difficulty=${diff} strategy=${strat} size=${size} ${mins}min rate=${rate}/s  sim ${(performance.now() - t0) / 1000 | 0}s`);
console.log(`dropped ${dropped}  net ${net}  return ${((dropped + net) / dropped * 100).toFixed(1)}%  level ${save.level}  objs ${phys.objs.length}`);
console.log('income by source', JSON.stringify(tally));
console.log('stats', JSON.stringify({ gate: st.gatePasses, spins: st.slotSpins, wins: st.slotWins, jp: st.jpLottery, jpWins: st.jpWins, fevers: st.fevers, items: st.items, lost: st.lost, dice: st.diceRolls, laps: st.roadLaps, events: st.events, pockets: st.pockets, plinko: st.plinkos, catches: st.catches, wheels: st.wheels, towers: st.towers, shakes: st.shakes, croonBest: st.croonBest, cranes: st.cranes, grabs: st.craneGrabs, flips: st.flips, rocks: st.rocks, bossFights: st.bossFights, bossKills: st.bossKills, bossBest: st.bossBestStage, bossDmg: st.bossDamage }));
const ex = Object.entries(tally).filter(([k]) => k !== 'achievement').reduce((a, [, v]) => a + v, 0);
console.log('boss', JSON.stringify(save.boss || {}), fights.join(' | '));
console.log(`return excl. achievements: ${((ex) / dropped * 100).toFixed(1)}%  (board-only win: ${((tally.win || 0) / dropped * 100).toFixed(1)}%)`);
console.log('timeline', marks.join(' '));
console.log('ball routes', JSON.stringify(routes));
if (steady) {
  const d = (save.stats.dropped || 0) - steady.dropped, n = save.coins - steady.coins - ((tally.achievement || 0) - steady.ach);
  console.log(`steady-state return from minute 8 (excl. achievements): ${((d + n) / d * 100).toFixed(1)}%`);
  // medals released from (or stored into) the pile inflate (deflate) the measured return
  const dp = phys.objs.length - steady.objs;
  console.log(`pile ${steady.objs} -> ${phys.objs.length}; pile-corrected return: ${((d + n + dp) / d * 100).toFixed(1)}%`);
}
