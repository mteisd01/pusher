// Smoke test for v5: difficulty tiers (worker layout, falling rocks, settings note, reload on
// gutter change) and boss battles. node tools/e2e5.mjs [url] [outdir]   ONLY=diff,boss
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || '.';
const q = process.env.Q || 'low';
const size = process.env.SIZE || 'normal';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.addInitScript(([q, size]) => {
  if (!localStorage.getItem('pusher.save.v1')) localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, coins: 5000, settings: { quality: q, lang: 'ja', tableSize: size, difficulty: 'shura', f_login: false, f_hints: false, f_events: false } }));
}, [q, size]);
await p.goto(url);
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v5_${n}.png`, timeout: 120000 });
const only = (process.env.ONLY || 'diff').split(',');
const maxX = () => ev(async () => { const s = await __game.physics.snapshot(); return Math.max(...s.objs.filter(o => o[3] > -0.5).map(o => Math.abs(o[2]))); });
if (only.includes('diff')) {
  console.log('difficulty', await ev(() => __game.settings.difficulty), 'physics mode', await ev(() => __game.physics.mode), 'max |x| on table', (await maxX()).toFixed(2));
  for (let i = 0; i < 3; i++) await ev(x => __game.features.dropRock(x), -3 + i * 3);
  await p.waitForTimeout(2500); await shot('rocks');
  const rocks = await ev(async () => (await __game.physics.snapshot()).objs.filter(o => o[0] === 9).length);
  console.log('rocks on the table', rocks);
  await ev(() => __game.ui.open('settings'));
  await p.waitForTimeout(500);
  await ev(() => document.querySelector('[data-k="difficulty"]').scrollIntoView());
  await p.waitForTimeout(300); await shot('settings');
  // switching to a tier with another gutter length reloads the table
  await ev(() => { const s = document.querySelector('[data-k="difficulty"]'); s.value = 'inferno'; s.dispatchEvent(new Event('change')); });
  await p.waitForFunction(() => window.__game && __game.settings.difficulty === 'inferno', null, { timeout: 120000 });
  await p.waitForTimeout(2000);
  console.log('after reload', await ev(() => __game.settings.difficulty), 'regenCap', await ev(() => __game.regenCap()), 'badge', await ev(() => document.querySelector('#hDiff').textContent));
  await shot('inferno');
}
console.log(errs.join('\n') || 'no errors');
await b.close();
