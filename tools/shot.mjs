// Visual smoke test: node tools/shot.mjs [url] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium, devices } = pw;
const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function run(name, ctxOpts, actions) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const q = process.env.Q;
  if (q) await page.addInitScript(q => { try { const s = JSON.parse(localStorage.getItem('pusher.save.v1') || 'null') || { v: 1, settings: {} }; s.v = 1; s.settings = { ...(s.settings || {}), quality: q }; localStorage.setItem('pusher.save.v1', JSON.stringify(s)); } catch (e) {} }, q);
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = document.querySelector('#dYes'); if (b) b.click(); });
  await page.waitForTimeout(300);
  if (actions) await actions(page);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
  const info = await page.evaluate(() => ({ coins: __game.save.coins, objs: __game.objCount, phys: __game.physMs, mode: __game.physics.mode }));
  console.log(name, JSON.stringify(info));
  await ctx.close();
}
const mode = process.argv[4] || 'all';
if (mode === 'all' || mode === 'pc') await run('pc', { viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) }, deviceScaleFactor: 1 }, async p => {
  await p.mouse.move(700, 300);
  for (let i = 0; i < 20; i++) { await p.mouse.click(500 + i * 30, 300); await p.waitForTimeout(80); }
  await p.waitForTimeout(3000);
});
if (mode === 'all' || mode === 'phone') await run('phone', { ...devices['iPhone 13 landscape'] }, async p => { await p.waitForTimeout(1500); });
if (mode === 'close') await run('close', { viewport: { width: 1280, height: 720 } }, async p => { await p.evaluate(() => { const st = __game.stage; st.settings.camera = 'field'; st.userZoom = 3; st.fitCamera(); }); await p.waitForTimeout(1500); });
if (mode === 'menu') await run('menu', { viewport: { width: 1280, height: 720 } }, async p => { await p.evaluate(() => __game.ui.open(window.__tab || 'shop')); await p.waitForTimeout(500); });
console.log(errors.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
