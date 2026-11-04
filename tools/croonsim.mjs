// Headless check of the physical croon: hole distribution and time to settle per stage.
// usage: node tools/croonsim.mjs [runs=200] [holes=4] [luck=0]
import RAPIER from '@dimforge/rapier3d-compat';
import { CroonPhysics, holeLayout } from '../src/core/croonPhysics.js';
await RAPIER.init();
const [runs, nh, luck] = [200, 4, 0].map((d, i) => process.argv[2 + i] !== undefined ? +process.argv[2 + i] : d);
const c = new CroonPhysics(RAPIER);
const holes = Array.from({ length: nh }, (_, i) => ({ good: i % 2 === 0 }));
const counts = new Array(nh).fill(0); const times = [];
for (let r = 0; r < runs; r++) {
  c.start(holeLayout(holes, luck), (r % 2 ? -1 : 1) * 0.8);
  let res = null, f = 0;
  while (!res && f < 60 * 90) { res = c.step(1 / 60); f++; }
  if (res) { counts[res.hole]++; times.push(f / 60); } else times.push(99);
}
times.sort((a, b) => a - b);
const good = counts.reduce((s, v, i) => s + (holes[i].good ? v : 0), 0);
console.log(`holes ${nh} luck ${luck}: dist ${counts.join('/')} good ${(good / runs * 100).toFixed(1)}% time p10 ${times[runs * 0.1 | 0].toFixed(1)}s p50 ${times[runs >> 1].toFixed(1)}s p90 ${times[runs * 0.9 | 0].toFixed(1)}s max ${times[runs - 1].toFixed(1)}`);
