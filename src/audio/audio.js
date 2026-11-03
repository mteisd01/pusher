// Fully synthesized audio: metallic coin clinks, payouts, slot sounds, fanfares, procedural BGM.
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], pentatonic: [0, 2, 4, 7, 9, 12, 14],
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, bgm: 0.45, se: 0.8 };
    this.bgmOn = true;
    this.style = { bpm: 96, root: 57, mode: 'major', lead: 'bell' };
    this.fever = false;
    this.lastClink = 0;
    this.clinkBudget = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = ctx.createGain();
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.master.connect(this.comp).connect(ctx.destination);
      this.seBus = ctx.createGain(); this.seBus.connect(this.master);
      this.bgmBus = ctx.createGain(); this.bgmBus.connect(this.master);
      // shared reverb
      this.verb = ctx.createConvolver();
      this.verb.buffer = this._impulse(1.6, 2.5);
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.18;
      this.verbSend.connect(this.verb).connect(this.master);
      this.noise = this._noiseBuffer();
      this.applyVolume();
      this._startScheduler();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) { Object.assign(this.vol, v); this.applyVolume(); }
  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.seBus.gain.setTargetAtTime(this.vol.se, t, 0.05);
    this.bgmBus.gain.setTargetAtTime(this.bgmOn ? this.vol.bgm * 0.5 : 0, t, 0.2);
  }
  setMuted(m) { this.muted = m; this.applyVolume(); }
  setStyle(s) { this.style = { ...this.style, ...s }; }

  _impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  _noiseBuffer() {
    const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // Metallic coin-on-coin clink: inharmonic partials + click transient
  clink(strength = 0.6, pitch = 1, pan = 0, when = 0) {
    if (!this.ctx || this.vol.se <= 0) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    if (when === 0) {
      if (t - this.lastClink < 0.012) return;
      this.lastClink = t;
    }
    const out = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p).connect(this.seBus); } else out.connect(this.seBus);
    out.connect(this.verbSend);
    const f0 = (2600 + Math.random() * 1600) * pitch;
    const ratios = [1, 1.47, 2.09, 2.56, 3.17];
    const amp = 0.09 * strength;
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f0 * r * (1 + (Math.random() - 0.5) * 0.02);
      const dur = (0.25 - i * 0.035) * (0.5 + strength * 0.7);
      g.gain.setValueAtTime(amp / (1 + i * 0.6), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, dur));
      o.connect(g).connect(out);
      o.start(t); o.stop(t + dur + 0.02);
    });
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 5000;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.12 * strength, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(nf).connect(ng).connect(out);
    n.start(t, Math.random() * 0.5, 0.03);
  }

  // Thud of a coin landing on the steel plate / pile
  thud(strength = 0.5, pan = 0) {
    if (!this.ctx) return;
    this.clink(strength * 0.7, 0.75 + Math.random() * 0.2, pan);
  }

  // Coins pouring into the payout tray
  payout(n = 1, pan = 0) {
    if (!this.ctx) return;
    const k = Math.min(6, n);
    for (let i = 0; i < k; i++) this.clink(0.5 + Math.random() * 0.4, 0.62 + Math.random() * 0.25, pan + (Math.random() - 0.5) * 0.3, i * 0.035 + Math.random() * 0.02);
  }

  tone(freq, dur, type = 'sine', vol = 0.15, when = 0, opts = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.filter; o.connect(f); node = f; }
    node.connect(g); g.connect(opts.bus || this.seBus);
    if (opts.verb !== false) g.connect(this.verbSend);
    o.start(t); o.stop(t + dur + 0.05);
  }

  ui() { this.tone(1400, 0.06, 'triangle', 0.08); }
  drop() { this.tone(520, 0.08, 'square', 0.03, 0, { slide: 260, filter: 2000 }); }
  gate() { [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(84 + s), 0.18, 'triangle', 0.12, i * 0.05)); }
  stock() { this.tone(mtof(91), 0.12, 'sine', 0.1); }
  reelTick() { this.tone(1800 + Math.random() * 300, 0.025, 'square', 0.025, 0, { filter: 4000, verb: false }); }
  reelStop(i = 0) { this.tone(220 - i * 20, 0.12, 'square', 0.12, 0, { filter: 900 }); this.clink(0.4, 0.5); }
  reach() {
    for (let i = 0; i < 8; i++) this.tone(mtof(72 + i), 0.14, 'sawtooth', 0.06, i * 0.09, { filter: 3000 });
  }
  lose() { this.tone(330, 0.25, 'triangle', 0.07, 0, { slide: 200 }); }
  winSmall() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(mtof(79 + s), 0.25, 'square', 0.07, i * 0.07, { filter: 4000 })); }
  winBig() {
    const seq = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => { this.tone(mtof(72 + s), 0.3, 'square', 0.08, i * 0.09, { filter: 5000 }); this.tone(mtof(60 + s), 0.3, 'triangle', 0.08, i * 0.09); });
    for (let i = 0; i < 10; i++) this.clink(0.6, 1, (Math.random() - 0.5), 0.1 + i * 0.07);
  }
  fanfare() {
    const ch = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]];
    ch.forEach((c, i) => c.forEach(s => { this.tone(mtof(67 + s), 0.5, 'sawtooth', 0.05, i * 0.22, { filter: 3500 }); this.tone(mtof(55 + s), 0.6, 'triangle', 0.06, i * 0.22); }));
  }
  jackpot() {
    this.fanfare();
    for (let i = 0; i < 40; i++) this.clink(0.7, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 1.6, 0.8 + i * 0.05);
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(84 + s), 0.6, 'sine', 0.1, 1 + i * 0.08));
  }
  itemGet() { [0, 7, 12, 19].forEach((s, i) => this.tone(mtof(88 + s), 0.2, 'sine', 0.12, i * 0.06)); }
  levelUp() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(72 + s), 0.3, 'triangle', 0.12, i * 0.06)); }
  wall() { this.tone(120, 0.6, 'sawtooth', 0.12, 0, { slide: 360, filter: 1200 }); }
  combo(n) { this.tone(mtof(76 + Math.min(24, n / 2)), 0.12, 'triangle', 0.1); }
  rouletteTick(p = 1) { this.tone(2000 * p, 0.03, 'square', 0.04, 0, { filter: 5000, verb: false }); }
  lost() { this.tone(180, 0.18, 'sine', 0.06, 0, { slide: 90 }); }

  // ---------- Procedural BGM ----------
  _startScheduler() {
    this.step16 = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.bar = 0;
    const prog = [[0, 4], [5, 3], [3, 3], [4, 4]]; // scale degree, chord len (unused)
    this.prog = prog;
    setInterval(() => this._schedule(), 50);
  }

  _schedule() {
    if (!this.ctx || !this.bgmOn || this.vol.bgm <= 0 || this.ctx.state !== 'running') { if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1; return; }
    const st = this.style, fever = this.fever;
    const bpm = fever ? st.bpm * 1.3 : st.bpm;
    const spb = 60 / bpm / 4;
    const scale = MODES[fever ? 'major' : st.mode] || MODES.major;
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const s = this.step16 % 16, barIdx = Math.floor(this.step16 / 16);
      const degs = [0, 5, 3, 4];
      const deg = degs[barIdx % 4];
      const chordRoot = st.root + scale[deg % scale.length] + (deg >= scale.length ? 12 : 0);
      const t = this.nextTime;
      const note = d => st.root + scale[((deg + d) % scale.length + scale.length) % scale.length] + 12 * Math.floor((deg + d) / scale.length);
      // bass
      if (s % 4 === 0) this._bgmTone(mtof(chordRoot - 24), spb * 3.5, 'triangle', 0.22, t);
      // pad chord at bar start
      if (s === 0) [0, 2, 4].forEach(d => this._bgmTone(mtof(note(d)), spb * 15, 'sine', 0.05, t, 0.3));
      // arpeggio / lead
      const pat = fever ? [0, 2, 4, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 4, 7, 11] : [0, -1, 2, -1, 4, -1, 2, 7, -1, 4, -1, 2, 4, -1, 7, -1];
      const p = pat[s];
      if (p >= 0 && (fever || Math.random() < 0.85)) {
        const m = note(p) + 12;
        const type = { bell: 'sine', saw: 'sawtooth', marimba: 'triangle', koto: 'triangle', pad: 'sine', brass: 'square' }[st.lead] || 'sine';
        this._bgmTone(mtof(m), spb * (st.lead === 'pad' ? 3 : 1.6), type, st.lead === 'saw' || st.lead === 'brass' ? 0.035 : 0.07, t, 0.005, st.lead === 'saw' || st.lead === 'brass' ? 2400 : 0);
        if (st.lead === 'bell') this._bgmTone(mtof(m + 24) * 1.003, spb * 1.2, 'sine', 0.015, t);
      }
      // drums
      if (s % 4 === 0) this._kick(t, fever ? 0.5 : 0.35);
      if (s % 2 === 1 || fever) this._hat(t, s % 4 === 2 ? 0.05 : 0.025);
      if (s === 4 || s === 12) this._snare(t, 0.12);
      this.nextTime += spb;
      this.step16++;
    }
  }

  _bgmTone(f, dur, type, vol, t, attack = 0.005, filter = 0) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); n = fl; }
    n.connect(g); g.connect(this.bgmBus);
    g.connect(this.verbSend);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _kick(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.bgmBus); o.start(t); o.stop(t + 0.2);
  }
  _hat(t, v) {
    const ctx = this.ctx, n = ctx.createBufferSource(); n.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(f).connect(g).connect(this.bgmBus); n.start(t, Math.random() * 0.5, 0.05);
  }
  _snare(t, v) {
    const ctx = this.ctx, n = ctx.createBufferSource(); n.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f).connect(g).connect(this.bgmBus); n.start(t, Math.random() * 0.5, 0.13);
  }
}
