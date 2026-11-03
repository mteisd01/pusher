import { createEngine } from './engine.js';
const handle = createEngine((m, tr) => self.postMessage(m, tr || []));
self.onmessage = e => handle(e.data, true);
