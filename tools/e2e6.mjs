// E2E for the v6 fixes: boss attack warning + breakable jam beam, off-centre drops (hopper /
// coaster field rail), coaster routes SUPER / PREMIUM, crane prize chute, time stop + held chances,
// context menu, the lucky road strip, explanation banners and the guide tab.
// node tools/e2e6.mjs [url] [outdir]   ONLY=boss,drops,crane,time,ui
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', m => { if (m.type() === 'error' && !/vibrate/.test(m.text())) errs.push('console: ' + m.text()); });
await p.addInitScript(() => { localStorage.setItem('pusher.save.v1', JSON.stringify({ v: 1, coins: 5000, settings: { quality: 'low', lang: 'ja', f_login: false, f_hints: true, f_events: false } })); });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'mute=1');
await p.waitForFunction(() => window.__game, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const ev = (f, a) => p.evaluate(f, a);
const shot = n => p.screenshot({ path: `${out}/v6_${n}.png`, timeout: 120000 });
const only = (process.env.ONLY || 'boss,drops,crane,time,ui').split(',');
const ok = (name, cond, info = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${info}`);

if (only.includes('boss')) {
  await ev(() => { const g = __game; g.boss.st.gauge = g.boss.need() - 1; g.boss.addGauge(5); });
  await p.waitForTimeout(4500);
  await ev(() => { const g = __game, a = g.boss.active; g.boss.cd.jam = 0; a.atkT = 0.05; a.attacks = ['jam']; });
  await p.waitForTimeout(700);
  const w = await ev(() => ({ warn: __game.boss.warn && __game.boss.warn.kind, jam: __game.boss.jam, sub: document.querySelector('.banner-sub').textContent }));
  ok('boss warns before the jam', w.warn === 'jam' && w.jam === 0, JSON.stringify(w));
  await shot('boss_warn');
  await p.waitForTimeout(2200);
  const j = await ev(() => ({ jam: __game.boss.jam, beam: __game.boss.beamHp, card: !document.querySelector('.infocard').classList.contains('hidden') }));
  ok('jam starts with a beam', j.jam > 0 && j.beam > 0, JSON.stringify(j));
  await shot('boss_jam');
  // aim at the gate until the beam breaks
  const r = await ev(async () => {
    const g = __game, log = [];
    for (let i = 0; i < 60 && g.boss.jam > 0; i++) { g.setAim(g.gateXAt(g.time + 0.18)); g.launcherX = g.aimX; g.drop(); await new Promise(r => setTimeout(r, 190)); log.push(g.boss.beamHp); }
    return { jam: g.boss.jam, stun: g.boss.stun, weak: g.boss.active && g.boss.active.weak, log: log.join(',') };
  });
  ok('beam breaks -> stun + weak point', r.jam === 0 && r.stun > 0 && r.weak > 0, JSON.stringify(r));
  await shot('boss_break');
  // no jam right after a jam
  const rep = await ev(async () => { const g = __game, a = g.boss.active; a.attacks = ['jam']; a.atkT = 0.05; await new Promise(r => setTimeout(r, 400)); return g.boss.warn && g.boss.warn.kind; });
  ok('jam is not repeated back to back', rep !== 'jam', `next=${rep}`);
  await ev(() => __game.boss.abort());
}

if (only.includes('drops')) {
  // hopper: big medals go to an off-centre point
  const xs = await ev(async () => {
    const g = __game, hop = g.machines.hopper, out = [];
    const orig = g.physics.cmd.bind(g.physics);
    g.physics.cmd = (...c) => { if (c[0] === 'spawn' && c[1] === 3) out.push(+c[2].toFixed(2)); return orig(...c); };
    g.shower(4, 3);
    for (let i = 0; i < 80 && out.length < 4; i++) await new Promise(r => setTimeout(r, 250));
    g.physics.cmd = orig;
    return out;
  });
  const W = 11;   // wide table (default)
  ok('big medals drop off-centre', xs.length === 4 && xs.every(x => Math.abs(x) >= 0.13 * W && Math.abs(x) <= 0.47 * W), `xs=${xs} W=${W}`);
  // coaster field route: the ball drops through the trap door at its dropX
  const c = await ev(async () => {
    const g = __game, out = [];
    const orig = g.physics.cmd.bind(g.physics);
    g.physics.cmd = (...c) => { if (c[0] === 'spawn' && c[1] === 4) out.push(+c[2].toFixed(2)); return orig(...c); };
    g.pickBallRoute = () => 'field'; g.launchBall();
    const dropX = g.machines.coaster.queue.length ? g.machines.coaster.queue[0].dropX : g.machines.coaster.run && g.machines.coaster.run.dropX;
    for (let i = 0; i < 80 && !out.length; i++) await new Promise(r => setTimeout(r, 250));
    g.physics.cmd = orig;
    return { dropX, spawned: out[0] };
  });
  ok('field JP ball drops at its trap door', c.spawned !== undefined && Math.abs(c.spawned - c.dropX) < 0.6, JSON.stringify(c));
  await shot('ball_drop');
  for (const route of ['super', 'premium']) {
    const r = await ev(async route => {
      const g = __game, before = g.jpQueue + g.features.queue.length + (g.tower.active ? 1 : 0);
      g.pickBallRoute = () => route; g.launchBall();
      for (let i = 0; i < 80 && g.jpQueue + g.features.queue.length + (g.tower.active ? 1 : 0) === before; i++) await new Promise(r => setTimeout(r, 250));
      return { starts: (g.jpStarts || []).slice(), q: g.jpQueue, tower: g.tower.active, start: g.tower.startStage };
    }, route);
    ok(`coaster ${route} goes to the croon`, r.q > 0 || r.tower, JSON.stringify(r));
    await p.waitForTimeout(3000);
    await shot('route_' + route);
    await ev(async () => { for (let i = 0; i < 160 && (__game.tower.active || __game.jpQueue || __game.features.busy); i++) await new Promise(r => setTimeout(r, 250)); });
  }
}

if (only.includes('crane')) {
  const r = await ev(async () => {
    const g = __game, coins0 = g.save.coins; let prize = 0;
    const credit = g.credit.bind(g); g.credit = (n, s) => { if (s === 'crane') prize += n; credit(n, s); };
    const n0 = g.objCount;
    g.startCrane();
    await new Promise(r => setTimeout(r, 1500));
    const spawned = g.objCount - n0;
    g.press(0);
    for (let i = 0; i < 120 && g.devMode; i++) await new Promise(r => setTimeout(r, 250));
    g.credit = credit;
    return { spawned, prize, done: !g.devMode };
  });
  ok('crane places prizes and finishes', r.spawned >= 1 && r.done, JSON.stringify(r));
  await shot('crane');
}

if (only.includes('time')) {
  const r = await ev(async () => {
    const g = __game;
    g.startFever();
    const f0 = g.fx.fever;
    g.startCrane();
    await new Promise(r => setTimeout(r, 1500));
    const held = g.features.held(), busy = g.features.busy;
    const chip = document.getElementById('hFx').innerText;
    g.fx.fever = 0.01;   // fever ends -> the crane starts, and the clock stops while it runs
    await new Promise(r => setTimeout(r, 1500));
    const dev = g.devMode;
    g.fx.turbo = 10; const t0 = g.fx.turbo;
    await new Promise(r => setTimeout(r, 1000));
    const t1 = g.fx.turbo;
    g.press(0);
    for (let i = 0; i < 120 && g.devMode; i++) await new Promise(r => setTimeout(r, 250));
    return { f0, held, busy, chip, dev, t0, t1 };
  });
  ok('crane waits during fever', r.held.includes('crane') && !r.busy && /保留/.test(r.chip), JSON.stringify({ held: r.held, busy: r.busy }));
  ok('timers stop while the crane runs', r.dev === 'crane' && Math.abs(r.t1 - r.t0) < 0.05, JSON.stringify({ dev: r.dev, t0: r.t0, t1: r.t1 }));
}

if (only.includes('ui')) {
  const cm = await ev(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('.hud').dispatchEvent(e); return e.defaultPrevented; });
  ok('context menu blocked on the HUD', cm);
  const cm2 = await ev(() => { const r = document.querySelector('.roulette') || document.body; const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); r.dispatchEvent(e); return e.defaultPrevented; });
  ok('context menu blocked on the roulette', cm2);
  await ev(() => { __game.save.dice = 1; });
  await p.waitForTimeout(1200);
  const box = await ev(() => { const r = document.querySelector('.overlay2d.strip'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth }; });
  ok('lucky road strip at the left edge', box && box.x < 20 && box.w < box.vw * 0.12, JSON.stringify(box));
  await shot('road_strip');
  await p.waitForTimeout(4000);
  await ev(() => __game.activateToken(2));
  await p.waitForTimeout(300);
  const sub = await ev(() => document.querySelector('.banner-sub').textContent);
  ok('item banner explains the effect', /プッシャー/.test(sub), sub);
  await shot('banner_sub');
  await ev(() => __game.ui.open('guide'));
  await p.waitForTimeout(500);
  const n = await ev(() => document.querySelectorAll('.guide .gi').length);
  ok('guide tab lists the effects', n > 50, `n=${n}`);
  await shot('guide');
  await ev(() => __game.ui.close());
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();
