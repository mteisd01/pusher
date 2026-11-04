import './ui/style.css';
import { Stage, CAMERA_PRESETS, SCREEN } from './render/scene.js';
import { CroonTower } from './render/tower.js';
import { MechReels, Hopper, LuckyWheel, CatcherCup, Beacons } from './render/machines.js';
import { BallCoaster } from './render/coaster.js';
import { CraneRig } from './render/crane.js';
import { FieldDevices } from './render/fieldDevices.js';
import { Plinko3D } from './render/plinko3d.js';
import { WHEEL, WHEEL_NEED, PLINKO, diffDef } from './game/balance.js';
import { CUP, PACK_HEAD } from './core/layout.js';
import { TRAY, POLE_X } from './render/cabinet.js';
import { CoinRenderer } from './render/coins.js';
import { Backboard } from './render/backboard.js';
import { Effects } from './render/effects.js';
import { AudioSys } from './audio/audio.js';
import { PhysicsClient } from './core/physicsClient.js';
import { L, configureLayout } from './core/layout.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { Roulette } from './ui/roulette.js';
import { MiniGames } from './ui/minigames.js';
import { themeById } from './render/themes.js';
import { setLang, t } from './i18n.js';
import { loadSave, storeSave, loadBoard, storeBoard, clearBoard, exportCode, importCode, backup, wipeAll, newSave, QUALITY_PRESETS, detectQuality, decodeBoard } from './save.js';
import * as THREE from 'three';

const BAKED = import.meta.glob('./data/board_*.txt', { query: '?raw', import: 'default', eager: true });

const loading = document.getElementById('loading');
const loadMsg = document.getElementById('loadMsg');
const setLoad = (msg, p) => { if (loadMsg) loadMsg.textContent = msg; if (p !== undefined) document.getElementById('loadBar').style.width = `${p * 100}%`; };

async function boot() {
  let save = loadSave();
  const s = save.settings;
  if (!s.tableSize) s.tableSize = 'wide';
  setLang(s.lang);
  setLoad(t('loading'), 0.1);
  // resolve quality preset
  const q = s.quality === 'auto' ? detectQuality() : s.quality;
  if (QUALITY_PRESETS[q] && (s.quality === 'auto' || !save._qualityApplied)) Object.assign(s, QUALITY_PRESETS[q]);
  save._qualityApplied = true;
  // the difficulty changes the side-gutter length
  const gutter = diffDef(s.difficulty).gutter || 0;
  configureLayout(s.tableSize, gutter);

  // share-link import: #save=CODE
  let pendingImport = null;
  const m = location.hash.match(/save=([^&]+)/);
  if (m) { pendingImport = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname + location.search); }

  const canvas = document.getElementById('c');
  const stage = new Stage(canvas, s);
  const theme = themeById(s.theme);
  stage.setTheme(theme);
  setLoad(t('loading'), 0.25);
  await nextFrame();
  const coins = new CoinRenderer(stage.scene, s.coinDetail);
  coins.trayDef = { y: TRAY.y, z0: L.frontZ + TRAY.z0, z1: L.frontZ + TRAY.z1, hw: L.halfW };
  coins.onTrayEmptied = () => audio.payout(10, 0, true);
  const backboard = new Backboard();
  stage.addScreen(backboard.texture);
  const effects = new Effects(stage.scene);
  effects.amount = s.particles;
  const audio = new AudioSys();
  audio.setVolume({ master: s.master, bgm: s.bgm, se: s.se });
  audio.setStyle(theme.bgm);
  setLoad(t('loading'), 0.5);
  await nextFrame();

  const physics = new PhysicsClient();
  const boardKey = s.tableSize;
  let board = loadBoardFor(boardKey);
  await physics.init({ layout: { size: s.tableSize, gutter }, worker: s.worker, hz: s.physHz, iterations: 2, stroke: (save.upgrades.stroke || 0) * 0.3, snapshot: board, prefill: s.prefill });
  setLoad(t('loading'), 0.9);

  const uiRoot = document.getElementById('ui');
  let game;
  let unloading = false;
  const ui = new UI(uiRoot, {
    onSettings: key => applySetting(key),
    onExport: async withBoard => exportCode(save, withBoard ? await physics.snapshot() : null),
    onImport: code => doImport(code),
    onResetBoard: () => {
      clearBoard(s.tableSize);
      const baked = BAKED[`./data/board_${s.tableSize}.txt`];
      let snap = null;
      if (baked) { try { snap = decodeBoard(baked.trim()); } catch (e) { snap = null; } }
      physics.cmd('clear');
      if (snap) physics.cmd('restore', snap); else physics.cmd('prefill', s.prefill);
      ui.close();
    },
    onResetAll: keepSettings => { unloading = true; wipeAll(keepSettings ? save.settings : null); location.reload(); },
    onRestoreBackup: b => { replaceSave(b.save, b.board); },
    onCycleCamera: () => { const keys = Object.keys(CAMERA_PRESETS); s.camera = keys[(keys.indexOf(s.camera) + 1) % keys.length]; stage.userZoom = 0; stage.fitCamera(); },
    onFullscreen: () => toggleFullscreen(),
    onToggleMute: () => { muted = !muted; audio.setMuted(muted); document.getElementById('bMute').innerHTML = muted ? MUTE_SVG : SOUND_SVG; },
  });
  const roulette = new Roulette(uiRoot, audio);
  const mini = new MiniGames(uiRoot, audio, () => s);
  const tower = new CroonTower(stage.scene, stage, audio, SCREEN);
  game = new Game({ stage, coins, backboard, effects, audio, physics, ui, save, roulette, mini, tower });
  ui.bind(game);
  const W0 = L.halfW;
  const machines = {
    reels: new MechReels(stage.scene, SCREEN, game.slot.reels.map(r => r.strip)),
    hopper: new Hopper(stage.scene, W0),
    wheel: new LuckyWheel(stage.scene, SCREEN, WHEEL),
    cup: new CatcherCup(stage.scene),
    beacons: new Beacons(stage.scene, [[-POLE_X(W0), 12.0, L.backWallZ - 1.5], [POLE_X(W0), 12.0, L.backWallZ - 1.5]]),
    coaster: new BallCoaster(stage.scene, audio, W0),
    crane: new CraneRig(stage.scene, W0),
  };
  machines.field = new FieldDevices(stage.scene, W0, machines.wheel.group.position);
  game.plinko3d = new Plinko3D(stage.scene, stage, audio, SCREEN, PLINKO);
  game.machines = machines;
  mini.isPaused = () => game.paused;
  physics.onFrame = msg => game.onPhysicsFrame(msg);
  let muted = false;
  const SOUND_SVG = document.getElementById('bMute').innerHTML;
  const MUTE_SVG = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  stage.applyQuality(s);
  coins.setReflection(s.coinReflect);
  coins.setShadows(!!s.shadows, s.coinDetail === 'high' || s.coinDetail === 'ultra');
  ui.checkOrientation();

  function loadBoardFor(key) {
    const own = loadBoard(key);
    if (own) return own;
    const baked = BAKED[`./data/board_${key}.txt`];
    if (baked) { try { return decodeBoard(baked.trim()); } catch (e) { /* ignore */ } }
    return null;
  }

  const PRESET_KEYS = new Set(Object.keys(QUALITY_PRESETS.high));
  function applySetting(key) {
    const st = s;
    if (PRESET_KEYS.has(key) && st.quality !== 'custom') st.quality = 'custom';
    switch (key) {
      case 'quality':
        if (st.quality === 'custom') break;
        Object.assign(st, QUALITY_PRESETS[st.quality === 'auto' ? detectQuality() : st.quality]);
        coins.build(st.coinDetail); coins.setReflection(st.coinReflect);
        coins.setShadows(!!st.shadows, st.coinDetail === 'high' || st.coinDetail === 'ultra');
        stage.setTheme(themeById(st.theme));
        stage.applyQuality(st); effects.amount = st.particles;
        physics.cmd('hz', st.physHz);
        break;
      case 'coinReflect': coins.setReflection(st.coinReflect); break;
      case 'pauseOnMenu': game.setPause('menu', !!st.pauseOnMenu && ui.isOpen()); break;
      case 'ambience': audio.setVolume({ ambience: st.ambience }); break;
      case 'coinDetail': coins.build(st.coinDetail); coins.setReflection(st.coinReflect); coins.setShadows(!!st.shadows, st.coinDetail === 'high' || st.coinDetail === 'ultra'); break;
      case 'roomDetail': stage.setTheme(themeById(st.theme)); stage.applyQuality(st); break;
      case 'post': case 'resScale': case 'shadows': case 'shadowRes': case 'bloom': case 'reflections': case 'fov': case 'camera':
        stage.applyQuality(st); coins.setShadows(!!st.shadows, st.coinDetail === 'high' || st.coinDetail === 'ultra'); break;
      case 'particles': effects.amount = st.particles; break;
      case 'physHz': physics.cmd('hz', st.physHz); break;
      case 'master': case 'bgm': case 'se': audio.setVolume({ master: st.master, bgm: st.bgm, se: st.se }); break;
      case 'theme': { const th = themeById(st.theme); stage.setTheme(th); audio.setStyle(th.bgm); break; }
      case 'leftHand': case 'highContrast': case 'reduceMotion': case 'uiScale': case 'dropButton': case 'showFps': ui.applyLayout(); break;
      case 'f_missions': game.prog.ensureMissions(); break;
      case 'tableSize': persist(); unloading = true; location.reload(); return;
      case 'difficulty': if ((diffDef(st.difficulty).gutter || 0) !== gutter) { persist(); unloading = true; location.reload(); return; } break;
      case 'antialias': case 'worker': break;
    }
    persist();
  }

  async function doImport(code) {
    try {
      const r = await importCode(code);
      ui.confirm(t('importConfirm'), () => replaceSave(r.save, r.board));
    } catch (e) { ui.toast('⚠', t('importBad')); }
  }
  async function replaceSave(newS, newBoard) {
    backup(save);
    unloading = true;
    storeSave(newS);
    const size = newS.settings.tableSize || 'wide';
    if (newBoard) storeBoard(newBoard, size); else clearBoard(size);
    ui.toast('✔', t('importOk'));
    setTimeout(() => location.reload(), 400);
  }

  // ---------- persistence ----------
  // `unloading` blocks every write once a reset/import has replaced the stored data,
  // otherwise pagehide/visibilitychange would write the old in-memory save back.
  let lastSave = 0, lastBoard = 0;
  function persist() { if (unloading) return; storeSave(save); lastSave = performance.now(); }
  async function persistBoard() { if (unloading) return; const snap = await physics.snapshot(); if (!unloading) storeBoard(snap, s.tableSize); lastBoard = performance.now(); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { persist(); persistBoard(); if (s.muteHidden) audio.setMuted(true); game.setPause('hidden', true); }
    else { audio.setMuted(muted); game.setPause('hidden', false); last = performance.now(); }
  });
  window.addEventListener('pagehide', () => persist());

  // ---------- input ----------
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -L.dropZ);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  function aimFromScreen(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    if (ray.ray.intersectPlane(plane, hit)) return hit.x;
    return game.aimX;
  }
  const pointers = new Map();
  let pinch0 = 0, zoom0 = 0;
  canvas.addEventListener('pointerdown', e => {
    audio.unlock();
    if (roulette.active || mini.active || ui.isOpen() || tower.active) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      game.release();
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = stage.userZoom;
      return;
    }
    game.press(aimFromScreen(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      stage.userZoom = Math.max(-2, Math.min(4, zoom0 + Math.log(d / pinch0) / Math.log(1 / 0.85) * 0.6));
      stage.fitCamera();
      return;
    }
    if (e.pointerType === 'mouse' || pointers.has(e.pointerId)) game.setAim(aimFromScreen(e.clientX, e.clientY));
  });
  const up = e => { pointers.delete(e.pointerId); if (pointers.size === 0) game.release(); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); stage.userZoom = Math.max(-2, Math.min(4, stage.userZoom - Math.sign(e.deltaY) * 0.25)); stage.fitCamera(); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const keys = {};
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    audio.unlock();
    if (e.code === 'Escape') { if (game.pauseReasons.has('user') && !ui.isOpen()) { ui.togglePause(false); return; } ui.isOpen() ? ui.close() : ui.open('shop'); return; }
    if (e.code === 'KeyP' && !ui.isOpen()) { ui.togglePause(); return; }
    if (e.code === 'F3') { e.preventDefault(); s.showFps = !s.showFps; ui.applyLayout(); return; }
    if (ui.isOpen() || roulette.active || mini.active || tower.active) return;
    if ((e.code === 'Space' || e.code === 'Enter') && !keys[e.code]) { keys[e.code] = true; game.press(); e.preventDefault(); }
    if (e.code === 'ArrowLeft' || e.code === 'KeyQ') { keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyE') { keys.right = true; e.preventDefault(); }
    if (e.code === 'KeyA') { s.autoDrop = !s.autoDrop; applySetting('autoDrop'); }
    if (e.code === 'KeyC') ui.o.onCycleCamera();
    if (e.code === 'KeyM') ui.o.onToggleMute();
    if (e.code === 'KeyF') toggleFullscreen();
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'Enter') { keys[e.code] = false; game.release(); }
    if (e.code === 'ArrowLeft' || e.code === 'KeyQ') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyE') keys.right = false;
  });
  window.addEventListener('blur', () => { game.release(); keys.left = keys.right = false; });

  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const el = d.documentElement;
      const p = (el.requestFullscreen || el.webkitRequestFullscreen || (() => Promise.reject())).call(el, { navigationUI: 'hide' });
      Promise.resolve(p).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    } else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  }

  const onResize = () => { stage.resize(); effects.setScale(window.innerHeight * stage.renderer.getPixelRatio()); ui.checkOrientation(); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 300));
  onResize();

  game.start();
  setLoad(t('loading'), 1);
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 800);
  if (pendingImport) setTimeout(() => doImport(pendingImport), 1200);

  // ---------- main loop ----------
  let last = performance.now(), fps = 60, frameAcc = 0, cupSent = null, cupX = 0;
  const dev = new Float32Array(10);
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    if (s.maxFps > 0) {
      frameAcc += dt; last = now;
      if (frameAcc < 1 / s.maxFps - 0.002) return;
      dt = frameAcc; frameAcc = 0;
    } else last = now;
    dt = Math.min(dt, 0.1);
    fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    const paused = game.paused;
    if (keys.left) game.setAim(game.aimX - dt * 12);
    if (keys.right) game.setAim(game.aimX + dt * 12);
    if (!paused) game.update(dt);
    // render latest physics state, then request next step (buffer is transferred)
    const buf = physics.buf;
    let pz, gy, lidY;
    if (buf) {
      coins.update(buf); pz = buf[1]; gy = buf[2]; lidY = buf[4]; cupX = buf[5];
      for (let i = 0; i < 10; i++) dev[i] = buf[6 + i];
      if (!paused) audio.pusherDrive(buf[3]);
      sparkleAcc += dt;
      if (sparkleAcc > 0.12) { sparkleAcc = 0; emitSparkles(buf); }
    }
    if (!paused) { perfCheck(dt); physics.tick(dt); }
    stage.update(dt, {
      pusherZ: pz, guardY: gy, lidY, pocketOpen: game.features.pocketOpen, bonusOn: s.f_bonusZone, bonusX: game.features.bonusX, bonusHalf: 1.0,
      launcherX: game.launcherX, showBeam: s.showBeam,
      gateOn: s.f_slot, gateX: game.gateX, gateHalf: game.gateHalf(), gateFlash: game.gateFlash,
      lightMode: game.lightMode(), payoutFlash: game.payoutFlash > 0.1 ? game.payoutFlash : 0,
    });
    backboard.update(dt, {
      slot: game.slot, slotOn: s.f_slot, jpOn: s.f_jp, jpPool: save.jpPool, stock: save.stock, stockMax: game.stockMax(),
      fever: game.fx.fever > 0, effects: game.fx, combo: game.combo, theme: game.theme(), event: game.features.event,
      mech: !!(s.f_mechReels && s.f_slot), wheelMeter: s.f_wheel ? (save.wheelMeter || 0) : -1, wheelNeed: WHEEL_NEED,
    });
    if (!paused) effects.update(dt);
    coins.updateTray(paused ? 0 : dt);
    if (!paused) {
      tower.update(dt);
      const M = machines;
      M.reels.group.visible = !!(s.f_mechReels && s.f_slot);
      if (M.reels.group.visible) M.reels.update(dt, game.slot, { fever: game.fx.fever > 0 });
      M.hopper.group.visible = !!s.f_hopper;
      if (s.f_hopper) M.hopper.update(dt, game.showerQueue.length);
      M.wheel.group.visible = !!s.f_wheel;
      if (s.f_wheel) M.wheel.update(dt);
      M.cup.update(dt, cupX, CUP.y - 0.2, CUP.z, !!s.f_catcher);
      for (const b of M.beacons.items) b.g.visible = !!s.f_beacons;
      if (s.f_beacons) M.beacons.update(dt, game.beaconMode());
      if (s.f_catcher !== cupSent) { physics.cmd('cup', !!s.f_catcher); cupSent = s.f_catcher; }
      M.coaster.group.visible = !!s.f_coaster;
      M.coaster.update(dt);
      M.crane.group.visible = !!s.f_crane;
      if (s.f_crane) M.crane.update(dt, [dev[0], dev[1], dev[2], dev[3]], dev[9] > 0);
      M.field.update(dt, { kickZ: dev[4], kickX: dev[5], ttAngle: dev[6], flipL: dev[7], flipR: dev[8], ttOn: game.ttSent, tt: !!s.f_turntable, flip: !!s.f_flipper, meter: save.wheelMeter || 0, meterOn: !!(s.f_meterTube && s.f_wheel && s.f_catcher) }, {});
      game.plinko3d.update(dt);
    }
    stage.render();
    ui.update(dt, { fps });
    if (now - lastSave > 15000) persist();
    if (now - lastBoard > 60000) persistBoard();
  }
  requestAnimationFrame(loop);

  // twinkles on rare objects so they stand out in the pile
  let sparkleAcc = 0;
  const SPARK = { 2: '#ffffff', 3: '#ffd34d', 4: '#ff6b6b', 5: '#ffffff', 6: '#ffd34d', 7: '#7fe7ff' };
  function emitSparkles(b) {
    if (s.reduceMotion) return;
    const n = b[0] | 0;
    for (let i = 0, o = PACK_HEAD; i < n; i++, o += 10) {
      const k = b[o + 1] | 0;
      if (k < 2 || Math.random() > 0.35) continue;
      const col = k === 5 ? ['#ff1744', '#2979ff', '#00e676', '#ffc400', '#d500f9', '#ffffff'][Math.floor(b[o + 2] / 4) % 6] : SPARK[k];
      effects.burst(b[o + 3] + (Math.random() - 0.5) * 0.6, b[o + 4] + 0.3, b[o + 5] + (Math.random() - 0.5) * 0.6, col, 1, 0.6, k === 5 && (b[o + 2] % 4) >= 2 ? 0.9 : 0.55, 0.6);
    }
  }
  // suggest a lighter configuration when physics cannot keep up
  let perfT = 0, perfSlow = 0, perfWarned = false;
  function perfCheck(dt) {
    if (perfWarned) return;
    perfT += dt;
    if (perfT < 8) return;
    if ((game.physMs || 0) > 1000 / s.physHz * 1.6) perfSlow += dt; else perfSlow = Math.max(0, perfSlow - dt);
    if (perfSlow > 6) {
      perfWarned = true;
      ui.toast('⚙', t('perfHint'));
    }
  }

  // expose for debugging / automated tests
  window.__game = game;
}

function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }

boot().catch(e => {
  console.error(e);
  setLoad('Error: ' + (e && e.message || e));
});

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
