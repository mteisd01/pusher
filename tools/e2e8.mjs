// E2E for the v6 long-term goals: JP tiers + pity, mastery, capsule gacha, rebirth.
// node tools/e2e8.mjs [url] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error' && !/vibrate/.test(m.text())) errs.push('console: ' + m.text()); });
await p.addInitScript(() => { localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, coins: 200000, settings: { quality: 'low', lang: 'ja', f_login: false, f_hints: false, f_events: false, f_boss: false } })); });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'mute=1');
await p.waitForFunction(() => window.__game, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v6c_${n}.png`, timeout: 120000 });
const ok = (name, cond, info = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${info}`);

const jp = await ev(async () => {
  const g = __game, pools0 = g.jpPools(), c0 = g.save.coins;
  await g.payJackpot('grand');
  return { grand0: pools0.grand, grand1: g.jpPools().grand, wins: g.save.stats.jp_grand, queued: g.showerQueue.length };
});
ok('GRAND jackpot pays the pool and resets it', jp.wins === 1 && jp.grand1 <= jp.grand0 && jp.queued > 0, JSON.stringify(jp));
await shot('jp_grand');
const pity = await ev(async () => {
  const g = __game; g.save.jpMiss = 25;
  let started = null; const run = g.tower.run.bind(g.tower);
  g.tower.run = (st, luck, ph, o) => { started = o.startStage; g.tower.run = run; return Promise.resolve({ stage: 2, hole: st[2].holes[1] }); };
  await g.features.croon(0);
  return { started, miss: g.save.jpMiss };
});
ok('JP pity starts at the final stage', pity.started === 2, JSON.stringify(pity));

const m = await ev(() => { const g = __game, E = g.end, b0 = E.bonus('payout'); const okb = E.buyMastery('payout'); return { okb, b0, b1: E.bonus('payout'), lv: E.masteryLv('payout') }; });
ok('mastery level raises the payout bonus', m.okb && m.b1 > m.b0, JSON.stringify(m));
const gc = await ev(() => { const g = __game, E = g.end, c0 = g.save.coins; const r = E.pull(10); return { n: r && r.length, rmax: r && Math.max(...r.map(o => o.charm.r)), spent: c0 - g.save.coins, owned: Object.keys(E.st.charms).length }; });
ok('10-pull gives 10 charms with at least an R', gc.n === 10 && gc.rmax >= 1 && gc.owned > 0, JSON.stringify(gc));
await ev(() => __game.ui.open('endgame'));
await p.waitForTimeout(600);
await shot('endgame_tab');
await ev(() => { const s = __game.save; s.stats.won = (s.stats.won || 0) + 100000; });
const rb = await ev(() => { const g = __game, E = g.end; const can = E.canRebirth(), stars = E.starsFor(); const got = E.rebirth(); return { can, stars, got, coins: g.save.coins, upg: Object.keys(g.save.upgrades).length, mastery: E.masteryLv('payout'), charms: Object.keys(E.st.charms).length, starPts: E.st.starPts }; });
ok('rebirth resets the run and keeps charms', rb.can && rb.got > 0 && rb.upg === 0 && rb.mastery === 0 && rb.charms > 0 && rb.starPts === rb.got, JSON.stringify(rb));
const sp = await ev(() => { const E = __game.end; const okb = E.buyStar('sPayout'); return { okb, bonus: E.bonus('payout') }; });
ok('star perk adds a permanent bonus', sp.okb && sp.bonus > 0, JSON.stringify(sp));
await ev(() => __game.ui.renderTab(true));
await p.waitForTimeout(400);
await shot('endgame_after');
await ev(() => __game.ui.close());
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
