// Headless simulator: performance + base payout ratio of the pusher table.
// usage: node tools/sim.mjs [seconds=300] [prefill=420] [dropsPerSec=2] [stroke=0] [walls=0]
import RAPIER from '@dimforge/rapier3d-compat';
import { PusherPhysics } from '../src/core/physics.js';
import { L, KIND, configureLayout } from '../src/core/layout.js';
configureLayout(process.env.SIZE || 'wide');
await RAPIER.init();
const [secs, pre, rate, stroke, walls, warm] = [300, 420, 2, 0, 0, 60].map((d, i) => process.argv[2 + i] !== undefined ? +process.argv[2 + i] : d);
const p = new PusherPhysics(RAPIER, { hz: 60, iterations: 2 });
p.strokeBonus = stroke; p.wallsUp = !!walls;
const n = p.prefill(pre);
const rnd = (a, b) => a + Math.random() * (b - a);
let won = 0, lost = 0, dropped = 0, gates = 0;
const ev = [];
const run = (frames, drop) => {
  let worst = 0;
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    if (drop && f % Math.round(60 / rate) === 0) {
      p.spawn(KIND.SILVER, rnd(-L.halfW + 0.7, L.halfW - 0.7), L.dropY, L.dropZ + rnd(-0.3, 0.3), null, { x: 0, y: -3, z: 0 }, 0, 1);
      dropped++;
    }
    ev.length = 0; ev.impacts = 0;
    const s = performance.now();
    p.step(1 / 60, ev);
    worst = Math.max(worst, performance.now() - s);
    for (const e of ev) { if (e.t === 'out') e.won ? won++ : lost++; if (e.t === 'gate') gates++; }
  }
  return [(performance.now() - t0) / frames, worst];
};
let [avg] = run(120, false);
console.log(`prefill ${n}, after settle won ${won} lost ${lost} bodies ${p.objs.length} (${avg.toFixed(2)}ms/f)`);
won = lost = 0;
// warmup (saturate) then measure
run(warm * 60, true);
const w0 = won, l0 = lost, d0 = dropped;
const [a2, worst] = run(secs * 60, true);
const dw = won - w0, dl = lost - l0, dd = dropped - d0;
let under = 0; for (const o of p.objs) if (o.y < -0.05 && o.z < L.frontZ) under++;
console.log(`measure ${secs}s: dropped ${dd} won ${dw} lost ${dl} payout ${(dw / dd).toFixed(3)} lossShare ${(dl / (dw + dl)).toFixed(3)} bodies ${p.objs.length} ${a2.toFixed(2)}ms/f worst ${worst.toFixed(1)} under ${under}`);
// distribution
const zones = {};
for (const o of p.objs) {
  const zone = o.y > L.pusherH - 0.05 && o.z < -1 ? 'shelf' : (o.z < -1 ? 'behind' : 'field');
  const lay = Math.max(0, Math.round((o.y - (zone === 'shelf' ? L.pusherH : 0) - L.coinHH) / (L.coinHH * 2)));
  zones[zone] = zones[zone] || {}; zones[zone][lay] = (zones[zone][lay] || 0) + 1;
}
console.log(JSON.stringify(zones));
if (process.env.SNAP) { const fs = await import('fs'); fs.writeFileSync(process.env.SNAP, JSON.stringify(p.snapshot())); console.log('snapshot saved'); }
