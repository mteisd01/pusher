// E2E for the v6 drop-only extras: stock colours (pre-rolled stock), RUSH chain spins and the
// number checker + bingo card. node tools/e2e7.mjs [url] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error' && !/vibrate/.test(m.text())) errs.push('console: ' + m.text()); });
await p.addInitScript(() => { localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, coins: 5000, settings: { quality: 'low', lang: 'ja', f_login: false, f_hints: true, f_events: false, f_boss: false } })); });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'mute=1');
await p.waitForFunction(() => window.__game, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v6b_${n}.png`, timeout: 120000 });
const ok = (name, cond, info = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${info}`);

// stock colours: 200 pre-rolls, rainbow only on big wins
const sc = await ev(() => {
  const s = __game.slot, cnt = [0, 0, 0, 0];
  for (let i = 0; i < 3000; i++) cnt[s.preRoll().c]++;
  return cnt;
});
ok('stock colours are mostly white, rainbow rare', sc[0] > sc[1] && sc[3] < sc[0] * 0.05 && sc[3] > 0, JSON.stringify(sc));
await ev(() => { __game.save.stock = 4; });
await p.waitForTimeout(800);
await shot('stock');

// RUSH: start one and force a 777 inside
const r = await ev(async () => {
  const g = __game; g.save.stock = 0;
  g.startRush('test');
  const left0 = g.rush && g.rush.left;
  const orig = g.slot.rushRoll.bind(g.slot); let forced = false;
  g.slot.rushRoll = () => { if (!forced) { forced = true; return { sym: 0, kind: 'fever', shower: 12 }; } return orig(); };
  for (let i = 0; i < 200 && g.rush && g.rush.chain < 2; i++) await new Promise(r => setTimeout(r, 100));
  const chain = g.rush && g.rush.chain;
  g.slot.rushRoll = () => null; for (let i = 0; i < 1500 && g.rush; i++) await new Promise(r => setTimeout(r, 100));
  g.slot.rushRoll = orig;
  return { left0, chain, ended: !g.rush, best: g.save.stats.rushChain };
});
ok('RUSH chains on 777 and ends', r.left0 === 6 && r.chain >= 2 && r.ended, JSON.stringify(r));

// bingo: open a plate and drop a medal right on it
const bg = await ev(async () => {
  const g = __game, bi = g.bingo;
  const marks0 = bi.st.marks;
  bi.t = 0; bi.phase = 'idle';
  for (let i = 0; i < 40 && bi.phase !== 'open'; i++) await new Promise(r => setTimeout(r, 100));
  const n = bi.lit[0];
  g.setAim(bi.plateX(n)); g.launcherX = g.aimX; g.drop();
  for (let i = 0; i < 30 && bi.st.marks === marks0; i++) await new Promise(r => setTimeout(r, 100));
  return { n, phase: bi.phase, marked: bi.marked(n), marks: bi.st.marks.toString(2) };
});
ok('a medal under the open plate marks the number', bg.marked, JSON.stringify(bg));
await shot('bingo_mark');
const line = await ev(async () => {
  const g = __game, bi = g.bingo, st = bi.st, c0 = g.save.coins;
  // mark the first row except one, then mark the last via the plate
  st.marks = 0; const lines = st.lines || 0;
  bi.mark(st.card[0], 0); bi.mark(st.card[1], 0); bi.mark(st.card[2], 0);
  return { lines0: lines, lines1: st.lines };
});
ok('a full row pays a line', line.lines1 > line.lines0, JSON.stringify(line));
const full = await ev(async () => {
  const g = __game, bi = g.bingo, st = bi.st, cards = st.cards || 0;
  for (const n of st.card.slice()) bi.mark(n, 0);
  await new Promise(r => setTimeout(r, 3000));
  return { cards0: cards, cards1: st.cards, marks: st.marks, jp: g.jpQueue + (g.tower.active ? 1 : 0) + g.features.queue.length };
});
ok('full card = BINGO, new card, JP lottery', full.cards1 === full.cards0 + 1 && full.marks === 0 && full.jp > 0, JSON.stringify(full));
await shot('bingo_full');
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
