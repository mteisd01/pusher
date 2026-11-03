// Full-screen 2D mini games: 3-stage croon (jackpot), plinko, dice and the lucky-road board.
const TAU = Math.PI * 2;

export class MiniGames {
  constructor(root, audio, getSettings) {
    this.audio = audio;
    this.getSettings = getSettings;
    this.el = document.createElement('div');
    this.el.className = 'overlay2d hidden';
    this.title = document.createElement('div'); this.title.className = 'ov-title';
    this.sub = document.createElement('div'); this.sub.className = 'ov-sub';
    this.canvas = document.createElement('canvas');
    this.el.append(this.title, this.canvas, this.sub);
    root.appendChild(this.el);
    this.active = false;
    this.speed = 1;
    this.el.addEventListener('pointerdown', e => this._onDown && this._onDown(e));
    this.el.addEventListener('pointermove', e => this._onMove && this._onMove(e));
  }

  _open(title, w, h, compact = false) {
    this.active = !compact; this.speed = 1;
    this.el.classList.remove('hidden');
    this.el.classList.toggle('compact', compact);
    this.title.textContent = title; this.sub.textContent = '';
    const k = compact ? Math.min(window.innerWidth * 0.27 / w, window.innerHeight * 0.34 / h) : Math.min(window.innerWidth * 0.92 / w, window.innerHeight * 0.78 / h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = w * k; this.ch = h * k;
    const c = this.canvas;
    c.width = this.cw * dpr; c.height = this.ch * dpr; c.style.width = this.cw + 'px'; c.style.height = this.ch + 'px';
    this.g = c.getContext('2d'); this.g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    this.W = w; this.H = h; this.k = k;
  }
  _close() { this.el.classList.add('hidden'); this.el.classList.remove('compact'); this.active = false; this._onDown = this._onMove = null; }
  _loop(fn) {
    return new Promise(resolve => {
      let last = performance.now();
      const frame = now => {
        const dt = this.isPaused && this.isPaused() ? 0 : Math.min(0.1, (now - last) / 1000) * this.speed; last = now;
        const r = fn(dt);
        if (r !== undefined) resolve(r); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
  _skippable() {
    if (this.getSettings().jpSkip) this._onDown = () => { this.speed = 3; };
  }
  wait(ms) { return new Promise(r => setTimeout(r, ms / this.speed)); }

  // ---------- 3-stage croon ----------
  // stages: [{ holes: [{label, good, color, w}], title }]
  async croon(stages, jpPool) {
    this._open('JACKPOT CHANCE', 100, 100);
    this._skippable();
    this.audio.setMood('croon');
    let result = null;
    for (let si = 0; si < stages.length; si++) {
      const st = stages[si];
      this.title.textContent = st.title;
      this.sub.textContent = `STAGE ${si + 1} / ${stages.length}`;
      const hole = await this._croonStage(st, si, jpPool);
      this.audio.croonStop();
      result = { stage: si, hole };
      this.audio.croonHole(hole.good);
      await this.wait(900);
      if (!hole.good || si === stages.length - 1) break;
    }
    this.audio.setMood('normal');
    this._close();
    return result;
  }

  _croonStage(st, si, jpPool) {
    const g = this.g, R = 44, cx = 50, cy = 52;
    const n = st.holes.length;
    const ringR = 23, holeR = 5.2;
    let rot = Math.random() * TAU, omega = (si % 2 ? -1 : 1) * (0.55 + si * 0.15);
    const a0 = Math.random() * TAU;
    let p = { x: cx + Math.cos(a0) * 40, y: cy + Math.sin(a0) * 40 };
    let v = { x: -Math.sin(a0) * 60, y: Math.cos(a0) * 60 };
    let t = 0, falling = null, fallT = 0;
    const colors = ['#2a1a40', '#3a1630', '#13283f'];
    return this._loop(dt => {
      t += dt;
      rot += omega * dt;
      if (!falling) {
        // forces: slope toward the hole ring, rim bounce, rolling friction, dish drag
        const dx = p.x - cx, dy = p.y - cy, r = Math.hypot(dx, dy) || 1e-6;
        const nx = dx / r, ny = dy / r;
        const slope = (r > ringR ? -1 : 0.35) * 26;
        v.x += nx * slope * dt; v.y += ny * slope * dt;
        v.x += (-omega * dy - v.x) * 0.05 * dt; v.y += (omega * dx - v.y) * 0.05 * dt;
        const fr = Math.pow(0.9, dt * (t > 9 ? 8 : 1));
        v.x *= fr; v.y *= fr;
        p.x += v.x * dt; p.y += v.y * dt;
        const r2 = Math.hypot(p.x - cx, p.y - cy);
        if (r2 > R - 3) { const k = (R - 3) / r2; p.x = cx + (p.x - cx) * k; p.y = cy + (p.y - cy) * k; const vn = v.x * nx + v.y * ny; v.x -= 1.6 * vn * nx; v.y -= 1.6 * vn * ny; this.audio.pin(0); }
        if (r2 < 6) { v.x += nx * 30 * dt; v.y += ny * 30 * dt; }
        const speed = Math.hypot(v.x, v.y);
        this.audio.croonRoll(Math.min(1, speed / 50));
        // hole capture
        for (let i = 0; i < n; i++) {
          const ha = rot + i / n * TAU;
          const hx = cx + Math.cos(ha) * ringR, hy = cy + Math.sin(ha) * ringR;
          const d = Math.hypot(p.x - hx, p.y - hy);
          const w = holeR * (st.holes[i].w || 1);
          if (d < w * 0.8 && (speed < 22 + t * 2 || t > 14)) { falling = { i, hx, hy }; break; }
        }
      } else {
        fallT += dt;
        const ha = rot + falling.i / n * TAU;
        const hx = cx + Math.cos(ha) * ringR, hy = cy + Math.sin(ha) * ringR;
        p.x += (hx - p.x) * Math.min(1, dt * 10); p.y += (hy - p.y) * Math.min(1, dt * 10);
        if (fallT > 0.45) return st.holes[falling.i];
      }
      // draw
      g.clearRect(0, 0, 100, 100);
      const bg = g.createRadialGradient(cx, cy, 2, cx, cy, R + 4);
      bg.addColorStop(0, '#000'); bg.addColorStop(0.55, colors[si % 3]); bg.addColorStop(0.92, '#d4a52a'); bg.addColorStop(1, '#5a3a10');
      g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R + 4, 0, TAU); g.fill();
      // radial grooves
      g.save(); g.translate(cx, cy); g.rotate(rot);
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 0.4;
      for (let i = 0; i < 24; i++) { g.rotate(TAU / 24); g.beginPath(); g.moveTo(8, 0); g.lineTo(R, 0); g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(255,215,0,.25)'; g.lineWidth = 0.5; g.beginPath(); g.arc(cx, cy, ringR, 0, TAU); g.stroke();
      for (let i = 0; i < n; i++) {
        const h = st.holes[i], ha = rot + i / n * TAU;
        const hx = cx + Math.cos(ha) * ringR, hy = cy + Math.sin(ha) * ringR;
        const w = holeR * (h.w || 1);
        g.fillStyle = h.color; g.beginPath(); g.arc(hx, hy, w + 1.2, 0, TAU); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(hx, hy, w, 0, TAU); g.fill();
        g.save(); g.translate(cx + Math.cos(ha) * (ringR + 10), cy + Math.sin(ha) * (ringR + 10));
        g.fillStyle = h.good ? '#7CFFB2' : '#fff'; g.font = `900 ${h.label.length > 3 ? 3.4 : 4.4}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(h.label, 0, 0); g.restore();
      }
      // hub
      const hub = g.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 8);
      hub.addColorStop(0, '#fff6c0'); hub.addColorStop(1, '#8a6200');
      g.fillStyle = hub; g.beginPath(); g.arc(cx, cy, 7, 0, TAU); g.fill();
      if (si === 2) { g.fillStyle = '#2a1a00'; g.font = '900 2.6px "Arial Black", Arial'; g.textAlign = 'center'; g.fillText(Math.floor(jpPool).toLocaleString(), cx, cy + 1); }
      // ball
      const s = falling ? Math.max(0.3, 1 - fallT * 1.5) : 1;
      const bg2 = g.createRadialGradient(p.x - 0.8, p.y - 0.8, 0.2, p.x, p.y, 2.4 * s);
      bg2.addColorStop(0, '#fff'); bg2.addColorStop(0.5, '#c7ccd6'); bg2.addColorStop(1, '#5d626b');
      g.fillStyle = bg2; g.beginPath(); g.arc(p.x, p.y, 2.2 * s, 0, TAU); g.fill();
      return undefined;
    });
  }

  // ---------- plinko ----------
  async plinko(pockets) {
    const W = 90, H = 110;
    this._open('PLINKO', W, H);
    this.sub.textContent = this.getSettings().lang === 'en' ? 'Tap to choose where to drop' : 'タップした位置からボールを落とす';
    const g = this.g;
    const rows = 9, pins = [];
    for (let r = 0; r < rows; r++) {
      const cnt = r % 2 ? 10 : 11;
      for (let i = 0; i < cnt; i++) pins.push({ x: 5 + (r % 2 ? 4 : 0) + i * 8, y: 22 + r * 8.2, flash: 0 });
    }
    const n = pockets.length, pw = (W - 4) / n;
    let aim = W / 2, ball = null, t = 0, done = null, doneT = 0;
    const toLocal = e => { const r = this.canvas.getBoundingClientRect(); return (e.clientX - r.left) / this.k; };
    this._onMove = e => { if (!ball) aim = Math.max(30, Math.min(W - 30, toLocal(e))); };
    this._onDown = e => { if (!ball) { aim = Math.max(30, Math.min(W - 30, toLocal(e))); drop(); } else this.speed = 2.5; };
    const drop = () => { ball = { x: aim + (Math.random() - 0.5) * 0.6, y: 8, vx: 0, vy: 0 }; this.audio.ui(); };
    return this._loop(dt => {
      t += dt;
      if (!ball && t > 6) drop();
      if (ball && !done) {
        const sub = 4, h = dt / sub;
        for (let k = 0; k < sub; k++) {
          ball.vy += 120 * h; ball.x += ball.vx * h; ball.y += ball.vy * h;
          for (const p of pins) {
            const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy), m = 1.0 + 1.8;
            if (d < m) {
              const nx = dx / d, ny = dy / d, vn = ball.vx * nx + ball.vy * ny;
              if (vn < 0) { ball.vx -= 1.5 * vn * nx; ball.vy -= 1.5 * vn * ny; ball.vx += (Math.random() - 0.5) * 6; if (p.flash < 0.2) this.audio.pin((p.y - 22) / 8.2); p.flash = 1; }
              ball.x = p.x + nx * m; ball.y = p.y + ny * m;
            }
          }
          if (ball.x < 3) { ball.x = 3; ball.vx = Math.abs(ball.vx) * 0.5; }
          if (ball.x > W - 3) { ball.x = W - 3; ball.vx = -Math.abs(ball.vx) * 0.5; }
          ball.vx *= 0.999;
          if (ball.y > H - 12) { done = Math.max(0, Math.min(n - 1, Math.floor((ball.x - 2) / pw))); this.audio.croonHole(pockets[done].good); break; }
        }
      }
      if (done !== null) { doneT += dt; if (doneT > 1.2) { this._close(); return pockets[done]; } }
      // draw
      g.clearRect(0, 0, W, H);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b1030'); bg.addColorStop(1, '#090410');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#d4a52a'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, W - 1, H - 1);
      for (const p of pins) {
        p.flash = Math.max(0, p.flash - dt * 3);
        g.fillStyle = p.flash > 0 ? `rgba(255,240,150,${0.5 + p.flash / 2})` : '#c9ccd6';
        g.beginPath(); g.arc(p.x, p.y, 1.0, 0, TAU); g.fill();
      }
      for (let i = 0; i < n; i++) {
        const x = 2 + i * pw, pk = pockets[i];
        g.fillStyle = done === i && Math.floor(doneT * 8) % 2 ? '#fff' : pk.color;
        g.fillRect(x + 0.4, H - 12, pw - 0.8, 11);
        g.fillStyle = '#000'; g.font = `900 ${pk.label.length > 3 ? 2.4 : 3.2}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(pk.label, x + pw / 2, H - 6.5);
      }
      if (!ball) {
        g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(30, 4, W - 60, 2);
        g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(aim - 2, 3); g.lineTo(aim + 2, 3); g.lineTo(aim, 7); g.fill();
        g.font = '900 3px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(Math.ceil(6 - t) + '', aim, 12);
      } else {
        const bg2 = g.createRadialGradient(ball.x - 0.5, ball.y - 0.5, 0.2, ball.x, ball.y, 1.8);
        bg2.addColorStop(0, '#fff'); bg2.addColorStop(1, '#9aa0aa');
        g.fillStyle = bg2; g.beginPath(); g.arc(ball.x, ball.y, 1.8, 0, TAU); g.fill();
      }
      return undefined;
    });
  }

  // ---------- dice + lucky road board ----------
  async roadMove(board, from, steps, lap, labelFn) {
    const W = 120, H = 70;
    this._open(`LUCKY ROAD  LAP ${lap + 1}`, W, H, true);
    this.speed = 1.4;
    const g = this.g, n = board.length;
    // square positions around a rounded rectangle
    // squares evenly spaced along the perimeter of a rectangle (8 + 4 + 8 + 4)
    const pos = i => {
      const x0 = 8, y0 = 10, x1 = W - 8, y1 = H - 7;
      const w = x1 - x0, hh = y1 - y0, P = 2 * (w + hh);
      let d = i / n * P;
      if (d < w) return [x0 + d, y1]; d -= w;
      if (d < hh) return [x1, y1 - d]; d -= hh;
      if (d < w) return [x1 - d, y0]; d -= w;
      return [x0, y0 + d];
    };
    let face = 1, t = 0, phase = 'roll', cur = from, moved = 0, stepT = 0;
    this.audio.dice();
    const final = steps;
    const draw = () => {
      g.clearRect(0, 0, W, H);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#103020'); bg.addColorStop(1, '#06140c');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const [x, y] = pos(i), sq = board[i];
        g.fillStyle = sq.color; g.strokeStyle = i === cur ? '#fff' : 'rgba(0,0,0,.6)'; g.lineWidth = i === cur ? 0.8 : 0.3;
        roundRect(g, x - 4.3, y - 4.3, 8.6, 8.6, 1.4); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.font = '900 2.1px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const lab = labelFn(sq);
        g.fillText(lab.slice(0, 6), x, y);
      }
      // token
      const [tx, ty] = pos(cur);
      const bounce = phase === 'move' ? Math.abs(Math.sin(stepT * Math.PI / 0.28)) * 2 : 0;
      g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(tx, ty - 5.5 - bounce, 2, 0, TAU); g.fill();
      g.strokeStyle = '#7a5600'; g.lineWidth = 0.4; g.stroke();
      // die
      const dx = W / 2, dy = H / 2 + 4, ds = 13;
      const rot = phase === 'roll' ? Math.sin(t * 20) * 0.4 : 0;
      g.save(); g.translate(dx, dy); g.rotate(rot);
      g.fillStyle = '#fafafa'; roundRect(g, -ds / 2, -ds / 2, ds, ds, 2.5); g.fill();
      g.strokeStyle = '#bbb'; g.lineWidth = 0.4; g.stroke();
      g.fillStyle = face === 1 ? '#e53935' : '#222';
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[face];
      for (const [a, b] of P) { g.beginPath(); g.arc(a * 3.3, b * 3.3, face === 1 ? 2 : 1.3, 0, TAU); g.fill(); }
      g.restore();
    };
    return this._loop(dt => {
      t += dt;
      if (phase === 'roll') {
        if (Math.floor(t * 14) !== Math.floor((t - dt) * 14)) face = 1 + Math.floor(Math.random() * 6);
        if (t > 1.1) { face = final; phase = 'show'; t = 0; this.audio.step(); }
      } else if (phase === 'show') {
        if (t > 0.5) { phase = 'move'; t = 0; }
      } else if (phase === 'move') {
        stepT += dt;
        if (stepT > 0.28) { stepT = 0; cur = (cur + 1) % n; moved++; this.audio.step(); if (moved >= final) { phase = 'land'; t = 0; } }
      } else if (phase === 'land') {
        if (t > 0.9) { this._close(); return cur; }
      }
      draw();
      return undefined;
    });
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
