// Verifies reset-all / import / backup restore survive the reload. node tools/e2e_reset.mjs [url]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/';
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.addInitScript(() => { if (!localStorage.getItem('pusher.save.v1')) localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, settings: { quality: 'low', lang: 'ja', f_login: false, f_hints: false, volumeTest: 7 } })); });
const boot = async () => { await p.waitForFunction(() => window.__game, null, { timeout: 90000 }); await p.waitForTimeout(800); };
await p.goto(url); await boot();
const ev = (f, a) => p.evaluate(f, a);
let ok = true;
const check = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name, info !== undefined ? JSON.stringify(info) : ''); if (!cond) ok = false; };
// 1) reset all (keep settings)
await ev(() => { __game.save.coins = 9999; __game.save.level = 10; __game.save.settings.master = 0.33; });
await ev(() => __game.ui.open('data')); await p.waitForTimeout(400);
await p.click('#dReset'); await p.waitForSelector('#dYes');
await Promise.all([p.waitForNavigation(), p.click('#dYes')]);
await boot();
let st = await ev(() => ({ coins: __game.save.coins, level: __game.save.level, master: __game.save.settings.master }));
check('reset all clears progress', st.coins <= 200 && st.level === 1, st);
check('reset all keeps settings', st.master === 0.33, st);
// 2) export code with 5555 coins, change, import it back
await ev(() => { __game.save.coins = 5555; });
const code = await ev(async () => { const m = await import('/src/save.js'); return m.exportCode(__game.save, null); });
await ev(() => { __game.save.coins = 42; });
await ev(c => __game.ui.o.onImport(c), code); await p.waitForSelector('#dYes');
await Promise.all([p.waitForNavigation(), p.click('#dYes')]);
await boot();
st = await ev(() => __game.save.coins);
check('import survives reload', st >= 5555 && st < 5700, st);
// 3) backup restore -> previous save (42 coins one was backed up on import)
await ev(() => __game.ui.open('data')); await p.waitForTimeout(400);
await p.click('#dBackup'); await p.waitForSelector('#dYes');
await Promise.all([p.waitForNavigation(), p.click('#dYes')]);
await boot();
st = await ev(() => __game.save.coins);
check('backup restore survives reload', st >= 42 && st < 150, st);
// 4) board reset keeps coins
await ev(() => { __game.save.coins = 777; });
await ev(() => __game.ui.o.onResetBoard()); await p.waitForTimeout(1500);
st = await ev(() => ({ coins: __game.save.coins, objs: __game.objCount }));
check('board reset keeps coins and refills table', st.coins === 777 && st.objs > 300, st);
console.log(errs.join('\n') || 'no page errors');
await b.close();
process.exit(ok && !errs.length ? 0 : 1);
