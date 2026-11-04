// Smoke test for v3 table gimmicks. node tools/e2e3.mjs [url] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || '.';
const q = process.env.Q || 'low';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.addInitScript(q => { localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, settings: { quality: q, lang: 'ja', f_login: false, f_hints: false } })); }, q);
await p.goto(url);
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v3_${n}.png`, timeout: 120000 });
const only = (process.env.ONLY || 'tower').split(',');
if (only.includes('tower')) {
  await ev(() => { __game.jpQueue++; });
  await p.waitForFunction(() => __game.tower.active, null, { timeout: 30000 });
  await p.waitForTimeout(2600); await shot('tower_lift');
  await p.waitForTimeout(2500); await shot('tower_play');
  const t0 = Date.now();
  await p.waitForFunction(() => !__game.tower.active, null, { timeout: 120000 }).catch(() => console.log('tower still active'));
  console.log('tower result', JSON.stringify(await ev(() => __game.tower.result)), 'secs', (Date.now() - t0) / 1000 + 5);
}
if (only.includes('gimmicks')) {
  const o0 = await ev(() => __game.objCount);
  await ev(() => { __game.shower(30); });
  await p.waitForTimeout(1200); await shot('hopper');
  await p.waitForFunction(() => __game.showerQueue.length === 0, null, { timeout: 60000 }).catch(() => console.log('hopper queue stuck', 0));
  console.log('hopper poured', await ev(() => __game.objCount), 'from', o0);
  await ev(() => __game.coinTower(0));
  await p.waitForTimeout(1500); await shot('cointower');
  await ev(() => __game.tableShake(1));
  await p.waitForTimeout(400); await shot('shake');
  await ev(() => { __game.save.wheelMeter = 11; __game._onCatch({ x: 0 }); });
  await p.waitForTimeout(1500); await shot('wheel');
  await p.waitForFunction(() => !__game.wheelBusy, null, { timeout: 60000 }).catch(() => console.log('wheel stuck'));
  console.log('wheel done, meter', await ev(() => __game.save.wheelMeter), 'stats', JSON.stringify(await ev(() => ({ w: __game.save.stats.wheels, c: __game.save.stats.catches, t: __game.save.stats.towers, s: __game.save.stats.shakes }))));
  // real catches: hold drop over the moving cup for a while
  const c0 = await ev(() => __game.save.stats.catches || 0);
  await ev(() => { __game.save.coins += 200; __game.settings.autoDrop = true; __game.settings.autoMode = 'center'; });
  await p.waitForTimeout(15000);
  await ev(() => { __game.settings.autoDrop = false; });
  console.log('catches during 15s center auto-drop', (await ev(() => __game.save.stats.catches || 0)) - c0);
  for (const id of ['tower', 'quake']) { await ev(i => { __game.features.event = null; __game.features.startEvent(i); }, id); await p.waitForTimeout(2500); await shot('ev_' + id); }
}
console.log(errs.join('\n') || 'no errors');
await b.close();
