// Convert a simulator snapshot (JSON) to the compact board format used by the game
import fs from 'fs';
import { encodeBoard } from '../src/save.js';
const [inp, out] = process.argv.slice(2);
const snap = JSON.parse(fs.readFileSync(inp, 'utf8'));
snap.objs = snap.objs.filter(a => a[3] > -0.05 && a[4] < 6.2);
fs.writeFileSync(out, encodeBoard(snap));
console.log(out, snap.objs.length, 'objects');
