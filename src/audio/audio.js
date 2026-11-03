// Audio engine: physically-modelled impact sample banks (modal synthesis), granular pile
// ambience, spatialization, synthesized instruments (FM bells, brass, drums) and an arranged BGM.
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], pentatonic: [0, 2, 4, 7, 9, 12, 14], mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------- offline DSP helpers ----------
function modal(sr, dur, modes, exc = {}) {
  const n = Math.floor(sr * dur), out = new Float32Array(n);
  for (const m of modes) {
    const w = 2 * Math.PI * m.f / sr, dec = Math.exp(-1 / (m.t * sr));
    let a = m.a, ph = Math.random() * 6.28;
    const det = m.beat ? 2 * Math.PI * m.f * (1 + m.beat) / sr : 0;
    let ph2 = Math.random() * 6.28;
    for (let i = 0; i < n && a > 1e-5; i++) {
      out[i] += a * (det ? (Math.sin(ph) + Math.sin(ph2)) * 0.5 : Math.sin(ph));
      ph += w; ph2 += det; a *= dec;
    }
  }
  // excitation transient (filtered noise click)
  const cl = Math.floor(sr * (exc.len || 0.0006));
  let lp = 0;
  for (let i = 0; i < cl; i++) {
    const nz = Math.random() * 2 - 1;
    lp += (nz - lp) * (exc.bright || 0.7);
    out[i] += (nz - lp * 0.5) * (exc.amp || 0.6) * (1 - i / cl);
  }
  // thump (low body)
  if (exc.thump) {
    const tn = Math.floor(sr * exc.thumpLen);
    for (let i = 0; i < tn; i++) out[i] += Math.sin(2 * Math.PI * exc.thump * i / sr) * exc.thumpAmp * Math.exp(-i / (sr * exc.thumpLen * 0.3));
  }
  // short attack ramp to avoid clicks
  for (let i = 0; i < 24 && i < n; i++) out[i] *= i / 24;
  return normalize(out, 0.9);
}
function normalize(a, peak) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m; return a; }
// thin-disc mode ratios (approximate, with slight per-coin randomisation)
const DISC = [1, 1.594, 2.136, 2.653, 3.156, 3.652, 4.39, 5.12];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, bgm: 0.45, se: 0.8, ambience: 0.25 };
    this.bgmOn = true;
    this.style = { bpm: 96, root: 57, mode: 'major', lead: 'bell' };
    this.mood = 'normal';
    this.fever = false;
    this.voices = 0;
    this.maxVoices = 40;
    this.lastT = {};
    this.motion = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
      this.sr = ctx.sampleRate;
      this.master = ctx.createGain();
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -12; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.003; this.comp.release.value = 0.15;
      this.master.connect(this.comp).connect(ctx.destination);
      this.seBus = ctx.createGain(); this.seBus.connect(this.master);
      // distant bus: softer highs for objects far from the player
      this.farBus = ctx.createBiquadFilter(); this.farBus.type = 'lowpass'; this.farBus.frequency.value = 5200; this.farBus.connect(this.seBus);
      this.bgmBus = ctx.createGain(); this.bgmBus.connect(this.master);
      this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
      this.verb = ctx.createConvolver();
      this.verb.buffer = this._roomIR(1.4);
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.22;
      this.verbSend.connect(this.verb).connect(this.master);
      this.noise = this._noiseBuffer(2);
      this._buildBanks();
      this.applyVolume();
      this._startScheduler();
      this._startAmbience();
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  }

  setVolume(v) { Object.assign(this.vol, v); this.applyVolume(); }
  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.seBus.gain.setTargetAtTime(this.vol.se, t, 0.05);
    this.bgmBus.gain.setTargetAtTime(this.bgmOn ? this.vol.bgm * 0.55 : 0, t, 0.2);
    this.ambBus.gain.setTargetAtTime(this.vol.ambience * 0.5, t, 0.3);
  }
  setMuted(m) { this.muted = m; this.applyVolume(); }
  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend(); else this.ctx.resume();
  }
  setStyle(s) { this.style = { ...this.style, ...s }; }
  setMood(m) { this.mood = m; }

  // ---------- sample banks ----------
  _buffer(data) { const b = this.ctx.createBuffer(1, data.length, this.sr); b.copyToChannel(data, 0); return b; }
  _coinModes(f0, tScale = 1, count = 7, amp = 1) {
    return DISC.slice(0, count).map((r, i) => ({
      f: f0 * r * rnd(0.985, 1.015), a: amp * rnd(0.35, 1) / (1 + i * 0.35), t: rnd(0.18, 0.42) * tScale / (1 + i * 0.55), beat: rnd(0.001, 0.005),
    }));
  }
  _buildBanks() {
    const sr = this.sr, B = this.banks = {};
    const mk = (n, fn) => Array.from({ length: n }, (_, i) => this._buffer(fn(i)));
    B.coin = mk(20, () => modal(sr, 0.5, this._coinModes(rnd(3600, 6400)), { amp: 0.5, bright: 0.8 }));
    B.plate = mk(14, () => modal(sr, 0.35, [
      ...this._coinModes(rnd(3300, 5600), 0.45, 5, 0.7),
      ...[310, 520, 790, 1160, 1730].map(f => ({ f: f * rnd(0.9, 1.1), a: rnd(0.15, 0.4), t: rnd(0.04, 0.11) })),
    ], { amp: 0.9, bright: 0.45, thump: rnd(110, 160), thumpAmp: 0.5, thumpLen: 0.03 }));
    B.glass = mk(6, () => modal(sr, 0.6, [
      ...this._coinModes(rnd(3800, 5200), 0.5, 4, 0.6),
      ...[1850, 2900, 4300].map(f => ({ f: f * rnd(0.95, 1.05), a: rnd(0.3, 0.6), t: rnd(0.1, 0.25) })),
    ], { amp: 0.5, bright: 0.6 }));
    B.big = mk(8, () => modal(sr, 0.9, this._coinModes(rnd(1700, 2500), 1.8, 7), { amp: 0.8, bright: 0.5, thump: rnd(80, 110), thumpAmp: 0.6, thumpLen: 0.05 }));
    B.gem = mk(6, () => modal(sr, 0.8, [6200, 9300, 12100].map((f, i) => ({ f: f * rnd(0.9, 1.1), a: 1 / (1 + i), t: rnd(0.25, 0.5) })), { amp: 0.3, bright: 0.9 }));
    B.ball = mk(6, () => modal(sr, 0.4, [1250, 2240, 3100, 4600].map((f, i) => ({ f: f * rnd(0.9, 1.1), a: 1 / (1 + i), t: rnd(0.05, 0.12) })), { amp: 0.9, bright: 0.4, thump: 95, thumpAmp: 0.9, thumpLen: 0.06 }));
    B.chest = mk(4, () => modal(sr, 0.25, [220, 410, 660, 980].map(f => ({ f: f * rnd(0.9, 1.1), a: rnd(0.3, 0.8), t: rnd(0.03, 0.07) })), { amp: 1, bright: 0.3, thump: 90, thumpAmp: 0.8, thumpLen: 0.05 }));
    // tiny scrape/contact grains for the moving pile
    B.grain = mk(28, () => modal(sr, 0.12, this._coinModes(rnd(3000, 7000), 0.12, 4, 0.8), { amp: 0.8, bright: rnd(0.4, 0.9), len: 0.0012 }));
    // coin sliding down the metal chute
    B.slide = mk(4, () => {
      const n = Math.floor(sr * 0.32), o = new Float32Array(n); let lp = 0, bp = 0;
      const fl = rnd(28, 46);
      for (let i = 0; i < n; i++) {
        const t = i / sr, nz = Math.random() * 2 - 1;
        lp += (nz - lp) * 0.35; bp = nz - lp;
        const env = Math.min(1, t / 0.03) * Math.exp(-t * 6) * (0.6 + 0.4 * Math.sin(2 * Math.PI * fl * t));
        o[i] = bp * env * 0.6 + Math.sin(2 * Math.PI * 5200 * t) * env * 0.05;
      }
      return normalize(o, 0.6);
    });
    // metal tray resonance (payout pan)
    B.tray = mk(3, () => modal(sr, 0.6, [180, 265, 410, 620, 950].map(f => ({ f: f * rnd(0.95, 1.05), a: rnd(0.3, 1), t: rnd(0.08, 0.25) })), { amp: 0.4, bright: 0.3, thump: 70, thumpAmp: 0.6, thumpLen: 0.04 }));
    // wood block for board-game steps
    B.wood = mk(3, () => modal(sr, 0.15, [820, 1630, 2480].map((f, i) => ({ f: f * rnd(0.97, 1.03), a: 1 / (1 + i), t: 0.03 / (1 + i * 0.5) })), { amp: 0.6, bright: 0.3 }));
  }

  _noiseBuffer(sec) {
    const ctx = this.ctx, b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _roomIR(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      // early reflections
      for (let k = 0; k < 10; k++) { const p = Math.floor(rnd(0.005, 0.06) * ctx.sampleRate); if (p < len) d[p] += rnd(-0.7, 0.7); }
      let lp = 0;
      for (let i = 0; i < len; i++) { const nz = Math.random() * 2 - 1; lp += (nz - lp) * (0.5 - 0.4 * i / len); d[i] += lp * Math.pow(1 - i / len, 3) * 0.6; }
    }
    return b;
  }

  // Play a bank buffer with spatialization
  play(buf, { gain = 1, rate = 1, pan = 0, when = 0, far = 0, verb = 0.6, bus } = {}) {
    if (!this.ctx || this.voices >= this.maxVoices || this.vol.se <= 0) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    let node = src.connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node = node.connect(p); }
    node.connect(bus || (far > 0.5 ? this.farBus : this.seBus));
    if (verb > 0) { const vs = ctx.createGain(); vs.gain.value = verb; node.connect(vs).connect(this.verbSend); }
    this.voices++;
    src.onended = () => { this.voices--; };
    src.start(t);
  }

  // ---------- physics driven ----------
  // e: { x, z, s (0..1), kind, surf (0 obj-obj, 1 plate, 2 glass, 3 wall) }
  impact(e, halfW) {
    if (!this.ctx) return;
    const B = this.banks;
    const s = e.s;
    if (s < 0.12) return;
    const pan = e.x / halfW * 0.8;
    const far = Math.max(0, Math.min(1, (6 - e.z) / 18));
    const g = (0.15 + s * s * 0.85) * (1 - far * 0.45);
    let buf, rate = rnd(0.94, 1.06), gain = g;
    switch (e.kind) {
      case 3: buf = pick(B.big); gain *= 1.2; break;            // big medal
      case 4: buf = pick(B.ball); gain *= 1.3; break;           // JP ball
      case 5: buf = pick(B.gem); gain *= 0.7; break;            // gem
      case 6: buf = pick(B.chest); gain *= 1.1; break;          // chest
      default:
        buf = e.surf === 1 ? pick(B.plate) : e.surf === 2 ? pick(B.glass) : pick(B.coin);
        if (e.kind === 1 || e.kind === 2) rate *= 0.93;          // gold/rainbow: slightly heavier tone
        if (e.surf === 0) gain *= 0.65;
    }
    this.play(buf, { gain: gain * 0.55, rate, pan, far, verb: 0.35 + far * 0.4 });
  }

  // continuous shuffle of the pile, called every frame with summed motion
  pileMotion(v, dt) {
    if (!this.ctx || this.vol.se <= 0) return;
    this.motion += (v - this.motion) * Math.min(1, dt * 6);
    const rate = Math.min(70, this.motion * 0.09);           // grains per second
    this._grainAcc = (this._grainAcc || 0) + rate * dt;
    while (this._grainAcc >= 1) {
      this._grainAcc -= 1;
      this.play(pick(this.banks.grain), { gain: rnd(0.04, 0.13), rate: rnd(0.85, 1.15), pan: rnd(-0.7, 0.7), when: rnd(0, 0.03), far: 1, verb: 0.25 });
    }
  }

  // the pusher's drive: low motor hum + sliding friction that follows the stroke speed
  pusherDrive(phase) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this._drive) {
      const ctx = this.ctx;
      const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 0.9;
      const g = ctx.createGain(); g.gain.value = 0;
      const hum = ctx.createOscillator(); hum.frequency.value = 50; const hg = ctx.createGain(); hg.gain.value = 0.012;
      n.connect(f).connect(g).connect(this.seBus); hum.connect(hg).connect(this.seBus);
      n.start(); hum.start();
      this._drive = { g, f };
    }
    const v = Math.abs(Math.sin(phase * Math.PI * 2));
    const t = this.ctx.currentTime;
    this._drive.g.gain.setTargetAtTime(0.012 + v * 0.05, t, 0.05);
    this._drive.f.frequency.setTargetAtTime(170 + v * 160, t, 0.05);
  }

  // coins falling over the front edge into the metal payout tray
  payout(n = 1, pan = 0, heavy = false) {
    if (!this.ctx) return;
    const B = this.banks, k = Math.min(5, 1 + Math.floor(n / 2));
    for (let i = 0; i < k; i++) {
      const w = 0.05 + i * rnd(0.025, 0.06);
      this.play(pick(B.plate), { gain: rnd(0.25, 0.45) * (heavy ? 1.3 : 1), rate: rnd(0.68, 0.86), pan: pan + rnd(-0.15, 0.15), when: w, verb: 0.5 });
      if (Math.random() < 0.5) this.play(pick(B.coin), { gain: rnd(0.1, 0.2), rate: rnd(0.8, 1), pan: pan + rnd(-0.2, 0.2), when: w + rnd(0.01, 0.05), verb: 0.5 });
    }
    if (n > 2 || heavy || Math.random() < 0.25) this.play(pick(B.tray), { gain: heavy ? 0.5 : 0.22, rate: rnd(0.95, 1.05), pan, when: 0.05, verb: 0.5 });
  }

  // player drop: rolls down the chute, clicks along the rail
  drop(pan = 0) {
    if (!this.ctx) return;
    const B = this.banks;
    this.play(pick(B.slide), { gain: 0.32, rate: rnd(0.9, 1.1), pan, verb: 0.2 });
    for (let i = 0; i < 3; i++) this.play(pick(B.grain), { gain: 0.18 - i * 0.04, rate: rnd(0.9, 1.2), pan, when: 0.02 + i * rnd(0.035, 0.06), verb: 0.2 });
  }

  // ---------- synthesized instruments ----------
  _env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // FM bell / e-piano
  bell(freq, dur = 0.8, vol = 0.12, when = 0, { ratio = 3.5, index = 2.5, bus, verb = 0.6 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.frequency.value = freq; m.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(freq * index, t); mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur);
    m.connect(mg).connect(c.frequency);
    this._env(g, t, 0.004, vol, dur);
    c.connect(g).connect(bus || this.seBus);
    if (verb) { const vs = ctx.createGain(); vs.gain.value = verb; g.connect(vs).connect(this.verbSend); }
    c.start(t); m.start(t); c.stop(t + dur + 0.1); m.stop(t + dur + 0.1);
  }
  // detuned saw stack through a swept lowpass (brass / synth lead)
  brass(freq, dur = 0.4, vol = 0.06, when = 0, { bus, cutoff = 2600, verb = 0.4, type = 'sawtooth' } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(cutoff * 0.3, t); f.frequency.exponentialRampToValueAtTime(cutoff, t + 0.06); f.frequency.exponentialRampToValueAtTime(cutoff * 0.4, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const d of [-7, 0, 7]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
    f.connect(g).connect(bus || this.seBus);
    if (verb) { const vs = ctx.createGain(); vs.gain.value = verb; g.connect(vs).connect(this.verbSend); }
  }
  noiseHit(when, vol, type, freq, dur, bus, q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(bus || this.seBus); n.start(t, Math.random() * 1.5, dur + 0.02);
  }
  thump(when = 0, vol = 0.4, f0 = 120, bus) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(bus || this.seBus); o.start(t); o.stop(t + 0.22);
  }
  sweep(f0, f1, dur, vol = 0.06, when = 0, type = 'sine') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this._env(g, t, 0.02, vol, dur);
    o.connect(g).connect(this.seBus); o.start(t); o.stop(t + dur + 0.05);
  }
  chord(notes, fn, gap = 0) { notes.forEach((n, i) => fn(mtof(n), i * gap)); }

  // ---------- game event sounds ----------
  ui() { if (this.ctx) this.play(pick(this.banks.grain), { gain: 0.25, rate: 1.4, verb: 0 }); }
  gate() { if (!this.ctx) return; [84, 88, 91, 96].forEach((m, i) => this.bell(mtof(m), 0.5, 0.07, i * 0.05, { ratio: 2, index: 1.2 })); }
  stock() { if (this.ctx) this.bell(mtof(91), 0.4, 0.06, 0, { ratio: 2, index: 1 }); }
  // slot machine
  reelStart() {
    if (!this.ctx || this._motor) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 18; const lg = ctx.createGain(); lg.gain.value = 5; lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.15);
    o.connect(f).connect(g).connect(this.seBus); o.start(); lfo.start();
    this._motor = { o, lfo, g };
  }
  reelTick() { if (this.ctx) this.noiseHit(0, 0.05, 'bandpass', 3200, 0.018, null, 4); }
  reelStop(i = 0, last = false) {
    if (!this.ctx) return;
    this.thump(0, 0.35, 140 - i * 15);
    this.noiseHit(0, 0.18, 'bandpass', 1800, 0.05, null, 2);
    this.play(pick(this.banks.chest), { gain: 0.25, rate: 1.6, verb: 0.2 });
    if (last && this._motor) { const m = this._motor; this._motor = null; const t = this.ctx.currentTime; m.g.gain.setTargetAtTime(0.0001, t, 0.05); m.o.stop(t + 0.3); m.lfo.stop(t + 0.3); }
  }
  reach() {
    if (!this.ctx) return;
    for (let i = 0; i < 12; i++) this.brass(mtof(64 + (i % 4) * 3 + Math.floor(i / 4) * 2), 0.11, 0.035, i * 0.1, { cutoff: 3000 });
    for (let i = 0; i < 6; i++) this.thump(i * 0.2, 0.3, 70);
  }
  lose() { if (this.ctx) { this.brass(mtof(55), 0.35, 0.03, 0, { cutoff: 900 }); this.brass(mtof(54), 0.4, 0.03, 0.2, { cutoff: 700 }); } }
  // symbol-specific jingles
  win(kind = 'small') {
    if (!this.ctx) return;
    const J = {
      cherry: [[79, 83, 86], 0.07], bell: [[76, 81, 84, 88], 0.08], gold: [[74, 78, 81, 86, 90], 0.07],
      bar: [[72, 76, 79, 84, 88, 91], 0.08], item: [[81, 86, 89, 93], 0.06], small: [[79, 84, 88], 0.08],
    }[kind] || [[79, 84, 88], 0.08];
    J[0].forEach((m, i) => { this.bell(mtof(m), 0.7, 0.09, i * J[1], { ratio: 3.01, index: 1.8 }); this.bell(mtof(m - 12), 0.5, 0.04, i * J[1], { ratio: 1, index: 0.8 }); });
    for (let i = 0; i < J[0].length; i++) this.play(pick(this.banks.coin), { gain: 0.1, rate: rnd(0.9, 1.2), pan: rnd(-0.5, 0.5), when: 0.1 + i * 0.08 });
  }
  winBig() {
    if (!this.ctx) return;
    const seq = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]];
    seq.forEach((c, i) => c.forEach(n => this.brass(mtof(n), i === 3 ? 0.9 : 0.22, 0.03, i * 0.18, { cutoff: 3200 })));
    for (let i = 0; i < 4; i++) this.thump(i * 0.18, 0.35, 90);
    this.noiseHit(0.54, 0.25, 'highpass', 6000, 0.6);
    for (let i = 0; i < 14; i++) this.play(pick(this.banks.coin), { gain: rnd(0.08, 0.18), rate: rnd(0.8, 1.2), pan: rnd(-0.8, 0.8), when: 0.5 + i * 0.05 });
  }
  fanfare() {
    if (!this.ctx) return;
    const prog = [[67, 71, 74, 79], [65, 69, 72, 77], [67, 71, 74, 79], [72, 76, 79, 84, 88]];
    prog.forEach((c, i) => c.forEach(n => this.brass(mtof(n), i === 3 ? 1.4 : 0.32, 0.028, i * 0.3, { cutoff: 3500 })));
    for (let i = 0; i < 16; i++) this.noiseHit(i * 0.05, 0.06 + i * 0.006, 'bandpass', 2200, 0.05);
    this.thump(0.9, 0.5, 80); this.noiseHit(0.9, 0.3, 'highpass', 5000, 1.2);
  }
  jackpot() {
    if (!this.ctx) return;
    this.fanfare();
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.bell(mtof(84 + s), 1.2, 0.08, 1.2 + i * 0.09, { ratio: 3.5, index: 2 }));
    for (let i = 0; i < 50; i++) this.payout(1, rnd(-0.9, 0.9), i % 10 === 0);
  }
  itemGet() { if (this.ctx) [88, 95, 100, 107].forEach((m, i) => this.bell(mtof(m), 0.6, 0.07, i * 0.06, { ratio: 2.76, index: 1.5 })); }
  levelUp() { if (this.ctx) { [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => this.bell(mtof(m), 0.8, 0.07, i * 0.06, { ratio: 3, index: 1.6 })); this.brass(mtof(60), 0.8, 0.03, 0.4, { cutoff: 2000 }); } }
  wall() { if (this.ctx) { this.sweep(90, 300, 0.5, 0.1, 0, 'sawtooth'); this.thump(0.45, 0.5, 70); this.noiseHit(0.45, 0.2, 'lowpass', 900, 0.3); } }
  combo(n) { if (this.ctx) this.bell(mtof(76 + Math.min(24, Math.floor(n / 3))), 0.4, 0.07, 0, { ratio: 2, index: 1 }); }
  lost() { if (this.ctx) this.sweep(420, 140, 0.35, 0.05, 0, 'triangle'); }
  // croon (JP)
  croonRoll(speed) {
    if (!this.ctx) return;
    if (!this._roll) {
      const ctx = this.ctx, n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = 0;
      n.connect(f).connect(g).connect(this.seBus); n.start();
      this._roll = { n, f, g };
    }
    const t = this.ctx.currentTime;
    this._roll.f.frequency.setTargetAtTime(300 + speed * 900, t, 0.05);
    this._roll.g.gain.setTargetAtTime(Math.min(0.25, speed * 0.2), t, 0.05);
  }
  croonStop() { if (this._roll) { const r = this._roll; this._roll = null; r.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); r.n.stop(this.ctx.currentTime + 0.3); } }
  croonHole(good) {
    if (!this.ctx) return;
    this.play(pick(this.banks.ball), { gain: 0.6, rate: 0.8 });
    if (good) [0, 4, 7, 12].forEach((s, i) => this.bell(mtof(79 + s), 0.6, 0.08, 0.15 + i * 0.07, { ratio: 3, index: 2 }));
    else this.sweep(330, 110, 0.6, 0.06, 0.1, 'sawtooth');
  }
  rouletteTick(p = 1) { if (this.ctx) this.noiseHit(0, 0.08, 'bandpass', 2600 * p, 0.02, null, 5); }
  pin(row = 0) { if (this.ctx) this.play(pick(this.banks.coin), { gain: 0.12, rate: 0.7 + row * 0.03, pan: rnd(-0.4, 0.4), verb: 0.3 }); }
  dice() { if (!this.ctx) return; for (let i = 0; i < 7; i++) this.play(pick(this.banks.wood), { gain: 0.3 - i * 0.03, rate: rnd(0.9, 1.3), pan: rnd(-0.4, 0.4), when: i * rnd(0.05, 0.11) }); }
  step() { if (this.ctx) this.play(pick(this.banks.wood), { gain: 0.35, rate: rnd(1.1, 1.3), verb: 0.2 }); }
  siren() {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) { this.sweep(600, 1100, 0.35, 0.05, i * 0.7, 'square'); this.sweep(1100, 600, 0.35, 0.05, i * 0.7 + 0.35, 'square'); }
    this.brass(mtof(64), 0.6, 0.04, 2.1, { cutoff: 2500 }); this.brass(mtof(71), 0.9, 0.04, 2.3, { cutoff: 2500 });
  }

  // ---------- ambience (distant arcade) ----------
  _startAmbience() {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.18;
    n.connect(f).connect(g).connect(this.ambBus); n.start();
    setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || this.vol.ambience <= 0) return;
      if (Math.random() < 0.5) {
        const k = 2 + Math.floor(Math.random() * 6), pan = rnd(-1, 1);
        for (let i = 0; i < k; i++) this.play(pick(this.banks.plate), { gain: rnd(0.15, 0.4), rate: rnd(0.6, 0.85), pan, when: i * rnd(0.03, 0.07), far: 1, verb: 1.2, bus: this.ambBus });
      }
      if (Math.random() < 0.06) [0, 4, 7].forEach((s, i) => this.bell(mtof(rnd(70, 80) + s), 0.5, 0.05, i * 0.08, { bus: this.ambBus, verb: 1.5 }));
    }, 700);
  }

  // ---------- arranged procedural BGM ----------
  _startScheduler() {
    this.step16 = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    setInterval(() => this._schedule(), 40);
  }

  _schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.bgmOn || this.vol.bgm <= 0 || ctx.state !== 'running') { if (ctx) this.nextTime = ctx.currentTime + 0.1; return; }
    const st = this.style;
    const mood = this.fever ? 'fever' : this.mood;
    const bpm = { fever: st.bpm * 1.3, event: st.bpm * 1.15, croon: st.bpm * 0.9 }[mood] || st.bpm;
    const spb = 60 / bpm / 4;
    const mode = mood === 'fever' ? 'major' : mood === 'event' ? 'minor' : st.mode;
    const scale = MODES[mode] || MODES.major;
    const B = this.bgmBus;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const s = this.step16 % 16, bar = Math.floor(this.step16 / 16);
      const section = Math.floor(bar / 8) % 2;                     // A / B
      const progA = [0, 5, 3, 4], progB = [3, 4, 2, 5];
      const prog = mood === 'event' ? [0, 0, 5, 4] : section ? progB : progA;
      const deg = prog[bar % 4];
      const t = this.nextTime;
      const note = d => { const k = deg + d; return st.root + scale[((k % scale.length) + scale.length) % scale.length] + 12 * Math.floor(k / scale.length); };
      const fill = bar % 8 === 7 && s >= 12;
      if (mood === 'croon') {
        if (s % 4 === 0) this._tone(mtof(note(0) - 24), spb * 3, 'triangle', 0.16, t, B);
        if (s === 0) [0, 2, 4].forEach(d => this._pad(mtof(note(d)), spb * 16, 0.035, t));
        if (s % 2 === 0) this._hat(t, s % 4 === 2 ? 0.05 : 0.02);
        if (s === 0 || s === 8) this._kick(t, 0.25);
      } else {
        // bass line (root / fifth / octave pattern)
        const bpat = mood === 'fever' ? [0, -1, 0, 7, 0, -1, 12, 7, 0, -1, 0, 7, 0, 12, 7, 5] : [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, -1, 0, -1, 12, -1, 7];
        if (bpat[s] >= 0) this._bass(mtof(note(0) - 24 + bpat[s]), spb * (mood === 'fever' ? 0.9 : 1.6), 0.2, t);
        // pads
        if (s === 0) [0, 2, 4, 6].forEach((d, i) => this._pad(mtof(note(d)), spb * 15.5, i === 3 ? 0.018 : 0.03, t));
        // keys / arpeggio
        const arp = mood === 'fever' ? [0, 2, 4, 7, 4, 2, 7, 9, 7, 4, 2, 4, 7, 9, 11, 9] : section ? [0, -1, 4, 2, -1, 4, 7, -1, 4, -1, 2, 4, -1, 7, 4, -1] : [0, -1, 2, -1, 4, -1, 2, 7, -1, 4, -1, 2, 4, -1, 7, -1];
        const p = arp[s];
        if (p >= 0) {
          const m = note(p) + 12;
          const lead = st.lead;
          if (lead === 'saw' || lead === 'brass') this.brass(mtof(m), spb * 1.4, 0.016, t - ctx.currentTime, { bus: B, cutoff: 2600, verb: 0.3, type: lead === 'brass' ? 'square' : 'sawtooth' });
          else this.bell(mtof(m), spb * (lead === 'pad' ? 4 : 2.2), lead === 'marimba' ? 0.06 : 0.045, t - ctx.currentTime, { bus: B, ratio: lead === 'marimba' ? 4 : lead === 'koto' ? 1.5 : 3.5, index: lead === 'koto' ? 3 : 1.6, verb: 0.5 });
        }
        // melody in section B
        if (section && s % 4 === 0 && Math.random() < 0.7) this.bell(mtof(note(pick([0, 2, 4, 7])) + 24), spb * 3, 0.03, t - ctx.currentTime, { bus: B, ratio: 2, index: 1, verb: 0.7 });
        // drums
        const four = mood === 'fever' || mood === 'event';
        if (s % 4 === 0 && (four || s === 0 || s === 8 || (s === 12 && section))) this._kick(t, 0.38);
        if ((s === 4 || s === 12) && !fill) this._snare(t, 0.13);
        if (fill && s % 1 === 0) this._snare(t, 0.05 + (s - 12) * 0.03);
        if (s % 2 === 1 || four) this._hat(t, s % 4 === 2 ? 0.045 : 0.022);
        if (s === 14 && bar % 2) this._hat(t, 0.05, true);
      }
      this.nextTime += spb;
      this.step16++;
    }
  }

  _tone(f, dur, type, vol, t, bus) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  _bass(f, dur, vol, t) {
    const ctx = this.ctx, B = this.bgmBus;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o2.type = 'sawtooth';
    o.frequency.value = f; o2.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 4;
    fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g2).connect(fl).connect(g); g.connect(B);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  _pad(f, dur, vol, t) {
    const ctx = this.ctx;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const d of [-9, 9]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
    fl.connect(g).connect(this.bgmBus);
    const vs = ctx.createGain(); vs.gain.value = 0.6; g.connect(vs).connect(this.verbSend);
  }
  _kick(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.bgmBus); o.start(t); o.stop(t + 0.25);
    this.noiseHit(t - ctx.currentTime, v * 0.15, 'highpass', 3000, 0.008, this.bgmBus);
  }
  _hat(t, v, open = false) { this.noiseHit(t - this.ctx.currentTime, v, 'highpass', 8500, open ? 0.18 : 0.035, this.bgmBus); }
  _snare(t, v) {
    this.noiseHit(t - this.ctx.currentTime, v, 'bandpass', 2000, 0.14, this.bgmBus, 0.8);
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
    g.gain.setValueAtTime(v * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.bgmBus); o.start(t); o.stop(t + 0.1);
  }
}
