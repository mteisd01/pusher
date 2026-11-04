// Persistence, export/import and share codes.
import { B } from './game/balance.js';

const KEY = 'pusher.save.v1';
const BOARD_KEY = 'pusher.board.v1';
const BACKUP_KEY = 'pusher.backup.v1';

export const DEFAULT_SETTINGS = {
  lang: 'auto',
  quality: 'auto', resScale: 1, shadows: true, shadowRes: 2048, bloom: true, reflections: true, particles: 1, maxFps: 0, showFps: false,
  tableSize: 'wide', coinDetail: 'high', camera: 'standard', fov: 42, shake: true, leds: true, antialias: true, theme: 'casino',
  coinReflect: 1, post: true, roomDetail: 'full', physHz: 60, maxObjects: 900, prefill: 520, worker: true, pauseOnMenu: true, ambience: 0.25,
  master: 0.8, bgm: 0.45, se: 0.8, muteHidden: true,
  autoDrop: false, autoMode: 'follow', holdRepeat: true, vibrate: true, leftHand: false, uiScale: 1, dropButton: true, showBeam: true,
  f_slot: true, f_jp: true, f_items: true, f_fever: true, f_walls: true, f_combo: true, f_missions: true, f_achievePopups: true,
  f_sugoroku: true, f_events: true, f_plinko: true, f_bonusZone: true, f_croon: true, f_tower3d: true, towerCam: true, f_hopper: true, f_wheel: true, f_catcher: true, f_mechReels: true, f_beacons: true,
  f_regen: true, f_login: true, f_gems: true, f_floatText: true, f_hints: true, sideLoss: true, difficulty: 'normal', slotFast: false, jpSkip: true,
  reduceMotion: false, highContrast: false, cbSymbols: false,
};

export const QUALITY_PRESETS = {
  low: { post: false, roomDetail: 'simple', resScale: 0.7, shadows: false, shadowRes: 1024, bloom: false, reflections: true, particles: 0.4, coinDetail: 'low', maxObjects: 750, physHz: 60, antialias: false },
  medium: { post: true, roomDetail: 'simple', resScale: 0.85, shadows: true, shadowRes: 1024, bloom: false, reflections: true, particles: 0.7, coinDetail: 'medium', maxObjects: 850, physHz: 60 },
  high: { post: true, roomDetail: 'full', resScale: 1, shadows: true, shadowRes: 2048, bloom: true, reflections: true, particles: 1, coinDetail: 'high', maxObjects: 1000, physHz: 60 },
  ultra: { post: true, roomDetail: 'full', resScale: 1, shadows: true, shadowRes: 4096, bloom: true, reflections: true, particles: 1.4, coinDetail: 'ultra', maxObjects: 1400, physHz: 60 },
};

export function detectQuality() {
  const mobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}

export function newSave() {
  const now = Date.now();
  return {
    v: 1,
    coins: B.startCoins,
    xp: 0, level: 1,
    jpPool: B.jp.base,
    stock: 0,
    upgrades: {},
    stats: {},
    achievements: {},
    gems: {},
    gemSets: {},
    missions: null,
    login: { last: '', streak: 0, total: 0 },
    settings: { ...DEFAULT_SETTINGS },
    lastSeen: now,
    regenAcc: 0,
    created: now,
    tutorial: 0,
  };
}

function sanitize(s) {
  const base = newSave();
  if (!s || typeof s !== 'object') return base;
  const out = { ...base, ...s };
  out.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  for (const k of ['upgrades', 'stats', 'achievements', 'gems', 'gemSets']) out[k] = (s[k] && typeof s[k] === 'object') ? s[k] : {};
  out.login = { ...base.login, ...(s.login || {}) };
  for (const k of ['coins', 'xp', 'level', 'jpPool', 'stock']) if (!Number.isFinite(out[k])) out[k] = base[k];
  out.coins = Math.max(0, Math.floor(out.coins));
  out.level = Math.max(1, Math.floor(out.level));
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch (e) { console.warn('save load failed', e); }
  return newSave();
}

export function storeSave(save) {
  try { save.lastSeen = Date.now(); localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
}

const bk = size => `${BOARD_KEY}.${size || 'wide'}`;
export function loadBoard(size) {
  try { const r = localStorage.getItem(bk(size)); return r ? decodeBoard(r) : null; } catch (e) { return null; }
}
export function storeBoard(snap, size) {
  try { localStorage.setItem(bk(size), encodeBoard(snap)); } catch (e) { /* quota */ }
}
export function clearBoard(size) { try { localStorage.removeItem(bk(size)); } catch (e) {} }

// ---- Board snapshot <-> compact base64 (int16 quantization) ----
export function encodeBoard(snap) {
  const n = snap.objs.length;
  const buf = new ArrayBuffer(4 + n * 16);
  const dv = new DataView(buf);
  dv.setUint16(0, n, true);
  dv.setUint16(2, Math.round((snap.phase || 0) * 65535), true);
  let o = 4;
  for (const a of snap.objs) {
    dv.setUint8(o, a[0]); dv.setUint8(o + 1, a[1]);
    dv.setInt16(o + 2, Math.round(a[2] * 1000), true);
    dv.setInt16(o + 4, Math.round(a[3] * 1000), true);
    dv.setInt16(o + 6, Math.round(a[4] * 1000), true);
    for (let k = 0; k < 4; k++) dv.setInt16(o + 8 + k * 2, Math.round(Math.max(-1, Math.min(1, a[5 + k])) * 32767), true);
    o += 16;
  }
  return b64(new Uint8Array(buf));
}
export function decodeBoard(str) {
  const u = unb64(str);
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const n = dv.getUint16(0, true);
  if (u.length < 4 + n * 16) return null;
  const objs = [];
  let o = 4;
  for (let i = 0; i < n; i++, o += 16) {
    const q = [0, 1, 2, 3].map(k => dv.getInt16(o + 8 + k * 2, true) / 32767);
    const ql = Math.hypot(...q) || 1;
    objs.push([dv.getUint8(o), dv.getUint8(o + 1), dv.getInt16(o + 2, true) / 1000, dv.getInt16(o + 4, true) / 1000, dv.getInt16(o + 6, true) / 1000, q[0] / ql, q[1] / ql, q[2] / ql, q[3] / ql]);
  }
  return { phase: dv.getUint16(2, true) / 65535, objs };
}

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const toUrl = s => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrl = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };

function crc32(u8) {
  let c, crc = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) {
    c = (crc ^ u8[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

async function deflate(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate-raw');
  const out = new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(await out);
}
async function inflate(u8) {
  const ds = new DecompressionStream('deflate-raw');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
}

/** Export: 'PSH1.' + base64url(deflate(json)) + '.' + crc  (PSH0 = uncompressed) */
export async function exportCode(save, board) {
  const payload = { s: { ...save }, b: board ? encodeBoard(board) : undefined };
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  const z = await deflate(raw);
  const body = z || raw;
  return `${z ? 'PSH1' : 'PSH0'}.${toUrl(b64(body))}.${crc32(body)}`;
}

export async function importCode(code) {
  code = (code || '').trim().replace(/\s+/g, '');
  const m = code.match(/(PSH[01])\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})/);
  if (!m) throw new Error('format');
  const body = unb64(fromUrl(m[2]));
  if (crc32(body) !== m[3]) throw new Error('checksum');
  const raw = m[1] === 'PSH1' ? await inflate(body) : body;
  const payload = JSON.parse(new TextDecoder().decode(raw));
  if (!payload || !payload.s || payload.s.v !== 1) throw new Error('version');
  return { save: sanitize(payload.s), board: payload.b ? decodeBoard(payload.b) : null };
}

export function backup(save) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ save, board: localStorage.getItem(bk(save.settings && save.settings.tableSize)), at: Date.now() })); } catch (e) {}
}
export function readBackup() {
  try { const r = localStorage.getItem(BACKUP_KEY); if (!r) return null; const o = JSON.parse(r); return { save: sanitize(o.save), board: o.board ? decodeBoard(o.board) : null, at: o.at }; } catch (e) { return null; }
}
export function wipeAll(keepSettings) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('pusher.') && k !== BACKUP_KEY) localStorage.removeItem(k);
    if (keepSettings) { const n = newSave(); n.settings = { ...DEFAULT_SETTINGS, ...keepSettings }; n._qualityApplied = true; localStorage.setItem(KEY, JSON.stringify(n)); }
  } catch (e) {}
}
