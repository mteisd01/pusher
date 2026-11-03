// Message-driven wrapper around PusherPhysics; shared by worker and inline mode.
import RAPIER from '@dimforge/rapier3d-compat';
import { PusherPhysics } from './physics.js';

export function createEngine(post) {
  let phys = null;
  let buf = null;
  const ev = [];
  const handle = async (msg, transferBack) => {
    switch (msg.t) {
      case 'init': {
        await RAPIER.init();
        phys = new PusherPhysics(RAPIER, { hz: msg.hz, iterations: msg.iterations });
        phys.strokeBonus = msg.stroke || 0;
        if (msg.snapshot && msg.snapshot.objs && msg.snapshot.objs.length) phys.restore(msg.snapshot);
        else if (msg.prefill) phys.prefill(msg.prefill);
        post({ t: 'ready', count: phys.objs.length });
        break;
      }
      case 'step': {
        if (!phys) return;
        if (msg.buf) buf = msg.buf;
        for (const c of msg.cmds || []) apply(c);
        ev.length = 0; ev.impacts = 0;
        const t0 = performance.now();
        phys.step(msg.dt, ev);
        const ms = performance.now() - t0;
        buf = phys.pack(buf);
        const out = { t: 'frame', buf, ev: ev.slice(), ms, n: phys.objs.length };
        if (msg.snap) out.snap = phys.snapshot();
        post(out, transferBack ? [buf.buffer] : undefined);
        buf = null;
        break;
      }
    }
  };
  function apply(c) {
    switch (c[0]) {
      case 'spawn': phys.spawn(c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9]); break;
      case 'walls': phys.wallsUp = !!c[1]; break;
      case 'pocket': phys.pocketOpen = !!c[1]; break;
      case 'magnet': phys.magnet = !!c[1]; break;
      case 'blast': phys.blast(c[1], c[2], c[3], c[4]); break;
      case 'speed': phys.speed = c[1]; break;
      case 'stroke': phys.strokeBonus = c[1]; break;
      case 'hz': phys.setHz(c[1]); break;
      case 'iters': phys.setIterations(c[1]); break;
      case 'clear': phys.clear(); break;
      case 'prefill': phys.prefill(c[1]); break;
      case 'restore': phys.restore(c[1]); break;
      case 'trim': {
        // remove the oldest coins resting far from the front when over budget
        const over = phys.objs.length - c[1];
        if (over > 0) {
          const cand = phys.objs.filter(o => o.kind <= 1).sort((a, b) => a.z - b.z).slice(0, over);
          for (const o of cand) phys.remove(o);
          phys.objs = phys.objs.filter(o => !o.dead);
        }
        break;
      }
    }
  }
  return handle;
}
