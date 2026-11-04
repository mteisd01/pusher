// Slot distribution of the physical plinko board. usage: N=400 node tools/plinkosim.mjs
import RAPIER from '@dimforge/rapier3d-compat';
import { PlinkoPhysics, PLINKO_BOARD } from '../src/core/plinkoPhysics.js';
await RAPIER.init();
const N = +(process.env.N || 300);
for (const k of ['pinRest','ballRest','damp','dy','pin','aim','jitter']) if (process.env[k]) PLINKO_BOARD[k] = +process.env[k];
const p = new PlinkoPhysics(RAPIER);
const sweep = []; for (let a = 0; a <= PLINKO_BOARD.aim + 1e-6; a += 0.2) sweep.push([`x=${a.toFixed(1)}`, () => a]);
for (const [name, f] of [...(process.env.SWEEP ? sweep : [['centre', () => 0], ['edge', () => PLINKO_BOARD.aim]]), ['random', () => (Math.random() * 2 - 1) * PLINKO_BOARD.aim]]) {
  const hist = new Array(PLINKO_BOARD.slots).fill(0); let t = 0;
  for (let i = 0; i < N; i++) {
    p.drop(f()); let r = null;
    while (!r) r = p.step(1 / 60);
    hist[r.slot]++; t += p.t;
  }
  console.log(name.padEnd(7), hist.map(h => (h / N * 100).toFixed(1).padStart(5)).join(' '), ` JP ${((hist[0] + hist[8]) / N * 100).toFixed(1)}%  avg ${(t / N).toFixed(1)}s`);
}
