import './ui/style.css';
import { Stage, CAMERA_PRESETS } from './render/scene.js';
import { CoinRenderer } from './render/coins.js';
import { Backboard } from './render/backboard.js';
import { Effects } from './render/effects.js';
import { AudioSys } from './audio/audio.js';
import { PhysicsClient } from './core/physicsClient.js';
import { L, configureLayout } from './core/layout.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { Roulette } from './ui/roulette.js';
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
  if (!save._qualityApplied || s.quality === 'auto') Object.assign(s, QUALITY_PRESETS[q] ? { ...QUALITY_PRESETS[q], quality: s.quality } : {});
  save._qualityApplied = true;
  configureLayout(s.tableSize);

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
  await physics.init({ worker: s.worker, hz: s.physHz, iterations: 2, stroke: (save.upgrades.stroke || 0) * 0.3, snapshot: board, prefill: s.prefill });
  setLoad(t('loading'), 0.9);

  const uiRoot = document.getElementById('ui');
  let game;
  const ui = new UI(uiRoot, {
    onSettings: key => applySetting(key),
    onExport: async withBoard => exportCode(save, withBoard ? await physics.snapshot() : null),
    onImport: code => doImport(code),
    onResetBoard: () => { physics.cmd('clear'); physics.cmd('prefill', s.prefill); clearBoard(); ui.close(); },
    onResetAll: () => { wipeAll(); location.reload(); },
    onRestoreBackup: b => { replaceSave(b.save, b.board); },
    onCycleCamera: () => { const keys = Object.keys(CAMERA_PRESETS); s.camera = keys[(keys.indexOf(s.camera) + 1) % keys.length]; stage.userZoom = 0; stage.fitCamera(); },
    onFullscreen: () => toggleFullscreen(),
    onToggleMute: () => { muted = !muted; audio.setMuted(muted); document.getElementById('bMute').innerHTML = muted ? MUTE_SVG : SOUND_SVG; },
  });
  const roulette = new Roulette(uiRoot, audio);
  game = new Game({ stage, coins, backboard, effects, audio, physics, ui, save, roulette });
  ui.bind(game);
  physics.onFrame = msg => game.onPhysicsFrame(msg);
  let muted = false;
  const SOUND_SVG = document.getElementById('bMute').innerHTML;
  const MUTE_SVG = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  stage.applyQuality(s);
  coins.setShadows(!!s.shadows, s.coinDetail === 'high' || s.coinDetail === 'ultra');
  ui.checkOrientation();

  function loadBoardFor(key) {
    const own = loadBoard(key);
    if (own) return own;
    const baked = BAKED[`./data/board_${key}.txt`];
    if (baked) { try { return decodeBoard(baked.trim()); } catch (e) { /* ignore */ } }
    return null;
  }

  function applySetting(key) {
    const st = s;
    switch (key) {
      case 'quality':
        if (st.quality !== 'auto') Object.assign(st, QUALITY_PRESETS[st.quality]);
        else Object.assign(st, QUALITY_PRESETS[detectQuality()]);
        coins.build(st.coinDetail);
        coins.setShadows(!!st.shadows, st.coinDetail === 'high' || st.coinDetail === 'ultra');
        stage.applyQuality(st); effects.amount = st.particles;
        physics.cmd('hz', st.physHz);
        break;
      case 'coinDetail': coins.build(st.coinDetail); coins.setShadows(!!st.shadows, st.coinDetail === 'high' || st.coinDetail === 'ultra'); break;
      case 'resScale': case 'shadows': case 'shadowRes': case 'bloom': case 'reflections': case 'fov': case 'camera':
        stage.applyQuality(st); coins.setShadows(!!st.shadows, st.coinDetail === 'high' || st.coinDetail === 'ultra'); break;
      case 'particles': effects.amount = st.particles; break;
      case 'physHz': physics.cmd('hz', st.physHz); break;
      case 'master': case 'bgm': case 'se': audio.setVolume({ master: st.master, bgm: st.bgm, se: st.se }); break;
      case 'theme': { const th = themeById(st.theme); stage.setTheme(th); audio.setStyle(th.bgm); break; }
      case 'leftHand': case 'highContrast': case 'reduceMotion': case 'uiScale': case 'dropButton': case 'showFps': ui.applyLayout(); break;
      case 'f_missions': game.prog.ensureMissions(); break;
      case 'tableSize': persist(); storeSave(save); location.reload(); return;
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
    storeSave(newS);
    const size = newS.settings.tableSize || 'wide';
    if (newBoard) storeBoard(newBoard, size); else clearBoard(size);
    ui.toast('✔', t('importOk'));
    setTimeout(() => location.reload(), 400);
  }

  // ---------- persistence ----------
  let lastSave = 0, lastBoard = 0;
  function persist() { storeSave(save); lastSave = performance.now(); }
  async function persistBoard() { const snap = await physics.snapshot(); storeBoard(snap, s.tableSize); lastBoard = performance.now(); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { persist(); persistBoard(); if (s.muteHidden) audio.setMuted(true); game.release(); }
    else { audio.setMuted(muted); last = performance.now(); }
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
    if (roulette.active || ui.isOpen()) return;
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
    if (e.code === 'Escape') { ui.isOpen() ? ui.close() : ui.open('shop'); return; }
    if (ui.isOpen() || roulette.active) return;
    if ((e.code === 'Space' || e.code === 'Enter') && !keys[e.code]) { keys[e.code] = true; game.press(); e.preventDefault(); }
    if (e.code === 'ArrowLeft' || e.code === 'KeyQ') { keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyE') { keys.right = true; e.preventDefault(); }
    if (e.code === 'KeyA') { s.autoDrop = !s.autoDrop; applySetting('autoDrop'); }
    if (e.code === 'KeyC') ui.o.onCycleCamera();
    if (e.code === 'KeyM') ui.o.onToggleMute();
    if (e.code === 'KeyF') toggleFullscreen();
    if (e.code === 'KeyP') { s.showFps = !s.showFps; ui.applyLayout(); }
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
  let last = performance.now(), fps = 60, frameAcc = 0;
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
    if (keys.left) game.setAim(game.aimX - dt * 12);
    if (keys.right) game.setAim(game.aimX + dt * 12);
    game.update(dt);
    // render latest physics state, then request next step (buffer is transferred)
    const buf = physics.buf;
    let pz, gy;
    if (buf) { coins.update(buf); pz = buf[1]; gy = buf[2]; }
    physics.tick(dt);
    stage.update(dt, {
      pusherZ: pz, guardY: gy, launcherX: game.launcherX, showBeam: s.showBeam,
      gateOn: s.f_slot, gateX: game.gateX, gateHalf: game.gateHalf(), gateFlash: game.gateFlash,
      lightMode: game.lightMode(), payoutFlash: game.payoutFlash > 0.1 ? game.payoutFlash : 0,
    });
    backboard.update(dt, {
      slot: game.slot, slotOn: s.f_slot, jpOn: s.f_jp, jpPool: save.jpPool, stock: save.stock, stockMax: game.stockMax(),
      fever: game.fx.fever > 0, effects: game.fx, combo: game.combo, theme: game.theme(),
    });
    effects.update(dt);
    stage.render();
    ui.update(dt, { fps });
    if (now - lastSave > 15000) persist();
    if (now - lastBoard > 60000) persistBoard();
  }
  requestAnimationFrame(loop);

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
