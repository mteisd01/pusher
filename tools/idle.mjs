// Idle-table diagnostic: jitter of resting coins and impact-sound events with no input.
// usage: SIZE=wide ITER=2 node tools/idle.mjs [settleSec=30] [measureSec=20]
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { PusherPhysics } from '../src/core/physics.js';
import { L, configureLayout } from '../src/core/layout.js';
import { decodeBoard } from '../src/save.js';
const size = process.env.SIZE || 'wide';
configureLayout(size);
await RAPIER.init();
const [settle, meas] = [30, 20].map((d, i) => process.argv[2 + i] !== undefined ? +process.argv[2 + i] : d);
const p = new PusherPhysics(RAPIER, { hz: 60, iterations: +(process.env.ITER || 0) || undefined });
p.restore(decodeBoard(fs.readFileSync(`src/data/board_${size}.txt`, 'utf8').trim()));
const ev = [];
for (let f = 0; f < settle * 60; f++) { ev.length = 0; p.step(1 / 60, ev); }
let hits = 0, mv = 0, field = 0, fieldAng = 0, fieldLin = 0, jit = 0, t = 0;
const zones = {};
const t0 = performance.now();
for (let f = 0; f < meas * 60; f++) {
  ev.length = 0; p.step(1 / 60, ev);
  for (const e of ev) {
    if (e.t === 'hit') { hits++; const z = (e.y > L.pusherH - 0.1 && e.z < -1 ? 'shelf' : 'field') + ':' + e.surf; zones[z] = (zones[z] || 0) + 1; }
    if (e.t === 'mv') mv += e.v;
  }
  if (f % 10 === 0) for (const o of p.objs) {
    if (o.y > 0.5 || o.z < p.pusherFrontAt(p.phase) + 1.5) continue; // resting bottom layer, clear of the pusher
    const a = o.body.angvel(), v = o.body.linvel();
    const aa = Math.hypot(a.x, a.y, a.z); if (aa > 0.4) { jit++; o.jc = (o.jc || 0) + 1; } o.sc = (o.sc || 0) + 1; fieldAng += aa; fieldLin += Math.hypot(v.x, v.y, v.z); field++;
  }
}
const ms = (performance.now() - t0) / (meas * 60);
const chronic = p.objs.filter(o => o.sc > 20 && o.jc / o.sc > 0.7);
if (process.env.V) for (const o of chronic) { const a = o.body.angvel(), q = o.body.rotation(); console.log('chronic', o.x.toFixed(2), o.y.toFixed(2), o.z.toFixed(2), 'tilt', (Math.acos(Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z))) * 57.3).toFixed(0), 'ang', [a.x, a.y, a.z].map(v => v.toFixed(2)).join(','), 'lin', Object.values(o.body.linvel()).map(v => v.toFixed(2)).join(','), 'rest', !!o.rest); }
console.log(`${size} iter=${p.world.integrationParameters.numSolverIterations} bodies ${p.objs.length} hits/s ${(hits / meas).toFixed(1)} mv/s ${(mv / meas / 60).toFixed(2)} restAng ${(fieldAng / field).toFixed(3)} restLin ${(fieldLin / field).toFixed(3)} jitter% ${(jit / field * 100).toFixed(2)} chronic ${chronic.length} ${ms.toFixed(2)}ms/f ${JSON.stringify(zones)}`);
