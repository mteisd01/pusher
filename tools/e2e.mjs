// End-to-end smoke test of game systems. node tools/e2e.mjs [url] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium, devices } = pw;
const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '.';
const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { if (!localStorage.getItem('pusher.save.v1')) localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, settings: { quality: 'low', lang: 'ja' } })); });
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.waitForTimeout(2000);
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const b = document.querySelector('#dYes'); if (b) b.click(); });
const c0 = await ev(() => __game.save.coins);
// hold drop for 3s
await page.mouse.move(640, 300);
await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up();
await page.waitForTimeout(4000);
let st = await ev(() => ({ coins: __game.save.coins, dropped: __game.save.stats.dropped, won: __game.save.stats.won, gate: __game.save.stats.gatePasses || 0, objs: __game.objCount }));
console.log('after hold', JSON.stringify(st), 'start coins', c0);
// slot + items + fever + walls + JP
await ev(() => { __game.save.stock = 4; __game.activateToken(0); __game.startFever(); for (let i = 0; i < 6; i++) __game.spawnRandomItem(); __game.shower(30); });
await page.waitForTimeout(5000);
await page.screenshot({ path: `${out}/e2e_fever.png` });
st = await ev(() => ({ spins: __game.save.stats.slotSpins, walls: __game.fx.walls, fever: __game.fx.fever, objs: __game.objCount }));
console.log('effects', JSON.stringify(st));
await ev(() => { __game.jpQueue++; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/e2e_jp.png` });
await page.waitForTimeout(7000);
console.log('jp lotteries', await ev(() => __game.save.stats.jpLottery));
await page.waitForFunction(() => !__game.roulette.active && __game.jpQueue === 0, null, { timeout: 120000 }).catch(() => console.log('roulette still active'));
await ev(() => { __game.settings.f_jp = false; });
// menus
for (const tab of ['shop', 'missions', 'achievements', 'gems', 'stats', 'themes', 'settings', 'data', 'help']) {
  await ev(t => __game.ui.open(t), tab);
  await page.waitForTimeout(tab === 'data' ? 800 : 250);
  await page.screenshot({ path: `${out}/menu_${tab}.png` });
  if (tab === 'data') { await page.waitForFunction(() => document.querySelector('#dCode').value.startsWith('PSH')); globalThis.code = await page.evaluate(() => document.querySelector('#dCode').value); }
}
// export/import roundtrip
const code = globalThis.code;
console.log('export code length', code.length, code.slice(0, 12));
const rt = await page.evaluate(async c => { const m = await import('/src/save.js'); const r = await m.importCode(c); return { coins: r.save.coins, board: r.board ? r.board.objs.length : 0 }; }, code);
console.log('import roundtrip', JSON.stringify(rt));
await ev(() => __game.ui.close());
// buy upgrade
await ev(() => { __game.save.coins += 5000; __game.buyUpgrade('stroke'); __game.buyUpgrade('luck'); });
console.log('upgrades', JSON.stringify(await ev(() => __game.save.upgrades)));
console.log(errors.slice(0, 30).join('\n') || 'no console errors');
await ctx.close();
// phone
const p2 = await (await browser.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
p2.on('pageerror', e => errors.push(`phone pageerror: ${e.message}`));
await p2.addInitScript(() => { if (!localStorage.getItem('pusher.save.v1')) localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, settings: { quality: 'low', lang: 'ja' } })); });
await p2.goto(url);
await p2.waitForFunction(() => window.__game, null, { timeout: 60000 });
await p2.waitForTimeout(2500);
await p2.screenshot({ path: `${out}/phone_login.png` });
await p2.evaluate(() => { const b = document.querySelector('#dYes'); if (b) b.click(); });
await p2.waitForTimeout(800);
await p2.screenshot({ path: `${out}/phone.png` });
await p2.evaluate(() => __game.ui.open('settings'));
await p2.waitForTimeout(400);
await p2.screenshot({ path: `${out}/phone_settings.png` });
const p3 = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
await p3.goto(url);
await p3.waitForFunction(() => window.__game, null, { timeout: 60000 });
await p3.waitForTimeout(1500);
await p3.screenshot({ path: `${out}/phone_portrait.png` });
console.log(errors.slice(0, 30).join('\n') || 'no errors (phone)');
await browser.close();
