// Procedural PBR materials for the cabinet and the arcade room (no external assets).
// Every texture is generated once per theme from canvases: hairline steel, metallic
// flake paint, printed side art under clear coat, speaker grilles, arcade carpet, etc.
import * as THREE from 'three';
import { rng } from './textures.js';

const TAU = Math.PI * 2;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function toTex(c, srgb, repeat, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// height field -> tangent-space normal map canvas (wraps both ways: tileable)
function normalCanvas(hf, w, h, strength) {
  const c = cv(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => hf[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1);
    const nx = -dx * strength, ny = dy * strength, l = Math.hypot(nx, ny, 1);
    const i = (y * w + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function grayCanvas(hf, w, h, map) {
  const c = cv(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, map(hf[i]) * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

const cache = {};
function once(key, f) { return cache[key] || (cache[key] = f()); }

// Brushed ("hairline") stainless: long streaks along X
export function hairlineMaps(size = 512) {
  return once('hair' + size, () => {
    const r = rng(11), hf = new Float32Array(size * size);
    const rows = new Float32Array(size);
    for (let y = 0; y < size; y++) rows[y] = r();
    for (let k = 0; k < size * 3; k++) { // long streaks of varying length
      const y = (r() * size) | 0, x0 = (r() * size) | 0, len = 20 + r() * size, v = (r() - 0.5) * 0.9;
      for (let x = 0; x < len; x++) hf[y * size + ((x0 + x) % size)] += v;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hf[y * size + x] += rows[y] * 0.6 + r() * 0.15;
    return {
      normal: toTex(normalCanvas(hf, size, size, 0.6), false, true),
      rough: toTex(grayCanvas(hf, size, size, v => 0.62 + v * 0.12), false, true),
    };
  });
}

// Worn field plate: fine hairline + random swirl scratches from years of coins
export function wornPlateMaps(size = 1024) {
  return once('worn' + size, () => {
    const r = rng(21);
    const c = cv(size, size), g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 1) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`; g.fillRect(0, y, size, 1); }
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = r() * size, y = r() * size, rad = 10 + r() * 120, a0 = r() * TAU, sweep = 0.2 + r() * 1.2;
      g.strokeStyle = `rgba(${r() < 0.6 ? '255,255,255' : '20,20,20'},${0.05 + r() * 0.18})`; g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath(); g.arc(x, y, rad, a0, a0 + sweep); g.stroke();
    }
    // smudges (rougher patches where hands/coins rub)
    for (let i = 0; i < 40; i++) {
      const x = r() * size, y = r() * size, rad = 30 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${0.04 + r() * 0.08})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const d = g.getImageData(0, 0, size, size).data, hf = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) hf[i] = d[i * 4] / 255;
    return {
      normal: toTex(normalCanvas(hf, size, size, 1.6), false, true),
      rough: toTex(grayCanvas(hf, size, size, v => 0.18 + v * 0.42), false, true),
    };
  });
}

// Metallic flake for car-paint like lacquer
export function flakeNormal(size = 256) {
  return once('flake' + size, () => {
    const r = rng(31), c = cv(size, size), g = c.getContext('2d');
    const img = g.createImageData(size, size), d = img.data;
    for (let i = 0; i < size * size; i++) {
      const nx = (r() - 0.5) * 0.5, ny = (r() - 0.5) * 0.5, l = Math.hypot(nx, ny, 1);
      d[i * 4] = (nx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTex(c, false, true);
  });
}

// Perforated speaker grille: color + normal
export function grilleMaps(size = 256) {
  return once('grille' + size, () => {
    const c = cv(size, size), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    const s = size / 16;
    for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { g.beginPath(); g.arc(x * s + (y % 2) * s / 2, y * s * 0.87, s * 0.3, 0, TAU); g.fill(); }
    const d = g.getImageData(0, 0, size, size).data, hf = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) hf[i] = d[i * 4] / 255;
    const col = cv(size, size), cg = col.getContext('2d');
    cg.drawImage(c, 0, 0); cg.globalCompositeOperation = 'multiply'; cg.fillStyle = '#3a3a40'; cg.fillRect(0, 0, size, size);
    return { map: toTex(col, true, true), normal: toTex(normalCanvas(hf, size, size, 2.5), false, true) };
  });
}

// Classic arcade carpet: dark base with scattered neon shapes (blacklight style)
export function carpetMaps(theme, size = 1024) {
  return once('carpet' + theme.id, () => {
    const r = rng(41), c = cv(size, size), g = c.getContext('2d');
    g.fillStyle = shade(theme.bgBottom, 1.6); g.fillRect(0, 0, size, size);
    const cols = [...theme.led, theme.accent, '#2b2bff', '#ff3d7f'];
    const wrapDraw = (x, y, f) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { g.save(); g.translate(x + ox, y + oy); f(); g.restore(); } };
    for (let i = 0; i < 260; i++) {
      const x = r() * size, y = r() * size, s = 8 + r() * 30, col = cols[(r() * cols.length) | 0], kind = (r() * 5) | 0, rot = r() * TAU;
      g.globalAlpha = 0.35 + r() * 0.4;
      wrapDraw(x, y, () => {
        g.rotate(rot); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 3;
        if (kind === 0) { g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.stroke(); }
        else if (kind === 1) { g.beginPath(); g.moveTo(-s, 0); for (let k = 0; k < 6; k++) g.quadraticCurveTo(-s + (k + 0.5) * s / 3, (k % 2 ? 1 : -1) * s * 0.4, -s + (k + 1) * s / 3, 0); g.stroke(); }
        else if (kind === 2) { g.beginPath(); g.moveTo(0, -s * 0.6); g.lineTo(s * 0.5, s * 0.4); g.lineTo(-s * 0.5, s * 0.4); g.closePath(); g.stroke(); }
        else if (kind === 3) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? s * 0.22 : s * 0.5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
        else { g.fillRect(-s * 0.08, -s * 0.5, s * 0.16, s); }
      });
    }
    g.globalAlpha = 1;
    // pile noise
    const id = g.getImageData(0, 0, size, size), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
    return toTex(c, true, true, 16);
  });
}

// Printed side art for panels (theme pattern + sweeping light rays + logo)
export function panelArt(theme, w, h, opts = {}) {
  const key = `art${theme.id}${w}x${h}${opts.logo ? 1 : 0}${opts.seed || 0}`;
  return once(key, () => {
    const r = rng(51 + (opts.seed || 0)), c = cv(w, h), g = c.getContext('2d');
    const base = theme.cabinet;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, shade(base, 1.35)); gr.addColorStop(0.55, base); gr.addColorStop(1, shade(base, 0.45));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // sunburst rays
    g.save(); g.translate(w / 2, h * 1.1); g.globalAlpha = 0.12;
    for (let i = 0; i < 28; i++) { g.rotate(TAU / 28); g.fillStyle = i % 2 ? theme.trim : '#ffffff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-w * 0.06, -h * 2); g.lineTo(w * 0.06, -h * 2); g.closePath(); g.fill(); }
    g.restore();
    // theme motif
    g.globalAlpha = 0.35;
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, s = 6 + r() * h * 0.08;
      g.fillStyle = theme.led[i % theme.led.length];
      if (theme.cabinetKind === 'sakura') { for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.5, s * 0.28, a, 0, TAU); g.fill(); } }
      else if (theme.cabinetKind === 'wave') { g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); for (let x2 = -s * 2; x2 <= s * 2; x2 += 4) g.lineTo(x + x2, y + Math.sin(x2 / s * 3) * s * 0.3); g.stroke(); }
      else if (theme.cabinetKind === 'stars' || theme.cabinetKind === 'grid') { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? s * 0.2 : s * 0.5; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(x, y, s * 0.35, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    // pin stripes
    g.fillStyle = theme.trim;
    g.fillRect(0, h * 0.06, w, Math.max(2, h * 0.012)); g.fillRect(0, h * 0.92, w, Math.max(2, h * 0.012));
    if (opts.logo) {
      g.save(); g.translate(w / 2, h / 2);
      const fs = Math.min(h * 0.5, w / Math.max(4, (theme.logo || 'PUSHER').length) * 1.2);
      g.font = `900 ${fs}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = fs * 0.12; g.strokeStyle = shade(base, 0.3); g.strokeText(theme.logo || 'PUSHER', 0, 0);
      const tg = g.createLinearGradient(0, -fs / 2, 0, fs / 2); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, theme.trim); tg.addColorStop(1, shade(theme.trim, 0.6));
      g.fillStyle = tg; g.fillText(theme.logo || 'PUSHER', 0, 0);
      g.restore();
    }
    return toTex(c, true, false);
  });
}

// Back-lit acrylic marquee (topper sign) -> emissive map
export function marqueeArt(theme, w = 1024, h = 256) {
  return once('marq' + theme.id, () => {
    const c = cv(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, shade(theme.accent, 0.35)); gr.addColorStop(0.5, shade(theme.cabinet, 0.9)); gr.addColorStop(1, shade(theme.accent, 0.3));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.25; g.fillStyle = '#fff';
    for (let i = 0; i < 18; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate(i / 18 * TAU); g.fillRect(0, -6, w, 12); g.restore(); }
    g.globalAlpha = 1;
    const txt = `MEDAL PUSHER · ${theme.logo || ''}`;
    g.font = `900 ${h * 0.42}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = h * 0.06; g.strokeStyle = '#000'; g.strokeText(txt, w / 2, h / 2, w * 0.92);
    const tg = g.createLinearGradient(0, h * 0.25, 0, h * 0.75); tg.addColorStop(0, '#fff'); tg.addColorStop(1, theme.accent);
    g.fillStyle = tg; g.fillText(txt, w / 2, h / 2, w * 0.92);
    return toTex(c, true, false);
  });
}

// Glowing screen content for the neighbouring machines in the room (pre-blurred = "bokeh")
export function neighborScreen(theme, seed, w = 256, h = 160) {
  return once(`nb${theme.id}${seed}`, () => {
    const r = rng(61 + seed), c = cv(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, theme.led[seed % theme.led.length]); gr.addColorStop(1, ['#2030ff', '#ff3070', '#20ffa0', '#ffb020'][seed % 4]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 26, 0, TAU); g.fill(); }
    g.filter = 'blur(6px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    return toTex(c, true, false);
  });
}

export function shade(hex, k) {
  const c = new THREE.Color(hex);
  if (k > 1) c.lerp(new THREE.Color('#ffffff'), Math.min(1, k - 1)); else c.multiplyScalar(k);
  return '#' + c.getHexString();
}

// Material set for a theme
export function makeMaterials(theme) {
  const hair = hairlineMaps();
  const flake = flakeNormal();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd9dde3, metalness: 1, roughness: 1, roughnessMap: hair.rough, normalMap: hair.normal, normalScale: new THREE.Vector2(0.25, 0.25), anisotropy: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f2f6, metalness: 1, roughness: 0.08 });
  const trim = new THREE.MeshPhysicalMaterial({ color: theme.trim, metalness: 1, roughness: 0.55, roughnessMap: hair.rough, normalMap: hair.normal, normalScale: new THREE.Vector2(0.2, 0.2), anisotropy: 0.5 });
  const paint = new THREE.MeshPhysicalMaterial({ color: theme.cabinet, metalness: 0.55, roughness: 0.42, normalMap: flake, normalScale: new THREE.Vector2(0.12, 0.12), clearcoat: 1, clearcoatRoughness: 0.05 });
  const blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0.1, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x121214, metalness: 0, roughness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: theme.glass, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.13, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
  const glassEdge = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.glass).multiplyScalar(0.8), transparent: true, opacity: 0.55, depthWrite: false });
  for (const t of [hair.normal, hair.rough]) t.repeat.set(4, 1);
  flake.repeat.set(8, 8);
  return { steel, chrome, trim, paint, blackGloss, rubber, glass, glassEdge };
}
