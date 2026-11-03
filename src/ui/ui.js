// DOM user interface: HUD, menus, dialogs, toasts, popups
import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { t, setLang, getLang } from '../i18n.js';
import { UPGRADES, upgradeCost, xpForLevel } from '../game/balance.js';
import { ACHIEVEMENTS } from '../game/progression.js';
import { THEMES } from '../render/themes.js';
import { GEM_COLORS, TOKEN_STYLE } from '../render/coins.js';
import { exportCode, importCode, readBackup } from '../save.js';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => Math.floor(n).toLocaleString();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  shop: '<svg viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M4 9h16v11H4zM9 20v-6h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  missions: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8M20 12v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v12H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8a5 5 0 010 8M18.5 5.5a8.5 8.5 0 010 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><defs><radialGradient id="cg" cx="40%" cy="35%"><stop offset="0" stop-color="#fff6c0"/><stop offset=".6" stop-color="#e6b422"/><stop offset="1" stop-color="#8a6200"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#cg)"/><circle cx="12" cy="12" r="7" fill="none" stroke="#8a6200" stroke-width="1.2"/><path d="M12 7.5l1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill="#a87400"/></svg>',
};

export class UI {
  constructor(root, opts) {
    this.root = root;
    this.o = opts; // { onSettings, onExport, onImport, onResetBoard, onResetAll, onRestoreBackup, getBoard }
    this.game = null;
    this.hudAcc = 0;
    this.popups = [];
    this.v = new THREE.Vector3();
    this.build();
  }

  bind(game) { this.game = game; this.applyLayout(); this.refreshTexts(); }
  get s() { return this.game.settings; }

  build() {
    const r = this.root;
    r.innerHTML = '';
    this.hud = h('div', 'hud');
    this.hud.innerHTML = `
      <div class="hud-tl panel">
        <div class="coins"><span class="ico">${ICONS.coin}</span><span class="val" id="hCoins">0</span></div>
        <div class="lvrow"><span class="lv" id="hLv">Lv1</span><span class="title" id="hTitle"></span></div>
        <div class="xpbar"><i id="hXp"></i></div>
      </div>
      <div class="hud-fx" id="hFx"></div>
      <div class="hud-tr">
        <button class="ib" id="bPause" aria-label="pause">${ICONS.pause}</button>
        <button class="ib" data-tab="missions" aria-label="missions">${ICONS.missions}<b class="badge hidden" id="hMisBadge"></b></button>
        <button class="ib" data-tab="shop" aria-label="shop">${ICONS.shop}</button>
        <button class="ib" data-tab="achievements" aria-label="collection">${ICONS.trophy}</button>
        <button class="ib" data-tab="settings" aria-label="settings">${ICONS.gear}</button>
      </div>
      <div class="hud-bl">
        <button class="ib sm" id="bCam" aria-label="camera">${ICONS.camera}</button>
        <button class="ib sm" id="bFull" aria-label="fullscreen">${ICONS.full}</button>
        <button class="ib sm" id="bMute" aria-label="mute">${ICONS.sound}</button>
        <button class="ib sm" data-tab="help" aria-label="help">${ICONS.help}</button>
      </div>
      <div class="hud-br">
        <button class="pill" id="bAuto">AUTO</button>
        <button class="drop" id="bDrop"><span>DROP</span></button>
      </div>
      <div class="fps hidden" id="hFps"></div>`;
    r.appendChild(this.hud);
    this.toasts = h('div', 'toasts'); r.appendChild(this.toasts);
    this.bannerEl = h('div', 'banner'); r.appendChild(this.bannerEl);
    this.popLayer = h('div', 'pops'); r.appendChild(this.popLayer);
    this.hintEl = h('div', 'hint hidden'); r.appendChild(this.hintEl);
    this.modal = h('div', 'modal hidden');
    this.modal.innerHTML = `<div class="sheet"><div class="tabs" id="mTabs"></div><button class="close" id="mClose" aria-label="close">✕</button><div class="body" id="mBody"></div></div>`;
    r.appendChild(this.modal);
    this.dialog = h('div', 'dialog hidden'); r.appendChild(this.dialog);
    this.pauseEl = h('div', 'pausebox hidden', `<div class="ptitle"></div><div class="row"><button class="btn primary" id="pResume"></button><button class="btn" id="pMenu"></button><button class="btn" id="pCam"></button></div>`);
    r.appendChild(this.pauseEl);
    this.rotateEl = h('div', 'rotate hidden', `<div class="phone"></div><p id="rotMsg"></p><button class="btn" id="rotBtn"></button>`);
    r.appendChild(this.rotateEl);

    // events
    this.hud.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { this.game.audio.ui(); this.open(b.dataset.tab); }));
    $('#mClose', this.modal).addEventListener('click', () => this.close());
    this.modal.addEventListener('pointerdown', e => { if (e.target === this.modal) this.close(); });
    $('#bAuto', this.hud).addEventListener('click', () => { this.s.autoDrop = !this.s.autoDrop; this.o.onSettings('autoDrop'); this.game.audio.ui(); });
    const drop = $('#bDrop', this.hud);
    drop.addEventListener('pointerdown', e => { e.preventDefault(); drop.setPointerCapture(e.pointerId); this.game.audio.unlock(); this.game.press(); });
    const rel = () => this.game.release();
    drop.addEventListener('pointerup', rel); drop.addEventListener('pointercancel', rel);
    $('#bCam', this.hud).addEventListener('click', () => this.o.onCycleCamera());
    $('#bPause', this.hud).addEventListener('click', () => { this.game.audio.ui(); this.togglePause(); });
    $('#pResume', this.pauseEl).addEventListener('click', () => this.togglePause(false));
    $('#pMenu', this.pauseEl).addEventListener('click', () => this.open('shop'));
    $('#pCam', this.pauseEl).addEventListener('click', () => this.o.onCycleCamera());
    $('#bFull', this.hud).addEventListener('click', () => this.o.onFullscreen());
    $('#bMute', this.hud).addEventListener('click', () => this.o.onToggleMute());
    $('#rotBtn', this.rotateEl).addEventListener('click', () => { this.rotateDismissed = true; this.checkOrientation(); });
    this.hintEl.addEventListener('click', () => this.nextHint());
  }

  togglePause(force) {
    const on = force !== undefined ? force : !this.game.pauseReasons.has('user');
    this.game.setPause('user', on);
  }
  onPauseChange(paused, user) {
    this.pauseEl.classList.toggle('hidden', !user);
    $('#bPause', this.hud).innerHTML = user ? ICONS.play : ICONS.pause;
    document.body.classList.toggle('paused', paused);
  }

  refreshTexts() {
    $('.ptitle', this.pauseEl).textContent = t('paused');
    $('#pResume', this.pauseEl).textContent = t('resume');
    $('#pMenu', this.pauseEl).textContent = t('menu');
    $('#pCam', this.pauseEl).textContent = t('camera');
    $('#rotMsg', this.rotateEl).textContent = t('rotate');
    $('#rotBtn', this.rotateEl).textContent = t('playAnyway');
    $('#bDrop span', this.hud).textContent = t('drop');
    if (!this.modal.classList.contains('hidden')) this.renderTab();
  }

  applyLayout() {
    const s = this.s;
    document.body.classList.toggle('lefthand', !!s.leftHand);
    document.body.classList.toggle('hc', !!s.highContrast);
    document.body.classList.toggle('rm', !!s.reduceMotion);
    document.documentElement.style.setProperty('--ui', s.uiScale || 1);
    $('#bDrop', this.hud).classList.toggle('hidden', !s.dropButton);
    $('#hFps', this.hud).classList.toggle('hidden', !s.showFps);
  }

  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const touch = matchMedia('(pointer:coarse)').matches;
    this.rotateEl.classList.toggle('hidden', !(portrait && touch && !this.rotateDismissed));
    document.body.classList.toggle('portrait', portrait);
  }

  // ---------- per-frame ----------
  update(dt, info) {
    this._updatePopups(dt);
    this.hudAcc += dt;
    if (this.hudAcc < 0.1) return;
    this.hudAcc = 0;
    const g = this.game, s = g.save;
    $('#hCoins', this.hud).textContent = fmt(s.coins);
    $('#hLv', this.hud).textContent = `Lv${s.level}`;
    $('#hTitle', this.hud).textContent = t('t_' + g.prog.title());
    $('#hXp', this.hud).style.width = `${Math.min(100, s.xp / xpForLevel(s.level) * 100)}%`;
    $('#bAuto', this.hud).classList.toggle('on', !!g.settings.autoDrop);
    // fx chips
    const chips = [];
    const fx = g.fx;
    if (fx.fever > 0) chips.push(`<span class="chip fever">FEVER ${Math.ceil(fx.fever)}</span>`);
    if (fx.walls > 0) chips.push(`<span class="chip wall">🛡 ${Math.ceil(fx.walls)}</span>`);
    if (fx.turbo > 0) chips.push(`<span class="chip turbo">≫ ${Math.ceil(fx.turbo)}</span>`);
    if (fx.double > 0) chips.push(`<span class="chip dbl">×2 ${Math.ceil(fx.double)}</span>`);
    if (g.settings.f_slot) chips.push(`<span class="chip stock">${t('stock')} ${s.stock}/${g.stockMax()}</span>`);
    if (g.settings.f_jp) chips.push(`<span class="chip jp">JP ${fmt(s.jpPool)}</span>`);
    if (fx.magnet > 0) chips.push(`<span class="chip turbo">MAG ${Math.ceil(fx.magnet)}</span>`);
    if (g.settings.f_sugoroku) chips.push(`<span class="chip road">🎲${s.dice || 0} · ${(s.roadPos || 0)}/24</span>`);
    const ev = g.features.event;
    if (ev) chips.push(`<span class="chip fever">${t('ev_' + ev.id)} ${Math.ceil(ev.t)}${ev.id === 'challenge' ? ` · ${ev.progress || 0}/${ev.target}` : ''}</span>`);
    if (g.features.pocketOpen) chips.push(`<span class="chip combo">POCKET</span>`);
    const html = chips.join('');
    if (html !== this._chips) { $('#hFx', this.hud).innerHTML = html; this._chips = html; }
    const ms = s.missions;
    const claim = ms && g.settings.f_missions ? ms.list.filter(m => m.done && !m.claimed).length : 0;
    const b = $('#hMisBadge', this.hud); b.textContent = claim; b.classList.toggle('hidden', !claim);
    if (g.settings.showFps) $('#hFps', this.hud).textContent = `${t('fps')} ${info.fps.toFixed(0)} | ${t('objects')} ${g.objCount} | ${t('physMs')} ${(g.physMs || 0).toFixed(1)}ms`;
    if (!this.modal.classList.contains('hidden') && (this.tab === 'shop' || this.tab === 'missions' || this.tab === 'stats' || this.tab === 'road')) {
      this._liveAcc = (this._liveAcc || 0) + 1;
      if (this._liveAcc % 5 === 0) this.renderTab(true);
    }
  }

  // ---------- popups / toasts / banners ----------
  popup(text, x, y, z, color = '#fff', scale = 1) {
    if (this.popups.length > 24) return;
    const e = h('div', 'pop', esc(text));
    if (color === 'rainbow') e.classList.add('rainbow'); else e.style.color = color;
    e.style.fontSize = `${scale * 1.3}em`;
    this.popLayer.appendChild(e);
    this.popups.push({ e, x, y, z, t: 0, life: 1.1 });
  }
  _updatePopups(dt) {
    const cam = this.game && this.game.stage.camera;
    if (!cam) return;
    const W = window.innerWidth, H = window.innerHeight;
    this.popups = this.popups.filter(p => {
      p.t += dt;
      if (p.t >= p.life) { p.e.remove(); return false; }
      this.v.set(p.x, p.y + p.t * 1.6, p.z).project(cam);
      p.e.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * W}px, ${(-this.v.y * 0.5 + 0.5) * H}px) translate(-50%,-50%)`;
      p.e.style.opacity = String(Math.min(1, (p.life - p.t) * 3));
      return true;
    });
  }
  toast(icon, text) {
    const e = h('div', 'toast', `<span class="ti">${icon}</span><span>${esc(text)}</span>`);
    this.toasts.appendChild(e);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => e.classList.add('out'), 3200);
    setTimeout(() => e.remove(), 3700);
  }
  achievement(a) {
    this.toast(a.icon, `${t('achieved')}: ${this.achName(a)} +${a.reward}`);
  }
  banner(text, color = '#fff', dur = 1.6) {
    const e = this.bannerEl;
    e.textContent = text;
    e.className = 'banner show' + (color === 'rainbow' ? ' rainbow' : '');
    e.style.color = color === 'rainbow' ? '' : color;
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { e.className = 'banner'; }, dur * 1000);
  }

  // ---------- hints ----------
  startHints() { this.hintIdx = this.game.save.tutorial || 0; this.showHint(); }
  showHint() {
    const keys = ['hint1', 'hint2', 'hint3', 'hint4'];
    if (this.hintIdx >= keys.length || !this.s.f_hints) { this.hintEl.classList.add('hidden'); return; }
    this.hintEl.innerHTML = `<b>${this.hintIdx + 1}/${keys.length}</b> ${esc(t(keys[this.hintIdx]))} <span class="tap">▶</span>`;
    this.hintEl.classList.remove('hidden');
    clearTimeout(this._ht);
    this._ht = setTimeout(() => this.nextHint(), 7000);
  }
  nextHint() { this.hintIdx++; this.game.save.tutorial = this.hintIdx; this.showHint(); }

  // ---------- dialogs ----------
  confirm(text, onYes) {
    this.dialog.innerHTML = `<div class="dbox"><p>${esc(text)}</p><div class="row"><button class="btn" id="dNo">${t('cancel')}</button><button class="btn primary" id="dYes">${t('ok')}</button></div></div>`;
    this.dialog.classList.remove('hidden');
    $('#dNo', this.dialog).onclick = () => this.dialog.classList.add('hidden');
    $('#dYes', this.dialog).onclick = () => { this.dialog.classList.add('hidden'); onYes(); };
  }
  showLogin(lb, onClaim) {
    const days = [1, 2, 3, 4, 5, 6, 7].map(d => `<div class="lday ${d < lb.day ? 'past' : d === lb.day ? 'now' : ''}"><small>${t('loginDay', d)}</small>${d === 7 ? '💎' : '🪙'}</div>`).join('');
    this.dialog.innerHTML = `<div class="dbox login"><h2>${t('login')}</h2><div class="ldays">${days}</div><p class="big">+${lb.reward}${lb.gem ? ' & 💎' : ''}</p><div class="row"><button class="btn primary" id="dYes">${t('claim')}</button></div></div>`;
    this.dialog.classList.remove('hidden');
    $('#dYes', this.dialog).onclick = () => { this.dialog.classList.add('hidden'); onClaim(); };
  }

  // ---------- menu ----------
  open(tab) {
    this.tab = tab;
    this.modal.classList.remove('hidden');
    this.game.release();
    this.renderTabs();
    this.renderTab();
    this.game.setPause('menu', !!this.s.pauseOnMenu);
  }
  close() { this.modal.classList.add('hidden'); this.game.setPause('menu', false); this.o.onMenuClose && this.o.onMenuClose(); }
  isOpen() { return !this.modal.classList.contains('hidden') || !this.dialog.classList.contains('hidden'); }

  renderTabs() {
    const tabs = [['shop', t('shop')], ['missions', t('missions')], ['road', t('road')], ['achievements', t('achievements')], ['gems', t('gems')], ['stats', t('stats')], ['themes', t('themes')], ['settings', t('settings')], ['data', t('data')], ['help', t('help')]];
    const el = $('#mTabs', this.modal);
    el.innerHTML = tabs.map(([id, n]) => `<button class="tab ${id === this.tab ? 'on' : ''}" data-t="${id}">${n}</button>`).join('');
    el.querySelectorAll('.tab').forEach(b => b.onclick = () => { this.tab = b.dataset.t; this.game.audio.ui(); this.renderTabs(); this.renderTab(); });
  }

  renderTab(live) {
    const body = $('#mBody', this.modal);
    const st = live ? body.scrollTop : 0;
    const fn = this['tab_' + this.tab];
    if (!fn) return;
    if (live && this.tab === 'settings') return;
    fn.call(this, body);
    body.scrollTop = st;
  }

  tab_shop(body) {
    const g = this.game;
    body.innerHTML = `<div class="wallet">${ICONS.coin}<b>${fmt(g.save.coins)}</b></div><div class="grid">` + UPGRADES.map(u => {
      const lv = g.upg(u.id), maxed = lv >= u.max, cost = maxed ? 0 : upgradeCost(u, lv);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="card"><div class="ct">${t('up_' + u.id)}</div><div class="cd">${t('up_' + u.id + '_d')}</div><div class="pips">${pips}</div>
        <button class="btn ${maxed ? '' : 'primary'}" data-buy="${u.id}" ${maxed || g.save.coins < cost ? 'disabled' : ''}>${maxed ? t('max') : `${ICONS.coin}${fmt(cost)}`}</button></div>`;
    }).join('') + `</div><p class="note">${t('regenInfo', g.regenSec(), g.regenCap())}</p>`;
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { if (g.buyUpgrade(b.dataset.buy)) this.renderTab(true); });
  }

  missionText(m) { return t('m_' + m.id, m.target); }
  tab_missions(body) {
    const g = this.game, ms = g.save.missions;
    if (!g.settings.f_missions || !ms) { body.innerHTML = `<p class="note">${t('off')}</p>`; return; }
    const now = new Date(), tm = new Date(now); tm.setHours(24, 0, 0, 0);
    const left = Math.max(0, tm - now), hh = Math.floor(left / 3600000), mm = Math.floor(left / 60000) % 60;
    body.innerHTML = `<h3>${t('daily')} <small>${t('resetIn')} ${hh}:${String(mm).padStart(2, '0')}</small></h3>` + ms.list.map((m, i) => `
      <div class="mission ${m.claimed ? 'claimed' : ''}"><div class="mt">${esc(this.missionText(m))}</div>
      <div class="bar"><i style="width:${Math.min(100, m.progress / m.target * 100)}%"></i><span>${Math.floor(m.progress)}/${m.target}</span></div>
      <button class="btn ${m.done && !m.claimed ? 'primary' : ''}" data-claim="${i}" ${!m.done || m.claimed ? 'disabled' : ''}>${m.claimed ? t('claimed') : `${t('claim')} +${m.reward}`}</button></div>`).join('');
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => { if (g.prog.claimMission(+b.dataset.claim)) { g.audio.levelUp(); this.renderTab(true); } });
  }

  achName(a) {
    const names = {
      dropped: ['dropped'], won: ['won'], slotSpins: ['slotSpins'], slotWins: ['slotWins'], sevens: ['sevens'], jpLottery: ['jpLottery'], jpWins: ['jpWins'], fevers: ['fevers'],
      maxCombo: ['maxCombo'], items: ['items'], chests: ['chests'], gatePasses: ['gatePasses'], gemsUnique: ['gems'], level: [], maxWallet: ['maxWallet'], biggestWin: ['biggestWin'],
      playTime: ['playTime'], loginStreak: [], upgradesTotal: [], walls: [], missionsDone: [], roadLaps: ['roadLaps'], events: ['events'], challenges: ['challenges'], pockets: ['pockets'], plinkos: ['plinkos'], croonBest: ['croonBest'],
    };
    const ja = getLang() === 'ja';
    const label = {
      level: ja ? 'レベル' : 'Level', loginStreak: ja ? '連続ログイン' : 'Login streak', upgradesTotal: ja ? '強化の合計' : 'Total upgrades', walls: ja ? 'ガード壁' : 'Guard walls', missionsDone: ja ? 'ミッション達成' : 'Missions done',
    }[a.stat] || t('st_' + (names[a.stat] || [a.stat])[0]);
    const v = a.stat === 'playTime' ? `${a.target / 3600}h` : fmt(a.target);
    return `${label} ${v}`;
  }
  tab_achievements(body) {
    const g = this.game, got = g.save.achievements;
    const n = ACHIEVEMENTS.filter(a => got[a.id]).length;
    body.innerHTML = `<h3>${t('achievements')} ${n}/${ACHIEVEMENTS.length}</h3><div class="achs">` + ACHIEVEMENTS.map(a => {
      const have = !!got[a.id];
      const cur = Math.min(a.target, g.prog.achValue(a));
      return `<div class="ach ${have ? 'got' : ''}"><span class="ai">${a.icon}</span><div><div class="an">${esc(this.achName(a))}</div><div class="bar sm"><i style="width:${cur / a.target * 100}%"></i></div></div><span class="ar">${have ? '✔' : '+' + fmt(a.reward)}</span></div>`;
    }).join('') + '</div>';
  }

  tab_gems(body) {
    const g = this.game, gems = g.save.gems;
    const types = t('gemType'), rar = t('gemRarity');
    let html = `<h3>${t('gems')} ${Object.keys(gems).length}/24 <small>${getLang() === 'ja' ? 'スロット当選率' : 'Slot luck'} +${Math.round(g.prog.gemLuck() * 100)}%</small></h3><div class="gems">`;
    for (let ty = 0; ty < 6; ty++) {
      html += `<div class="gemrow ${g.save.gemSets[ty] ? 'complete' : ''}"><span class="gname">${types[ty]}</span>`;
      for (let r = 0; r < 4; r++) {
        const c = gems[ty * 4 + r];
        html += `<div class="gem ${c ? 'have' : ''} r${r}" title="${types[ty]} ${rar[r]}"><svg viewBox="0 0 40 40"><path d="M8 15 L14 7 H26 L32 15 L20 34 Z" fill="${c ? GEM_COLORS[ty] : '#333'}" stroke="${c ? '#fff' : '#555'}" stroke-width="1.5"/><path d="M8 15 H32 M14 7 L17 15 L20 34 M26 7 L23 15 L20 34" stroke="${c ? 'rgba(255,255,255,.6)' : '#444'}" fill="none"/></svg>${this.s.cbSymbols ? `<b class="gsym">${'RSETAD'[ty]}${r + 1}</b>` : ''}<small>${rar[r]}${c ? ` ×${c}` : ''}</small></div>`;
      }
      html += '</div>';
    }
    body.innerHTML = html + '</div>';
  }

  tab_stats(body) {
    const g = this.game, st = g.save.stats;
    const time = s => { s = Math.floor(s || 0); return `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`; };
    const rows = [['diceRolls'], ['roadLaps'], ['events'], ['challenges'], ['pockets'], ['plinkos'], ['croonBest'], ['dropped'], ['won'], ['lost'], ['payout', st.dropped ? `${((st.won || 0) / st.dropped * 100).toFixed(1)}%` : '-'], ['gatePasses'], ['slotSpins'], ['slotWins'], ['sevens'], ['jpLottery'], ['jpWins'], ['fevers'], ['maxCombo'], ['items'], ['gems'], ['chests'], ['biggestWin'], ['maxWallet'], ['playTime', time(st.playTime)]];
    body.innerHTML = `<div class="stats">` + rows.map(([k, v]) => `<div class="srow"><span>${t('st_' + k)}</span><b>${v !== undefined ? v : fmt(st[k] || 0)}</b></div>`).join('') + `</div>`;
  }

  tab_themes(body) {
    const g = this.game, lang = getLang();
    body.innerHTML = '<div class="themes">' + THEMES.map(th => {
      const unlocked = g.save.level >= th.unlock, cur = g.settings.theme === th.id;
      return `<div class="theme ${cur ? 'cur' : ''} ${unlocked ? '' : 'locked'}" style="--a:${th.accent};--b:${th.cabinet};--c:${th.bgTop}">
        <div class="tprev"><i></i><i></i><i></i></div><div class="tn">${th.name[lang] || th.name.ja}</div>
        <button class="btn ${cur ? '' : 'primary'}" data-th="${th.id}" ${!unlocked || cur ? 'disabled' : ''}>${!unlocked ? t('unlockAt', th.unlock) : cur ? t('equipped') : t('equip')}</button></div>`;
    }).join('') + '</div>';
    body.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { g.settings.theme = b.dataset.th; this.o.onSettings('theme'); this.renderTab(); });
  }

  tab_road(body) {
    const g = this.game, f = g.features, pos = g.save.roadPos || 0;
    body.innerHTML = `<h3>${t('road')} <small>${t('lap')} ${(g.save.roadLap || 0) + 1} · ${t('dice')} ${g.save.dice || 0} · GATE ${g.save.roadGate || 0}/30</small></h3><p class="note">${t('roadInfo')}</p>
      <div class="roadgrid">${f.board().map((s, i) => `<div class="sq ${i === pos ? 'cur' : ''}" style="--c:${s.color}"><small>${i}</small>${esc(f.squareLabel(s))}</div>`).join('')}</div>`;
  }

  tab_help(body) {
    body.innerHTML = `<div class="help">${t('help_body')}</div><p class="note">${t('credits')} · ${t('version')} ${__APP_VERSION__}</p>`;
  }

  settingsSchema() {
    const q = ['auto', 'low', 'medium', 'high', 'ultra', 'custom'];
    return [
      ['g_graphics', [
        ['quality', 'select', q.map(v => [v, t('q_' + v)])],
        ['tableSize', 'select', [['wide', getLang() === 'ja' ? 'ワイド(22列)' : 'Wide (22)'], ['normal', getLang() === 'ja' ? 'ノーマル(18列)' : 'Normal (18)'], ['compact', getLang() === 'ja' ? 'コンパクト(14列)' : 'Compact (14)']], getLang() === 'ja' ? '台の大きさ(盤面リセット)' : 'Table size (resets table)'],
        ['camera', 'select', ['standard', 'high', 'low', 'top', 'field'].map(v => [v, t('c_' + v)])],
        ['fov', 'range', 30, 70, 1],
        ['resScale', 'range', 0.5, 1.5, 0.05],
        ['shadows', 'toggle'], ['shadowRes', 'select', [[1024, '1024'], [2048, '2048'], [4096, '4096']]],
        ['bloom', 'toggle'], ['reflections', 'toggle'], ['particles', 'range', 0, 2, 0.1],
        ['coinDetail', 'select', ['low', 'medium', 'high', 'ultra'].map(v => [v, t('q_' + v)])],
        ['maxFps', 'select', [[0, getLang() === 'ja' ? '無制限' : 'Unlimited'], [30, '30'], [60, '60']]],
        ['coinReflect', 'range', 0.3, 1.5, 0.05], ['showFps', 'toggle'], ['shake', 'toggle'], ['leds', 'toggle'], ['antialias', 'toggle'],
      ]],
      ['g_physics', [
        ['maxObjects', 'range', 300, 1500, 50], ['physHz', 'select', [[45, '45Hz'], [60, '60Hz'], [90, '90Hz'], [120, '120Hz']]], ['prefill', 'range', 0, 900, 20], ['worker', 'toggle'],
      ]],
      ['g_sound', [['master', 'range', 0, 1, 0.05], ['bgm', 'range', 0, 1, 0.05], ['se', 'range', 0, 1, 0.05], ['ambience', 'range', 0, 1, 0.05], ['muteHidden', 'toggle']]],
      ['g_controls', [
        ['pauseOnMenu', 'toggle'], ['autoDrop', 'toggle'], ['autoMode', 'select', ['follow', 'sweep', 'center', 'random'].map(v => [v, t('a_' + v)])],
        ['holdRepeat', 'toggle'], ['dropButton', 'toggle'], ['showBeam', 'toggle'], ['vibrate', 'toggle'], ['leftHand', 'toggle'], ['uiScale', 'range', 0.7, 1.4, 0.05],
      ]],
      ['g_features', [
        ['difficulty', 'select', ['easy', 'normal', 'hard'].map(v => [v, t('d_' + v)])],
        ['f_slot', 'toggle'], ['slotFast', 'toggle'], ['f_jp', 'toggle'], ['f_croon', 'toggle'], ['jpSkip', 'toggle'], ['f_sugoroku', 'toggle'], ['f_events', 'toggle'], ['f_plinko', 'toggle'], ['f_bonusZone', 'toggle'], ['f_items', 'toggle'], ['f_gems', 'toggle'], ['f_fever', 'toggle'], ['f_walls', 'toggle'],
        ['sideLoss', 'toggle'], ['f_combo', 'toggle'], ['f_missions', 'toggle'], ['f_login', 'toggle'], ['f_regen', 'toggle'],
        ['f_achievePopups', 'toggle'], ['f_floatText', 'toggle'], ['f_hints', 'toggle'],
      ]],
      ['g_access', [['reduceMotion', 'toggle'], ['highContrast', 'toggle'], ['cbSymbols', 'toggle']]],
      ['g_lang', [['lang', 'select', [['auto', 'Auto'], ['ja', '日本語'], ['en', 'English']]]]],
    ];
  }

  tab_settings(body) {
    const s = this.s;
    let html = '';
    for (const [gk, items] of this.settingsSchema()) {
      html += `<h3>${t(gk)}</h3><div class="set">`;
      for (const [key, type, a, b, c] of items) {
        const label = (type === 'select' && b) ? b : t('s_' + key);
        let ctl = '';
        if (type === 'toggle') ctl = `<label class="sw"><input type="checkbox" data-k="${key}" ${s[key] ? 'checked' : ''}><i></i></label>`;
        else if (type === 'select') ctl = `<select data-k="${key}">${a.map(([v, n]) => `<option value="${v}" ${String(s[key]) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
        else if (type === 'range') ctl = `<input type="range" data-k="${key}" min="${a}" max="${b}" step="${c}" value="${s[key]}"><output>${s[key]}</output>`;
        html += `<div class="srow"><span>${esc(label)}</span><span class="ctl">${ctl}</span></div>`;
      }
      html += '</div>';
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-k]').forEach(el => {
      const key = el.dataset.k;
      const ev = el.type === 'range' ? 'input' : 'change';
      el.addEventListener(ev, () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'range') { v = parseFloat(v); el.nextElementSibling.textContent = v; }
        else if (typeof s[key] === 'number') v = parseFloat(v);
        s[key] = v;
        this.o.onSettings(key);
        if (key === 'lang') { setLang(v); this.refreshTexts(); this.renderTabs(); this.renderTab(); }
        if (key === 'quality') this.renderTab();
      });
    });
  }

  tab_data(body) {
    body.innerHTML = `
      <h3>${t('exportTitle')}</h3>
      <label class="chk"><input type="checkbox" id="dBoard" checked> ${t('includeBoard')}</label>
      <textarea id="dCode" readonly rows="3"></textarea>
      <div class="row wrap">
        <button class="btn primary" id="dCopy">${t('copy')}</button>
        <button class="btn" id="dDown">${t('download')}</button>
        <button class="btn" id="dShare">${t('share')}</button>
        <button class="btn" id="dQr">${t('qr')}</button>
      </div>
      <div id="dQrBox" class="qr hidden"></div>
      <h3>${t('importCode')}</h3>
      <textarea id="dIn" rows="3" placeholder="${t('paste')}"></textarea>
      <div class="row wrap">
        <button class="btn primary" id="dImp">${t('importCode')}</button>
        <label class="btn">${t('importFile')}<input type="file" id="dFile" accept=".json,.txt,application/json,text/plain" hidden></label>
      </div>
      <h3>${t('data')}</h3>
      <div class="row wrap">
        <button class="btn" id="dBackup">${t('restoreBackup')}</button>
        <button class="btn warn" id="dResetBoard">${t('resetBoard')}</button>
        <button class="btn danger" id="dReset">${t('resetAll')}</button>
      </div>`;
    const code = $('#dCode', body);
    const gen = async () => { code.value = '…'; code.value = await this.o.onExport($('#dBoard', body).checked); };
    gen();
    $('#dBoard', body).onchange = gen;
    $('#dCopy', body).onclick = async () => { try { await navigator.clipboard.writeText(code.value); } catch (e) { code.select(); document.execCommand('copy'); } this.toast('📋', t('copied')); };
    $('#dDown', body).onclick = () => {
      const blob = new Blob([JSON.stringify({ app: 'medal-pusher', code: code.value, at: new Date().toISOString() }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pusher-save-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const shareUrl = async () => { const c = await this.o.onExport(false); return `${location.origin}${location.pathname}#save=${c}`; };
    $('#dShare', body).onclick = async () => {
      const url = await shareUrl();
      if (navigator.share) { try { await navigator.share({ title: 'Medal Pusher', text: t('exportTitle'), url }); return; } catch (e) { /* cancelled */ } }
      try { await navigator.clipboard.writeText(url); this.toast('🔗', t('copied')); } catch (e) { code.value = url; }
    };
    $('#dQr', body).onclick = async () => {
      const box = $('#dQrBox', body);
      const url = await shareUrl();
      try {
        const qr = qrcode(0, 'L'); qr.addData(url); qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) + `<p class="note">${t('qrNote')}</p>`;
      } catch (e) { box.innerHTML = `<p class="note">QR too large</p>`; }
      box.classList.toggle('hidden');
    };
    $('#dImp', body).onclick = () => this.o.onImport($('#dIn', body).value);
    $('#dFile', body).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const txt = await f.text();
      let c = txt; try { const j = JSON.parse(txt); if (j.code) c = j.code; } catch (_) {}
      this.o.onImport(c);
    };
    $('#dBackup', body).onclick = () => { const b = readBackup(); if (!b) { this.toast('⚠', '-'); return; } this.confirm(`${t('restoreBackup')} (${new Date(b.at).toLocaleString()})`, () => this.o.onRestoreBackup(b)); };
    $('#dResetBoard', body).onclick = () => this.confirm(t('resetBoardConfirm'), () => this.o.onResetBoard());
    $('#dReset', body).onclick = () => this.confirm(t('resetConfirm'), () => this.o.onResetAll());
  }
}

export { exportCode, importCode, TOKEN_STYLE };
