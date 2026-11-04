// JP ball diagnostic: where does a ball entering the table at a given exit end up and how fast?
// usage: SIZE=wide N=8 EXIT=field,front DENS=1.6 FRIC=0.5 ANG=0.6 node tools/ballsim.mjs
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { PusherPhysics } from '../src/core/physics.js';
import { L, KIND, BALLP, configureLayout } from '../src/core/layout.js';
import { decodeBoard } from '../src/save.js';
import { ballExit } from '../src/game/balance.js';
const size = process.env.SIZE || 'wide';
configureLayout(size);
await RAPIER.init();
if (process.env.DENS) BALLP.density = +process.env.DENS;
if (process.env.FRIC) BALLP.friction = +process.env.FRIC;
if (process.env.ANG) BALLP.angDamp = +process.env.ANG;
if (process.env.TILT) BALLP.tilt = +process.env.TILT;
const N = +(process.env.N || 8), MAX = +(process.env.MAX || 240);
const exits = (process.env.EXIT || 'field,front,shelf').split(',');
const rand = (a, b) => a + Math.random() * (b - a);
const board = decodeBoard(fs.readFileSync(`src/data/board_${size}.txt`, 'utf8').trim());
for (const ex of exits) {
  const times = []; let won = 0, lost = 0, stuck = 0, shelfMax = 0;
  for (let k = 0; k < N; k++) {
    const p = new PusherPhysics(RAPIER, { hz: 60 });
    p.restore(board);
    const ev = [];
    for (let f = 0; f < 120; f++) { ev.length = 0; p.step(1 / 60, ev); }
    let b;
    if (ex === 'shelf') b = p.spawn(KIND.BALL, rand(-(L.halfW - 1.5), L.halfW - 1.5), 6.5, rand(L.backWallZ + 1.2, L.pusherFrontMin - 0.8), null, { x: 0, y: -1, z: 0 });
    else { const e = ballExit(ex, p.strokeRange()[1], Math.random); b = p.spawn(KIND.BALL, e.x, e.y, e.z, null, e.v); }
    let out = null, shelfT = 0;
    for (let f = 0; f < 60 * MAX && !out; f++) {
      if (f % 24 === 0) p.spawn(KIND.SILVER, rand(-(L.halfW - 1), L.halfW - 1), L.dropY - 0.1, L.dropZ, null, { x: 0, y: -2.5, z: 0 }, 0, 1);
      ev.length = 0; p.step(1 / 60, ev);
      for (const e of ev) if (e.t === 'out' && e.id === b.id) out = { t: f / 60, won: e.won };
      if (!out && p._onShelf(b)) shelfT += 1 / 60;
    }
    shelfMax = Math.max(shelfMax, shelfT);
    if (!out) stuck++; else if (out.won) { won++; times.push(out.t); } else lost++;
  }
  times.sort((a, b) => a - b);
  const med = times.length ? times[times.length >> 1] : NaN;
  console.log(`${size} ${ex} dens${BALLP.density} fric${BALLP.friction} ang${BALLP.angDamp} tilt${BALLP.tilt}: won ${won}/${N} lost ${lost} stuck ${stuck} median ${med.toFixed(0)}s [${times.map(t => t.toFixed(0)).join(',')}] maxShelf ${shelfMax.toFixed(0)}s`);
}
