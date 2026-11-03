// Full-game headless balance simulator: real physics + real game logic, stubbed presentation.
// usage: node tools/gamesim.mjs [minutes=10] [strategy=random|aim] [dropsPerSec=4] [size=wide]
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { L, configureLayout } from '../src/core/layout.js';
const [mins, strat, rate, size] = [process.argv[2] || 10, process.argv[3] || 'random', process.argv[4] || 4, process.argv[5] || 'wide'];
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
      default: if (phys['cmd_' + c[0]]) phys['cmd_' + c[0]](...c.slice(1));
    }
  },
};
const noop = () => {};
const proxy = new Proxy({}, { get: (t, k) => k === 'then' ? undefined : (t[k] || noop) });
const save = newSave();
save.coins = 100000;
save.stats.maxWallet = 1e9; // don't count wallet achievements in the measurement
save.settings.f_login = false; save.settings.f_hints = false; save.settings.f_regen = false;
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
const game = new Game({ stage: proxy, coins: proxy, backboard: proxy, effects: proxy, audio: proxy, physics, ui: proxy, save, roulette, mini });
const credit = game.credit.bind(game);
game.credit = (n, src) => { tally[src] = (tally[src] || 0) + Math.round(n); credit(n, src); };
game.start();
const dt = 1 / 60, frames = mins * 60 * 60;
const ev = [];
let dropAcc = 0;
const start = save.coins;
const marks = [];
const t0 = performance.now();
for (let f = 0; f < frames; f++) {
  // input strategy
  dropAcc += dt * rate;
  if (dropAcc >= 1) {
    dropAcc -= 1;
    let x;
    if (strat === 'aim' && save.stock < game.stockMax()) {
      const tt = game.time + 0.18, range = Math.min(game.balance.gate.range, L.halfW - 2);
      x = game.gateXAt ? game.gateXAt(tt) : Math.sin(tt * Math.PI * 2 / game.balance.gate.period) * range;
    } else x = (Math.random() * 2 - 1) * (L.halfW - 0.8);
    game.setAim(x); game.launcherX = game.aimX; game.drop();
  }
  game.update(dt);
  ev.length = 0; ev.impacts = 0;
  phys.step(dt, ev);
  game.onPhysicsFrame({ ev, n: phys.objs.length, ms: 0 });
  if (f % (60 * 60) === 0) marks.push(`${Math.round(f / 3600)}m:${save.coins - start}`);
}
const st = save.stats;
const dropped = st.dropped || 0;
const net = save.coins - start;
console.log(`strategy=${strat} size=${size} ${mins}min rate=${rate}/s  sim ${(performance.now() - t0) / 1000 | 0}s`);
console.log(`dropped ${dropped}  net ${net}  return ${((dropped + net) / dropped * 100).toFixed(1)}%  level ${save.level}  objs ${phys.objs.length}`);
console.log('income by source', JSON.stringify(tally));
console.log('stats', JSON.stringify({ gate: st.gatePasses, spins: st.slotSpins, wins: st.slotWins, jp: st.jpLottery, jpWins: st.jpWins, fevers: st.fevers, items: st.items, lost: st.lost, dice: st.diceRolls, laps: st.roadLaps, events: st.events, pockets: st.pockets, plinko: st.plinkos }));
const ex = Object.entries(tally).filter(([k]) => k !== 'achievement').reduce((a, [, v]) => a + v, 0);
console.log(`return excl. achievements: ${((ex) / dropped * 100).toFixed(1)}%  (board-only win: ${((tally.win || 0) / dropped * 100).toFixed(1)}%)`);
console.log('timeline', marks.join(' '));
