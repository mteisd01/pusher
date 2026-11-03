// Main-thread proxy for the physics engine (Web Worker with inline fallback)
export class PhysicsClient {
  constructor() {
    this.cmds = [];
    this.busy = false;
    this.pendingDt = 0;
    this.onFrame = null;
    this.buf = null;
    this.lastMs = 0;
    this.count = 0;
    this.wantSnap = null;
  }

  async init(opts) {
    let useWorker = typeof Worker !== 'undefined' && opts.worker !== false;
    if (useWorker) {
      try {
        this.worker = new Worker(new URL('./physicsWorker.js', import.meta.url), { type: 'module' });
        await this._init(opts, msg => this.worker.postMessage(msg, msg.buf ? [msg.buf.buffer] : []), h => { this.worker.onmessage = e => h(e.data); }, 8000);
        this.mode = 'worker';
        return;
      } catch (e) {
        console.warn('Worker physics failed, falling back to inline', e);
        try { this.worker && this.worker.terminate(); } catch (_) {}
        this.worker = null;
      }
    }
    const { createEngine } = await import('./engine.js');
    let recv;
    const handle = createEngine(m => queueMicrotask(() => recv && recv(m)));
    await this._init(opts, msg => handle(msg, false), h => { recv = h; }, 15000);
    this.mode = 'inline';
  }

  _init(opts, send, listen, timeout) {
    this.send = send;
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('physics init timeout')), timeout);
      listen(m => {
        if (m.t === 'ready') { clearTimeout(to); this.count = m.count; resolve(); }
        else if (m.t === 'frame') this._frame(m);
      });
      send({ t: 'init', hz: opts.hz, iterations: opts.iterations, stroke: opts.stroke, snapshot: opts.snapshot, prefill: opts.prefill });
    });
  }

  _frame(m) {
    this.busy = false;
    this.lastMs = m.ms;
    this.count = m.n;
    this.buf = m.buf;
    if (m.snap && this.wantSnap) { const r = this.wantSnap; this.wantSnap = null; r(m.snap); }
    this.onFrame && this.onFrame(m);
  }

  cmd(...c) { this.cmds.push(c); }

  // Called every animation frame
  tick(dt) {
    this.pendingDt += dt;
    if (this.busy) {
      if (this.pendingDt > 0.25) this.pendingDt = 0.25;
      return;
    }
    const msg = { t: 'step', dt: this.pendingDt, cmds: this.cmds, snap: !!this.wantSnap };
    if (this.buf && this.mode === 'worker') { msg.buf = this.buf; this.buf = null; }
    this.cmds = [];
    this.pendingDt = 0;
    this.busy = true;
    this.send(msg);
  }

  snapshot() {
    return new Promise(res => { this.wantSnap = res; });
  }
}
