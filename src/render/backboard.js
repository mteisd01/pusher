// Slot / jackpot display drawn to a canvas used as a texture on the cabinet screen
import * as THREE from 'three';
import { starPath, diamondShape } from './textures.js';

const W = 1024, H = 512;

export function drawSymbol(g, id, x, y, s) {
  g.save();
  g.translate(x, y);
  switch (id) {
    case 0: { // 7
      g.font = `italic 900 ${s * 1.05}px "Arial Black", Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = s * 0.12; g.strokeStyle = '#ffd34d'; g.lineJoin = 'round';
      g.strokeText('7', 0, s * 0.04);
      const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#b00018');
      g.fillStyle = gr; g.fillText('7', 0, s * 0.04);
      break;
    }
    case 1: { // BAR
      const w = s * 0.95, h = s * 0.5;
      g.fillStyle = '#ffd34d'; roundRect(g, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 10); g.fill();
      g.fillStyle = '#151515'; roundRect(g, -w / 2, -h / 2, w, h, 8); g.fill();
      g.fillStyle = '#fff'; g.font = `900 ${s * 0.32}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('BAR', 0, 2);
      break;
    }
    case 2: { // bell
      const gr = g.createLinearGradient(-s / 2, 0, s / 2, 0); gr.addColorStop(0, '#b8860b'); gr.addColorStop(0.4, '#ffe680'); gr.addColorStop(1, '#a87400');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-s * 0.42, s * 0.28);
      g.quadraticCurveTo(-s * 0.36, -s * 0.05, -s * 0.28, -s * 0.22);
      g.quadraticCurveTo(0, -s * 0.62, s * 0.28, -s * 0.22);
      g.quadraticCurveTo(s * 0.36, -s * 0.05, s * 0.42, s * 0.28);
      g.closePath(); g.fill();
      g.fillRect(-s * 0.46, s * 0.24, s * 0.92, s * 0.08);
      g.beginPath(); g.arc(0, s * 0.38, s * 0.08, 0, Math.PI * 2); g.fill();
      break;
    }
    case 3: { // cherry
      g.strokeStyle = '#2e7d32'; g.lineWidth = s * 0.06; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-s * 0.2, s * 0.08); g.quadraticCurveTo(-s * 0.05, -s * 0.3, s * 0.15, -s * 0.38); g.stroke();
      g.beginPath(); g.moveTo(s * 0.2, s * 0.12); g.quadraticCurveTo(s * 0.2, -s * 0.2, s * 0.15, -s * 0.38); g.stroke();
      for (const [cx, cy] of [[-s * 0.2, s * 0.2], [s * 0.2, s * 0.24]]) {
        const gr = g.createRadialGradient(cx - s * 0.06, cy - s * 0.06, 2, cx, cy, s * 0.2); gr.addColorStop(0, '#ff8a8a'); gr.addColorStop(1, '#a3000f');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, s * 0.18, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 4: { // star
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, s * 0.5); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(1, '#ffb300');
      g.fillStyle = gr; starPath(g, 0, 0, s * 0.46, s * 0.2); g.fill();
      g.strokeStyle = '#a86b00'; g.lineWidth = 3; g.stroke();
      break;
    }
    case 5: { // JP ball
      const gr = g.createRadialGradient(-s * 0.12, -s * 0.14, 2, 0, 0, s * 0.42); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#c0c4cc'); gr.addColorStop(1, '#6b7078');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e01b2f'; g.fillRect(-s * 0.4, -s * 0.11, s * 0.8, s * 0.22);
      g.fillStyle = '#ffd34d'; g.font = `900 ${s * 0.2}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('JP', 0, 1);
      break;
    }
    case 6: { // gold coin
      const gr = g.createRadialGradient(-s * 0.1, -s * 0.12, 2, 0, 0, s * 0.42); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.7, '#e0a800'); gr.addColorStop(1, '#8a6200');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.38, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7a5600'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, s * 0.3, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#7a5600'; g.font = `900 ${s * 0.3}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('5', 0, 2);
      break;
    }
    case 7: { // rainbow gem
      const gr = g.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9'].forEach((c, i) => gr.addColorStop(i / 5, c));
      g.fillStyle = gr; diamondShape(g, 0, 0, s * 0.42); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.stroke();
      break;
    }
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export class Backboard {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.acc = 0;
    this.msg = null;
    this.time = 0;
  }

  message(text, color = '#fff', dur = 1.6, size = 96) { this.msg = { text, color, t: dur, dur, size }; this.dirty = true; }

  update(dt, st) {
    this.time += dt;
    this.acc += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    const active = st.slot.spinning || st.slot.flash > 0 || this.msg || st.fever;
    const interval = active ? 1 / 30 : 1 / 6;
    if (this.acc < interval && !this.dirty) return;
    this.acc = 0; this.dirty = false;
    this.draw(st);
    this.texture.needsUpdate = true;
  }

  draw(st) {
    const g = this.g, t = this.time, th = st.theme;
    // background
    const bg = g.createLinearGradient(0, 0, 0, H);
    if (st.fever) { bg.addColorStop(0, `hsl(${(t * 80) % 360},70%,22%)`); bg.addColorStop(1, `hsl(${(t * 80 + 120) % 360},70%,10%)`); }
    else { bg.addColorStop(0, '#16161e'); bg.addColorStop(1, '#050507'); }
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // decorative rays
    g.save(); g.translate(W / 2, H * 0.55); g.globalAlpha = 0.07;
    for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? th.accent : '#fff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(900, -60); g.lineTo(900, 60); g.fill(); }
    g.restore(); g.globalAlpha = 1;
    // Jackpot header
    if (st.jpOn) {
      g.fillStyle = 'rgba(0,0,0,.55)'; roundRect(g, 262, 14, 500, 92, 18); g.fill();
      g.strokeStyle = th.accent; g.lineWidth = 3; g.stroke();
      g.font = '900 30px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffd34d'; g.fillText('★ JACKPOT ★', W / 2, 38);
      g.font = '900 50px "Arial Black", Arial';
      const glow = 0.6 + 0.4 * Math.sin(t * 4);
      g.shadowColor = '#ffb300'; g.shadowBlur = 18 * glow;
      g.fillStyle = '#fff3b0'; g.fillText(Math.floor(st.jpPool).toLocaleString(), W / 2, 80);
      g.shadowBlur = 0;
    } else {
      g.font = '900 54px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = th.accent; g.fillText('MEDAL PUSHER', W / 2, 58);
    }
    // reels
    const slotOn = st.slotOn;
    const rw = 196, rh = 240, gap = 22, top = 130;
    const x0 = W / 2 - (rw * 3 + gap * 2) / 2;
    const symH = 112;
    for (let i = 0; i < 3; i++) {
      const rx = x0 + i * (rw + gap);
      if (st.mech) {
        // real 3D reels sit behind this window: punch a transparent hole
        g.save(); roundRect(g, rx, top, rw, rh, 14); g.clip(); g.clearRect(rx, top, rw, rh); g.restore();
        g.strokeStyle = '#d4a52a'; g.lineWidth = 6; roundRect(g, rx, top, rw, rh, 14); g.stroke();
        continue;
      }
      g.save();
      const rg = g.createLinearGradient(0, top, 0, top + rh);
      rg.addColorStop(0, '#9a9a9a'); rg.addColorStop(0.15, '#fff'); rg.addColorStop(0.85, '#fff'); rg.addColorStop(1, '#9a9a9a');
      g.fillStyle = rg; roundRect(g, rx, top, rw, rh, 14); g.fill();
      g.clip();
      if (slotOn) {
        const r = st.slot.reels[i];
        const base = Math.floor(r.pos), f = r.pos - base;
        const blur = r.state === 'spin' && r.speed > 10;
        for (let k = -2; k <= 2; k++) {
          const strip = r.strip, idx = ((base + k) % strip.length + strip.length) % strip.length;
          const y = top + rh / 2 + (k - f) * symH;
          if (blur) { g.globalAlpha = 0.45; drawSymbol(g, strip[idx], rx + rw / 2, y - 18, 96); drawSymbol(g, strip[idx], rx + rw / 2, y + 18, 96); g.globalAlpha = 1; }
          else drawSymbol(g, strip[idx], rx + rw / 2, y, 96);
        }
      } else {
        g.fillStyle = '#333'; g.font = '900 40px Arial'; g.textAlign = 'center'; g.fillText('-', rx + rw / 2, top + rh / 2);
      }
      // glass shading
      const sh = g.createLinearGradient(0, top, 0, top + rh);
      sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = sh; g.fillRect(rx, top, rw, rh);
      g.restore();
      g.strokeStyle = '#d4a52a'; g.lineWidth = 6; roundRect(g, rx, top, rw, rh, 14); g.stroke();
    }
    // payline
    const win = st.slot.flash > 0 && Math.floor(t * 8) % 2 === 0;
    g.strokeStyle = win ? '#fff200' : 'rgba(255,40,60,.85)'; g.lineWidth = win ? 8 : 4;
    g.beginPath(); g.moveTo(x0 - 18, top + rh / 2); g.lineTo(x0 + rw * 3 + gap * 2 + 18, top + rh / 2); g.stroke();
    // stock lamps
    const max = st.stockMax, n = st.stock;
    const lampY = top + rh + 40, lw = 34;
    g.font = 'bold 22px Arial'; g.fillStyle = '#ccc'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText('STOCK', W / 2 - max * lw / 2 - 14, lampY);
    for (let i = 0; i < max; i++) {
      const cx = W / 2 - max * lw / 2 + i * lw + lw / 2;
      const on = i < n;
      const gr = g.createRadialGradient(cx - 4, lampY - 4, 1, cx, lampY, 13);
      if (on) { gr.addColorStop(0, '#fff'); gr.addColorStop(1, st.fever ? `hsl(${(t * 200 + i * 40) % 360},100%,50%)` : '#ff3b30'); }
      else { gr.addColorStop(0, '#555'); gr.addColorStop(1, '#222'); }
      g.fillStyle = gr; g.beginPath(); g.arc(cx, lampY, 12, 0, Math.PI * 2); g.fill();
    }
    // side status panels
    const side = (x, lines) => {
      g.fillStyle = 'rgba(0,0,0,.5)'; roundRect(g, x, 140, 120, 220, 12); g.fill();
      g.textAlign = 'center';
      lines.forEach((ln, i) => { g.fillStyle = ln[1]; g.font = `900 ${ln[2] || 22}px "Arial Black", Arial`; g.fillText(ln[0], x + 60, 175 + i * 46); });
    };
    const fx = st.effects;
    const left = [], right = [];
    if (fx.fever > 0) left.push(['FEVER', `hsl(${(t * 200) % 360},100%,60%)`], [`${Math.ceil(fx.fever)}s`, '#fff', 30]);
    if (fx.walls > 0) left.push(['WALL', '#4fc3ff'], [`${Math.ceil(fx.walls)}s`, '#fff', 30]);
    if (fx.turbo > 0) right.push(['TURBO', '#ff9f43'], [`${Math.ceil(fx.turbo)}s`, '#fff', 30]);
    if (fx.double > 0) right.push(['×2', '#c38bff', 30], [`${Math.ceil(fx.double)}s`, '#fff', 30]);
    if (fx.magnet > 0) right.push(['MAGNET', '#ff6b6b', 20], [`${Math.ceil(fx.magnet)}s`, '#fff', 30]);
    if (st.wheelMeter >= 0 && right.length < 4) right.push(['WHEEL', '#7CFFB2', 22], [`${Math.min(st.wheelMeter, st.wheelNeed)}/${st.wheelNeed}`, '#7CFFB2', 30]);
    if (st.event) {
      const ev = st.event;
      const lines = [['EVENT', '#ff8a65'], [`${Math.ceil(ev.t)}s`, '#fff', 30]];
      if (ev.id === 'challenge') lines.push([`${ev.progress || 0}/${ev.target}`, '#7CFFB2', 26]);
      left.unshift(...lines);
    }
    if (left.length) side(14, left.slice(0, 4));
    if (right.length) side(W - 134, right.slice(0, 4));
    // message overlay
    if (this.msg) {
      const m = this.msg, k = 1 - m.t / m.dur;
      const sc = k < 0.15 ? k / 0.15 : 1;
      g.save(); g.translate(W / 2, top + rh / 2); g.scale(sc, sc);
      g.font = `900 ${m.size}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(m.text, 0, 0);
      g.fillStyle = m.color === 'rainbow' ? `hsl(${(t * 300) % 360},100%,60%)` : m.color; g.fillText(m.text, 0, 0);
      g.restore();
    }
  }
}
