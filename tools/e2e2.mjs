// Smoke test for v2 features. node tools/e2e2.mjs [url] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || '.';
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.addInitScript(() => { if (!localStorage.getItem('pusher.save.v1')) localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, settings: { quality: 'low', lang: 'ja', f_login: false, f_hints: false } })); });
await p.goto(url);
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v2_${n}.png` });
// pause
await ev(() => __game.ui.togglePause(true));
const c1 = await ev(() => [__game.time, __game.objCount]);
await p.waitForTimeout(1500);
const c2 = await ev(() => [__game.time, __game.objCount]);
await shot('pause');
console.log('pause time frozen:', c1[0] === c2[0]);
await ev(() => __game.ui.togglePause(false));
// dice / road
await ev(() => { __game.features.addDice(1); });
await p.waitForTimeout(1200); await shot('road');
await p.waitForFunction(() => !__game.features.busy, null, { timeout: 60000 });
console.log('road pos', await ev(() => __game.save.roadPos));
// croon
await ev(() => { __game.jpQueue++; });
await p.waitForTimeout(2500); await shot('croon');
await p.waitForFunction(() => !__game.features.busy && __game.jpQueue === 0, null, { timeout: 120000 });
console.log('croon best', await ev(() => __game.save.stats.croonBest));
// plinko
await ev(() => __game.features.enqueue(() => __game.features.plinko()));
await p.waitForTimeout(1500); await shot('plinko');
await p.mouse.click(640, 200);
await p.waitForFunction(() => !__game.features.busy, null, { timeout: 60000 });
// events + items
await ev(() => { __game.features.startEvent('giant'); __game.activateToken(9); __game.activateToken(8); __game.features.pocketT = 0; });
await p.waitForTimeout(4000); await shot('event');
await ev(() => __game.features.startEvent('challenge'));
await p.waitForTimeout(1000);
await ev(() => __game.ui.open('road')); await p.waitForTimeout(400); await shot('roadtab'); await ev(() => __game.ui.close());
console.log('stats', JSON.stringify(await ev(() => __game.save.stats)));
console.log(errs.join('\n') || 'no errors');
await b.close();
