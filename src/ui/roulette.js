// Full-screen jackpot roulette overlay (canvas 2D)
import { ROULETTE } from '../game/balance.js';

export class Roulette {
  constructor(root, audio) {
    this.audio = audio;
    this.el = document.createElement('div');
    this.el.className = 'roulette hidden';
    this.canvas = document.createElement('canvas');
    this.el.appendChild(this.canvas);
    this.label = document.createElement('div');
    this.label.className = 'roulette-label';
    this.el.appendChild(this.label);
    root.appendChild(this.el);
    this.active = false;
    this.el.addEventListener('pointerdown', () => { if (this.skippable && this.active) this.speedUp = 3; });
  }

  // jpPockets: number of pockets that count as JP (luck upgrades)
  run(targetIndex, jpPool, skippable, title) {
    return new Promise(resolve => {
      this.active = true; this.skippable = skippable; this.speedUp = 1;
      this.el.classList.remove('hidden');
      this.label.textContent = title;
      const n = ROULETTE.length;
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.86;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = this.canvas; c.width = c.height = size * dpr; c.style.width = c.style.height = size + 'px';
      const g = c.getContext('2d'); g.scale(dpr, dpr);
      const R = size / 2;
      const seg = Math.PI * 2 / n;
      // wheel spins one way, ball the other; ball ends at target pocket
      const total = 6.0;
      let t = 0, last = performance.now();
      const wheelSpeed0 = 2.2;
      const ballEndAngle = -Math.PI / 2; // top
      // wheel final angle such that target pocket center is at top
      const wheelEnd = ballEndAngle - (targetIndex + 0.5) * seg;
      // wheel angle(t) = wheelEnd - wheelSpeed0*(total - t)^2/(2*total)*... use ease
      const wheelAngle = tt => wheelEnd - wheelSpeed0 * total * Math.pow(1 - tt / total, 2) / 2 * 3;
      const ballAngle = tt => ballEndAngle + 9 * Math.pow(1 - tt / total, 2) * Math.PI;
      let lastPocket = -1;
      const frame = now => {
        const dt = Math.min(0.05, (now - last) / 1000) * this.speedUp; last = now;
        t = Math.min(total, t + dt);
        const wa = wheelAngle(t), ba = ballAngle(t);
        g.clearRect(0, 0, size, size);
        // outer rim
        const rim = g.createRadialGradient(R, R, R * 0.8, R, R, R);
        rim.addColorStop(0, '#5a3a10'); rim.addColorStop(0.5, '#d4a52a'); rim.addColorStop(1, '#3a2504');
        g.fillStyle = rim; g.beginPath(); g.arc(R, R, R * 0.98, 0, Math.PI * 2); g.fill();
        // pockets
        for (let i = 0; i < n; i++) {
          const p = ROULETTE[i], a0 = wa + i * seg, a1 = a0 + seg;
          g.fillStyle = p.color;
          g.beginPath(); g.moveTo(R, R); g.arc(R, R, R * 0.86, a0, a1); g.closePath(); g.fill();
          g.strokeStyle = '#d4a52a'; g.lineWidth = 2; g.stroke();
          g.save(); g.translate(R, R); g.rotate(a0 + seg / 2);
          g.fillStyle = p.id === 'JP' ? '#000' : '#fff';
          g.font = `900 ${R * (p.label.length > 3 ? 0.065 : 0.09)}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.translate(R * 0.7, 0); g.rotate(Math.PI / 2); g.fillText(p.label, 0, 0);
          g.restore();
        }
        // hub
        const hub = g.createRadialGradient(R - R * 0.05, R - R * 0.05, 2, R, R, R * 0.4);
        hub.addColorStop(0, '#fff6c0'); hub.addColorStop(0.5, '#d4a52a'); hub.addColorStop(1, '#5a3a10');
        g.fillStyle = hub; g.beginPath(); g.arc(R, R, R * 0.42, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a1a00'; g.font = `900 ${R * 0.09}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('JACKPOT', R, R - R * 0.07);
        g.fillStyle = '#fff'; g.font = `900 ${R * 0.12}px "Arial Black", Arial`;
        g.fillText(Math.floor(jpPool).toLocaleString(), R, R + R * 0.08);
        // ball
        const br = R * (0.92 - 0.14 * Math.min(1, t / total * 1.4));
        const bx = R + Math.cos(ba) * br, by = R + Math.sin(ba) * br;
        const bg = g.createRadialGradient(bx - 4, by - 4, 1, bx, by, R * 0.045);
        bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#8a8f99');
        g.fillStyle = bg; g.beginPath(); g.arc(bx, by, R * 0.04, 0, Math.PI * 2); g.fill();
        // pointer
        g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(R - 14, 4); g.lineTo(R + 14, 4); g.lineTo(R, 30); g.closePath(); g.fill();
        const rel = ((ba - wa) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const pk = Math.floor(rel / seg);
        if (pk !== lastPocket) { lastPocket = pk; this.audio.rouletteTick(0.8 + Math.random() * 0.4); }
        if (t < total) requestAnimationFrame(frame);
        else setTimeout(() => { this.el.classList.add('hidden'); this.active = false; resolve(ROULETTE[targetIndex]); }, 900 / this.speedUp);
      };
      requestAnimationFrame(frame);
    });
  }
}
