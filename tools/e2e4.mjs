// Smoke test for v4 physical devices. node tools/e2e4.mjs [url] [outdir]   ONLY=coaster,crane,plinko,field
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
await p.addInitScript(q => { localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, settings: { quality: q, lang: 'ja', f_login: false, f_hints: false, f_events: false } })); }, q);
await p.goto(url);
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v4_${n}.png`, timeout: 120000 });
const only = (process.env.ONLY || 'coaster,crane,plinko,field').split(',');
if (only.includes('coaster')) {
  for (const route of ['field', 'chance', 'jp']) {
    const n0 = await ev(() => __game.objCount), j0 = await ev(() => __game.jpQueue + (__game.features.queue.length) + (__game.tower.active ? 1 : 0));
    await ev(r => { __game.pickBallRoute = () => r; __game.launchBall(); }, route);
    await p.waitForTimeout(route === 'field' ? 2500 : 1500); if (route === 'field') await shot('coaster_run');
    await p.waitForFunction(() => !__game.machines.coaster.busy, null, { timeout: 60000 }).catch(() => console.log('coaster stuck'));
    await p.waitForTimeout(500);
    if (route !== 'jp') await shot('coaster_' + route);
    console.log('coaster', route, 'objCount', n0, '->', await ev(() => __game.objCount), 'jp', j0, '->', await ev(() => __game.jpQueue + __game.features.queue.length + (__game.tower.active ? 1 : 0)));
    if (route === 'jp') { await p.waitForFunction(() => !__game.tower.active && __game.jpQueue === 0 && !__game.features.busy, null, { timeout: 150000 }).catch(() => console.log('tower did not finish')); }
  }
}
if (only.includes('crane')) {
  await ev(() => __game.startCrane());
  await p.waitForFunction(() => __game.devMode === 'crane', null, { timeout: 20000 });
  await ev(() => __game.setAim(-3));
  await p.waitForTimeout(2500); await shot('crane_aim');
  await ev(() => __game.press());
  await p.waitForTimeout(2200); await shot('crane_grab');
  await p.waitForFunction(() => __game.devMode === null, null, { timeout: 300000 }).catch(() => console.log("crane stuck"));
  console.log('crane stats', JSON.stringify(await ev(() => ({ c: __game.save.stats.cranes, g: __game.save.stats.craneGrabs }))));
}
if (only.includes('plinko')) {
  const ok = await ev(() => { __game.features.enqueue(() => __game.features.plinko()); return true; });
  await p.waitForFunction(() => __game.devMode === 'plinko', null, { timeout: 20000 });
  await p.waitForTimeout(2200); await shot('plinko_aim');
  await ev(() => { __game.setAim(4); __game.press(); });
  await p.waitForTimeout(1500); await shot('plinko_fall');
  await p.waitForFunction(() => __game.devMode === null, null, { timeout: 300000 }).catch(() => console.log("plinko stuck"));
  console.log('plinko result', await ev(() => __game.plinko3d.result));
}
if (only.includes('field')) {
  await ev(() => { __game.activateToken(12); __game.startFever(); });
  await p.waitForTimeout(1800); await shot('field_devices');
  console.log('flipper fx', await ev(() => __game.fx.flipper.toFixed(1)), 'tt', await ev(() => __game.ttSent));
  await ev(() => { __game.save.wheelMeter = 9; for (let i = 0; i < 2; i++) __game._onCatch({ x: 3 }); });
  await p.waitForTimeout(700); await shot('meter_tube');
}
console.log(errs.join('\n') || 'no errors');
await b.close();
