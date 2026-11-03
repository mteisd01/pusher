// Procedural, photo-real-ish textures generated at runtime (no external assets).
import * as THREE from 'three';

const TAU = Math.PI * 2;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Separable box blur on a Float32 height field (repeated = ~gaussian)
function blur(src, w, h, r, passes = 2) {
  let a = src, b = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1);
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

function readHeight(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4] / 255;
  return out;
}

function normalFromHeight(hf, w, h, strength, wrapX = false) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => {
    if (wrapX) x = (x + w) % w; else x = Math.min(w - 1, Math.max(0, x));
    y = Math.min(h - 1, Math.max(0, y));
    return hf[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const i = (y * w + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255;
    d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    d[i + 2] = (nz / l * 0.5 + 0.5) * 255;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, srgb, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = opts.aniso || 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

function starPath(ctx, cx, cy, ro, ri, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

// Faceted star: each point has two triangular facets with different heights
function facetStar(ctx, cx, cy, ro, ri, n = 5, top = 1, low = 0.55) {
  const rot = -Math.PI / 2;
  for (let i = 0; i < n * 2; i++) {
    const a0 = rot + i * Math.PI / n, a1 = rot + (i + 1) * Math.PI / n;
    const r0 = i % 2 ? ri : ro, r1 = (i + 1) % 2 ? ri : ro;
    const g = ctx.createLinearGradient(cx, cy, cx + Math.cos((a0 + a1) / 2) * ro, cy + Math.sin((a0 + a1) / 2) * ro);
    const shade = i % 2 ? 0.92 : 0.78;
    g.addColorStop(0, gray(top));
    g.addColorStop(1, gray(low + (top - low) * (1 - shade) * 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
    ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    ctx.closePath();
    ctx.fill();
  }
}

function gray(v) { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; }

function arcText(ctx, text, cx, cy, r, start, spread, size, inward = false) {
  ctx.save();
  ctx.font = `bold ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...text];
  const step = spread / Math.max(1, chars.length - 1);
  chars.forEach((ch, i) => {
    const a = start + (inward ? -1 : 1) * step * i;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + (inward ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function crown(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.55);
  ctx.lineTo(cx - s * 1.05, cy - s * 0.45);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.05);
  ctx.lineTo(cx, cy - s * 0.75);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.05);
  ctx.lineTo(cx + s * 1.05, cy - s * 0.45);
  ctx.lineTo(cx + s, cy + s * 0.55);
  ctx.closePath();
}

function diamondShape(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s * 0.25);
  ctx.lineTo(cx - s * 0.55, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.55, cy - s * 0.7);
  ctx.lineTo(cx + s, cy - s * 0.25);
  ctx.lineTo(cx, cy + s * 0.9);
  ctx.closePath();
}

// Seeded random for stable textures
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

/**
 * Coin face textures. design: 'silver' | 'gold' | 'rainbow' | 'big' | 'token'
 * Returns { map, normalMap, roughnessMap }
 */
export function makeCoinFace(design, size = 512, opts = {}) {
  const S = size, cx = S / 2, cy = S / 2, R = S / 2;
  const hc = canvas(S, S), h = hc.getContext('2d');
  // --- height map ---
  h.fillStyle = gray(0.32); h.fillRect(0, 0, S, S);
  // shallow dish: field slightly lower towards center
  const dish = h.createRadialGradient(cx, cy, 0, cx, cy, R * 0.86);
  dish.addColorStop(0, gray(0.26)); dish.addColorStop(1, gray(0.34));
  h.fillStyle = dish; h.beginPath(); h.arc(cx, cy, R * 0.86, 0, TAU); h.fill();
  // raised rim with soft inner bevel
  h.lineWidth = R * 0.12;
  const rg = h.createRadialGradient(cx, cy, R * 0.84, cx, cy, R);
  rg.addColorStop(0, gray(0.4)); rg.addColorStop(0.2, gray(0.82)); rg.addColorStop(0.9, gray(0.86)); rg.addColorStop(1, gray(0.7));
  h.strokeStyle = rg; h.beginPath(); h.arc(cx, cy, R * 0.93, 0, TAU); h.stroke();
  // beaded inner ring
  h.fillStyle = gray(0.62);
  const beads = design === 'big' ? 72 : 60;
  for (let i = 0; i < beads; i++) {
    const a = i / beads * TAU;
    h.beginPath(); h.arc(cx + Math.cos(a) * R * 0.815, cy + Math.sin(a) * R * 0.815, R * 0.018, 0, TAU); h.fill();
  }
  h.strokeStyle = gray(0.55); h.lineWidth = R * 0.012;
  h.beginPath(); h.arc(cx, cy, R * 0.58, 0, TAU); h.stroke();

  h.fillStyle = gray(0.66);
  const tsize = R * 0.13;
  const label = {
    silver: ['PUSHER', 'MEDAL'], gold: ['GOLDEN', 'MEDAL'], rainbow: ['RAINBOW', 'MEDAL'],
    big: ['BIG', 'MEDAL'], token: ['', ''],
  }[design] || ['', ''];
  if (label[0]) arcText(h, label[0], cx, cy, R * 0.695, -Math.PI / 2 - 0.12 * (label[0].length - 1) / 2 * 1.9, 0.228 * (label[0].length - 1), tsize);
  if (label[1]) arcText(h, label[1], cx, cy, R * 0.695, Math.PI / 2 + 0.11 * (label[1].length - 1) * 0.95, 0.21 * (label[1].length - 1), tsize, true);
  // small stars at sides
  for (const s of [-1, 1]) { h.fillStyle = gray(0.65); starPath(h, cx + s * R * 0.695, cy, R * 0.045, R * 0.02); h.fill(); }

  // center emblem
  if (design === 'silver') {
    facetStar(h, cx, cy, R * 0.45, R * 0.19, 5, 0.98, 0.5);
  } else if (design === 'gold') {
    h.fillStyle = gray(0.78); crown(h, cx, cy + R * 0.02, R * 0.36); h.fill();
    h.fillStyle = gray(0.95);
    for (const [dx, dy] of [[-1.05, -0.45], [0, -0.75], [1.05, -0.45]]) { h.beginPath(); h.arc(cx + dx * R * 0.36, cy + R * 0.02 + dy * R * 0.36, R * 0.045, 0, TAU); h.fill(); }
    h.fillStyle = gray(0.55); h.fillRect(cx - R * 0.36, cy + R * 0.25, R * 0.72, R * 0.08);
  } else if (design === 'rainbow') {
    facetStar(h, cx, cy, R * 0.44, R * 0.3, 8, 0.98, 0.52);
  } else if (design === 'big') {
    h.font = `900 ${R * 0.62}px "Arial Black", Arial, sans-serif`;
    h.textAlign = 'center'; h.textBaseline = 'middle';
    const g = h.createLinearGradient(0, cy - R * 0.3, 0, cy + R * 0.3);
    g.addColorStop(0, gray(0.95)); g.addColorStop(1, gray(0.7));
    h.fillStyle = g; h.fillText('30', cx, cy + R * 0.04);
  } else if (design === 'token') {
    h.fillStyle = gray(0.2); h.beginPath(); h.arc(cx, cy, R * 0.57, 0, TAU); h.fill();
  }
  let hf = readHeight(hc);
  hf = blur(hf, S, S, Math.max(1, Math.round(S / 400)), 2);
  // micro surface noise
  const rnd = rng(design.length * 977 + 13);
  for (let i = 0; i < hf.length; i++) hf[i] += (rnd() - 0.5) * 0.006;

  const normal = normalFromHeight(hf, S, S, design === 'big' ? 2.4 : 1.9);

  // --- albedo (grayscale detail, tinted by material color) & roughness ---
  const ac = canvas(S, S), a = ac.getContext('2d');
  const rc = canvas(S, S), r = rc.getContext('2d');
  const ai = a.createImageData(S, S), ri = r.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) / R;
    const hv = hf[i];
    // lathe marks: concentric fine rings in the recessed field
    const lathe = 0.5 + 0.5 * Math.sin(d * 420 + Math.sin(Math.atan2(dy, dx) * 3) * 0.3);
    const ao = 0.7 + 0.3 * Math.min(1, hv * 1.6);
    let alb = ao * (0.93 + lathe * 0.05);
    let rough = 0.32 - (hv - 0.35) * 0.35 + lathe * 0.05;
    if (d > 0.995) { alb *= 0.6; rough = 0.5; }
    alb = Math.min(1, alb);
    ai.data[i * 4] = ai.data[i * 4 + 1] = ai.data[i * 4 + 2] = alb * 255; ai.data[i * 4 + 3] = 255;
    const rv = Math.max(0.05, Math.min(0.9, rough)) * 255;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = rv; ri.data[i * 4 + 3] = 255;
  }
  a.putImageData(ai, 0, 0);
  r.putImageData(ri, 0, 0);
  // scratches & tarnish
  r.globalAlpha = 0.25; a.globalAlpha = 0.08;
  for (let k = 0; k < 60; k++) {
    const x0 = rnd() * S, y0 = rnd() * S, ang = rnd() * TAU, len = 10 + rnd() * S * 0.3;
    r.strokeStyle = rnd() < 0.5 ? '#fff' : '#000'; r.lineWidth = 0.6 + rnd();
    r.beginPath(); r.moveTo(x0, y0); r.quadraticCurveTo(x0 + Math.cos(ang + 0.3) * len / 2, y0 + Math.sin(ang + 0.3) * len / 2, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); r.stroke();
  }
  for (let k = 0; k < 30; k++) {
    a.fillStyle = '#000';
    a.beginPath(); a.arc(rnd() * S, rnd() * S, 2 + rnd() * 18, 0, TAU); a.fill();
  }
  a.globalAlpha = 1; r.globalAlpha = 1;
  // enamel insert for tokens is drawn by makeTokenFace
  return {
    map: tex(ac, true), normalMap: tex(normal, false), roughnessMap: tex(rc, false),
    height: hf,
  };
}

// Reeded edge (side band) — tileable horizontally
export function makeCoinEdge(reeds = 90, w = 1024, h = 32) {
  const hf = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 0.5 + 0.5 * Math.cos(x / w * reeds * TAU);
    const edge = Math.min(1, Math.min(y, h - 1 - y) / 4);
    hf[y * w + x] = v * 0.6 * edge + 0.2;
  }
  const n = normalFromHeight(hf, w, h, 3.0, true);
  const rc = canvas(w, h), r = rc.getContext('2d');
  r.fillStyle = gray(0.3); r.fillRect(0, 0, w, h);
  const t = tex(n, false, { repeat: true });
  const rt = tex(rc, false, { repeat: true });
  return { normalMap: t, roughnessMap: rt };
}

// Colored enamel token face (rendered as albedo, untinted)
export function makeTokenFace(base, color, icon, label) {
  const S = 512, cx = S / 2, cy = S / 2, R = S / 2;
  const c = canvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const map = base.map.image;
  g.drawImage(map, 0, 0);
  // enamel center
  const eg = g.createRadialGradient(cx - R * 0.15, cy - R * 0.2, R * 0.05, cx, cy, R * 0.6);
  eg.addColorStop(0, shade(color, 1.35)); eg.addColorStop(0.7, color); eg.addColorStop(1, shade(color, 0.6));
  g.fillStyle = eg; g.beginPath(); g.arc(cx, cy, R * 0.56, 0, TAU); g.fill();
  // rim gold tint ring
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#f4c95d'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.arc(cx, cy, R * 0.56, 0, TAU, true); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8;
  g.font = `900 ${R * (icon.length > 2 ? 0.26 : 0.42)}px "Arial Black", Arial, sans-serif`;
  g.fillText(icon, cx, cy - R * 0.06);
  g.font = `bold ${R * 0.11}px Arial, sans-serif`;
  g.fillText(label, cx, cy + R * 0.3);
  return tex(c, true);
  void img;
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return '#' + c.getHexString();
}

// JP ball texture (chrome with colored band & letters)
export function makeBallTexture() {
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e8e8ee'; g.fillRect(0, 0, W, H);
  const band = g.createLinearGradient(0, H * 0.36, 0, H * 0.64);
  band.addColorStop(0, '#7a0010'); band.addColorStop(0.5, '#e01b2f'); band.addColorStop(1, '#7a0010');
  g.fillStyle = band; g.fillRect(0, H * 0.36, W, H * 0.28);
  g.fillStyle = '#ffd34d'; g.font = `900 ${H * 0.22}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) g.fillText('JP', W * (i + 0.5) / 4, H * 0.505);
  return tex(c, true);
}

// Treasure chest texture
export function makeChestTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const rnd = rng(77);
  g.fillStyle = '#6b3a1a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(${40 + rnd() * 40},${20 + rnd() * 15},5,0.5)`; g.lineWidth = 1 + rnd() * 2;
    const y = rnd() * S; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S / 3, y + rnd() * 8 - 4, S * 2 / 3, y + rnd() * 8 - 4, S, y); g.stroke();
  }
  const gold = g.createLinearGradient(0, 0, 0, S);
  gold.addColorStop(0, '#fff2a8'); gold.addColorStop(0.5, '#d4a017'); gold.addColorStop(1, '#8a6200');
  g.fillStyle = gold;
  g.fillRect(0, 0, S, 18); g.fillRect(0, S - 18, S, 18); g.fillRect(0, 0, 18, S); g.fillRect(S - 18, 0, 18, S);
  g.fillRect(S * 0.42, 0, S * 0.16, S);
  g.fillStyle = '#3a2000'; g.fillRect(S * 0.46, S * 0.42, S * 0.08, S * 0.16);
  return tex(c, true);
}

// Generic seamless surface textures for the cabinet
export function makeSurfaceTexture(kind, colorA, colorB, size = 512, seed = 1) {
  const c = canvas(size, size), g = c.getContext('2d');
  const rnd = rng(seed);
  g.fillStyle = colorA; g.fillRect(0, 0, size, size);
  if (kind === 'plate') {
    // brushed steel plate with subtle diamond tread
    for (let y = 0; y < size; y++) {
      g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(0, y, size, 1);
    }
    g.strokeStyle = colorB; g.globalAlpha = 0.3; g.lineWidth = 2;
    const s = size / 8;
    for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + size, size); g.stroke(); g.beginPath(); g.moveTo(i * s, size); g.lineTo(i * s + size, 0); g.stroke(); }
    g.globalAlpha = 1;
  } else if (kind === 'felt') {
    const id = g.getImageData(0, 0, size, size);
    for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 22; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    g.putImageData(id, 0, 0);
  } else if (kind === 'wood') {
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = rnd() < 0.5 ? colorB : 'rgba(0,0,0,0.25)'; g.globalAlpha = 0.25 + rnd() * 0.3; g.lineWidth = 1 + rnd() * 3;
      const y = rnd() * size; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 4);
      g.stroke();
    }
    g.globalAlpha = 1;
  } else if (kind === 'grid') {
    g.strokeStyle = colorB; g.lineWidth = 2; g.globalAlpha = 0.7;
    const s = size / 8;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, size); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(size, i * s); g.stroke(); }
    g.globalAlpha = 1;
  } else if (kind === 'stars') {
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${rnd()})`; g.fillRect(rnd() * size, rnd() * size, rnd() < 0.9 ? 1 : 2, rnd() < 0.9 ? 1 : 2); }
  } else if (kind === 'wave') {
    g.strokeStyle = colorB; g.lineWidth = 3; g.globalAlpha = 0.35;
    for (let y = 0; y < size + 32; y += 32) { g.beginPath(); for (let x = 0; x <= size; x += 8) g.lineTo(x, y + Math.sin(x / size * TAU * 2) * 8); g.stroke(); }
    g.globalAlpha = 1;
  } else if (kind === 'sakura') {
    for (let i = 0; i < 40; i++) {
      const x = rnd() * size, y = rnd() * size, s = 6 + rnd() * 10;
      g.fillStyle = colorB; g.globalAlpha = 0.25 + rnd() * 0.3;
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + rnd(); g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.5, s * 0.28, a, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  const t = tex(c, true, { repeat: true });
  return t;
}

// Field floor print: lanes, arrows and the CHANCE zone at the front edge
export function makeFieldTexture(theme, w = 1024, h = 1024) {
  const c = canvas(w, h), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, theme.floorA); grad.addColorStop(1, theme.floorB);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const rnd = rng(5);
  // brushed texture
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.035})`; g.fillRect(0, y, w, 1); }
  g.strokeStyle = theme.floorLine; g.lineWidth = 3; g.globalAlpha = 0.45;
  for (let i = 1; i < 11; i++) { const x = i / 11 * w; g.setLineDash([18, 22]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.setLineDash([]);
  g.globalAlpha = 0.9;
  // chevrons toward the front
  g.fillStyle = theme.floorLine;
  for (let k = 0; k < 3; k++) {
    const y = h * (0.62 + k * 0.1);
    for (const x of [w * 0.2, w * 0.5, w * 0.8]) {
      g.globalAlpha = 0.25 + k * 0.15;
      g.beginPath(); g.moveTo(x - 30, y); g.lineTo(x, y + 26); g.lineTo(x + 30, y); g.lineTo(x + 30, y + 12); g.lineTo(x, y + 38); g.lineTo(x - 30, y + 12); g.closePath(); g.fill();
    }
  }
  g.globalAlpha = 1;
  // center logo
  g.save(); g.translate(w / 2, h * 0.38); g.globalAlpha = 0.18; g.fillStyle = theme.floorLine;
  starPath(g, 0, 0, 120, 50); g.fill();
  g.font = '900 64px "Arial Black", Arial'; g.textAlign = 'center'; g.fillText(theme.logo || 'PUSHER', 0, 180);
  g.restore();
  return tex(c, true, { aniso: 8 });
}

export function makeGlowSprite(color = '#fff', size = 128) {
  const c = canvas(size, size), g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, color); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return tex(c, true);
}

export function makeSparkleSprite(size = 128) {
  const c = canvas(size, size), g = c.getContext('2d'), m = size / 2;
  const r = g.createRadialGradient(m, m, 0, m, m, m);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.15, 'rgba(255,240,200,.8)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(m, 4); g.lineTo(m, size - 4); g.moveTo(4, m); g.lineTo(size - 4, m); g.stroke();
  return tex(c, true);
}

export { starPath, crown, diamondShape, rng };
