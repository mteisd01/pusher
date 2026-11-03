import * as THREE from 'three';

// Coin with rounded (beveled) rims. Group 0 = faces + bevels (face texture),
// group 1 = reeded side band.
export function makeCoinGeometry(r, hh, bevel = 0.03, seg = 40, bevelSteps = 3) {
  const pos = [], nor = [], uv = [], idx = [];
  const groups = [];
  const push = (x, y, z, nx, ny, nz, u, v) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); return pos.length / 3 - 1; };
  const faceUV = (x, z, flip) => [0.5 + (flip ? -x : x) / (2 * r), 0.5 - z / (2 * r)];
  let start = 0;
  for (const side of [1, -1]) {
    const y = side * hh, flip = side < 0;
    const c = push(0, y, 0, 0, side, 0, 0.5, 0.5);
    const ringStart = pos.length / 3;
    // concentric rings: face disc edge, then bevel steps
    const rings = [];
    for (let b = 0; b <= bevelSteps; b++) {
      const a = (b / bevelSteps) * Math.PI / 2;
      rings.push({ rr: r - bevel + bevel * Math.sin(a), yy: y - side * bevel * (1 - Math.cos(a)), nr: Math.sin(a), ny: Math.cos(a) * side });
    }
    for (const rg of rings) {
      for (let i = 0; i <= seg; i++) {
        const t = i / seg * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
        const x = cs * rg.rr, z = sn * rg.rr;
        const [u, v] = faceUV(cs * Math.min(rg.rr, r * 0.999), sn * Math.min(rg.rr, r * 0.999), flip);
        push(x, rg.yy, z, cs * rg.nr, rg.ny, sn * rg.nr, u, v);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a = ringStart + i, b = ringStart + i + 1;
      if (side > 0) idx.push(c, b, a); else idx.push(c, a, b);
    }
    for (let k = 0; k < bevelSteps; k++) {
      const r0 = ringStart + k * (seg + 1), r1 = r0 + seg + 1;
      for (let i = 0; i < seg; i++) {
        const a = r0 + i, b = r0 + i + 1, d = r1 + i, e = r1 + i + 1;
        if (side > 0) idx.push(a, b, e, a, e, d); else idx.push(a, e, b, a, d, e);
      }
    }
  }
  groups.push([start, idx.length, 0]);
  start = idx.length;
  // side band
  const sb = pos.length / 3, y0 = hh - bevel, y1 = -hh + bevel;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
    push(cs * r, y0, sn * r, cs, 0, sn, i / seg, 1);
    push(cs * r, y1, sn * r, cs, 0, sn, i / seg, 0);
  }
  for (let i = 0; i < seg; i++) {
    const a = sb + i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  groups.push([start, idx.length - start, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  for (const [s, c, m] of groups) g.addGroup(s, c, m);
  g.computeTangents?.();
  g.computeBoundingSphere();
  return g;
}

// Brilliant-cut-ish gem matching the physics hull
export function makeGemGeometry() {
  const r = 0.5, h = 0.38, crownY = 0.2, girdleY = 0.06, n = 8;
  const pts = [];
  const top = new THREE.Vector3(0, crownY, 0);
  const girdle = [], table = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2; girdle.push(new THREE.Vector3(Math.cos(a) * r, girdleY, Math.sin(a) * r));
    const b = (i + 0.5) / n * Math.PI * 2; table.push(new THREE.Vector3(Math.cos(b) * r * 0.6, crownY, Math.sin(b) * r * 0.6));
  }
  const bottom = new THREE.Vector3(0, -h, 0);
  const tri = (a, b, c) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < n; i++) {
    const g0 = girdle[i], g1 = girdle[(i + 1) % n], t0 = table[i], tp = table[(i - 1 + n) % n];
    tri(top, table[(i + 1) % n], t0);
    tri(g0, t0, g1);
    tri(g1, t0, table[(i + 1) % n]);
    tri(g0, tp, t0);
    tri(bottom, g0, g1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.computeVertexNormals();
  return g;
}
