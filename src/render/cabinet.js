// Static cabinet of the medal pusher, built per theme from PBR materials:
// lacquered side towers with printed art, black gloss decks with LED dot strips and
// speaker grilles, acrylic side glass with chrome rails, a back-lit topper marquee,
// LED poles, a stainless payout tray and an art panel over the pusher.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { L, POCKET } from '../core/layout.js';
import { makeMaterials, panelArt, marqueeArt, grilleMaps, wornPlateMaps } from './materials.js';
import { makeFieldTexture } from './textures.js';

export const TRAY = { y: -1.35, z0: 0.35, z1: 2.25 }; // relative to L.frontZ
// LED poles stand outside the croon tower / lucky wheel even on narrow tables
export const POLE_X = W => Math.max(W + 1.6, 12.4);

const rbox = (w, h, d, r = 0.12, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

// A strip of individual LED dots (InstancedMesh). Colours are animated by the stage.
function dotStrip(from, to, spacing, size = 0.11) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const n = Math.max(2, Math.round(a.distanceTo(b) / spacing));
  const geo = new THREE.SphereGeometry(size, 8, 6);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { p.lerpVectors(a, b, i / (n - 1)); m.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m); mesh.setColorAt(i, new THREE.Color(1, 1, 1)); }
  mesh.userData.n = n;
  return mesh;
}

export function buildCabinet(theme, W, SCREEN) {
  const g = new THREE.Group();
  const M = makeMaterials(theme);
  const dots = [];      // LED dot strips: { mesh, phase }
  const ledMats = [];   // continuous LED strips (legacy colour animation)
  const glowMats = {};
  const add = (geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (opts.rx) m.rotation.x = opts.rx; if (opts.ry) m.rotation.y = opts.ry; if (opts.rz) m.rotation.z = opts.rz;
    if (opts.shadow) m.receiveShadow = true;
    if (opts.cast) m.castShadow = true;
    g.add(m); return m;
  };

  // ---- field floor: printed graphics under a clear coat on a worn steel plate
  const worn = wornPlateMaps();
  const ftex = makeFieldTexture(theme, W);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: ftex, metalness: 0.6, roughness: 1, roughnessMap: worn.rough, normalMap: worn.normal, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.5, clearcoatRoughness: 0.18 });
  const z0 = L.backWallZ, z1 = L.frontZ, P = POCKET;
  const shape = new THREE.Shape();
  shape.moveTo(-W, -z1); shape.lineTo(W, -z1); shape.lineTo(W, -z0); shape.lineTo(-W, -z0); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(P.x - P.hw, -(P.z - P.hd)); hole.lineTo(P.x - P.hw, -(P.z + P.hd)); hole.lineTo(P.x + P.hw, -(P.z + P.hd)); hole.lineTo(P.x + P.hw, -(P.z - P.hd)); hole.closePath();
  shape.holes.push(hole);
  const fg = new THREE.ShapeGeometry(shape);
  const pa = fg.attributes.position, uv = fg.attributes.uv;
  for (let i = 0; i < pa.count; i++) uv.setXY(i, (pa.getX(i) + W) / (2 * W), (pa.getY(i) + z1) / (z1 - z0));
  add(fg, floorMat, 0, 0, 0, { rx: -Math.PI / 2, shadow: true });
  // pocket shaft + rim
  add(new THREE.BoxGeometry(P.hw * 2, 2, P.hd * 2), new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.9, side: THREE.BackSide }), P.x, -1, P.z);
  glowMats.pocketRim = new THREE.MeshBasicMaterial({ color: theme.accent, toneMapped: false });
  for (const [w, d, x, z] of [[P.hw * 2 + 0.2, 0.1, 0, -P.hd - 0.05], [P.hw * 2 + 0.2, 0.1, 0, P.hd + 0.05], [0.1, P.hd * 2, -P.hw - 0.05, 0], [0.1, P.hd * 2, P.hw + 0.05, 0]])
    add(new THREE.BoxGeometry(w, 0.03, d), glowMats.pocketRim, P.x + x, 0.012, P.z + z);

  // ---- front: chrome lip, stainless chute and payout tray, lacquered front panel
  const FZ = L.frontZ;
  add(new THREE.CylinderGeometry(0.1, 0.1, W * 2 + 0.2, 20), M.chrome, 0, -0.1, FZ + 0.02, { rz: Math.PI / 2 });
  glowMats.payout = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.accent), toneMapped: false, transparent: true, opacity: 0.6 });
  add(new THREE.PlaneGeometry(W * 2, 0.12), glowMats.payout, 0, -0.3, FZ + 0.06);
  // chute (sloped plate from the lip down into the tray)
  add(new THREE.PlaneGeometry(W * 2 + 0.4, 1.3), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.55 }), 0, -0.78, FZ + 0.24, { rx: -0.2 });
  // tray
  const TY = TRAY.y, tz0 = FZ + TRAY.z0, tz1 = FZ + TRAY.z1, tw = W * 2 + 0.6;
  const trayMat = new THREE.MeshPhysicalMaterial({ color: 0x8a8e94, metalness: 1, roughness: 1, roughnessMap: worn.rough, normalMap: worn.normal, normalScale: new THREE.Vector2(0.5, 0.5) });
  add(new THREE.BoxGeometry(tw, 0.1, tz1 - tz0), trayMat, 0, TY - 0.05, (tz0 + tz1) / 2, { shadow: true });
  add(rbox(tw + 0.3, 0.7, 0.18, 0.06), M.chrome, 0, TY + 0.25, tz1 + 0.05);
  for (const sx of [-1, 1]) add(rbox(0.18, 0.7, tz1 - tz0 + 0.2, 0.06), M.chrome, sx * (tw / 2 + 0.05), TY + 0.25, (tz0 + tz1) / 2);
  // front panel with art + chrome kick bar
  const frontArt = panelArt(theme, 1024, 256, { logo: true, seed: 3 });
  const frontMat = new THREE.MeshPhysicalMaterial({ map: frontArt, metalness: 0.3, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 });
  add(rbox(W * 2 + 7, 3.0, 0.6, 0.15), M.paint, 0, -3.15, tz1 + 0.45);
  add(new THREE.PlaneGeometry(W * 2 + 3, 2.4), frontMat, 0, -3.15, tz1 + 0.76);
  add(new THREE.CylinderGeometry(0.12, 0.12, W * 2 + 7, 16), M.chrome, 0, -1.6, tz1 + 0.8, { rz: Math.PI / 2 });
  const fdots = dotStrip([-(W + 3), -1.72, tz1 + 0.78], [W + 3, -1.72, tz1 + 0.78], 0.42, 0.08); g.add(fdots); dots.push({ mesh: fdots, phase: 0 });
  // dark pit under the tray (catches the eye less than a void)
  add(new THREE.BoxGeometry(W * 2 + 6, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }), 0, -3.4, FZ + 2);

  // ---- side towers
  const towerZ0 = L.backZ - 0.5, towerZ1 = tz1 + 0.9, towerLen = towerZ1 - towerZ0, towerZc = (towerZ0 + towerZ1) / 2;
  const deckY = 3.6;
  const grille = grilleMaps();
  const grilleMat = new THREE.MeshStandardMaterial({ map: grille.map, normalMap: grille.normal, metalness: 0.7, roughness: 0.45 });
  const artSide = panelArt(theme, 2048, 256, { seed: 1 });
  const artMat = new THREE.MeshPhysicalMaterial({ map: artSide, metalness: 0.25, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06 });
  for (const sx of [-1, 1]) {
    const xi = sx * (W + 1.1), xc = sx * (W + 2.35);
    add(rbox(2.5, deckY + 4.5, towerLen, 0.18), M.paint, xc, (deckY - 4.5) / 2, towerZc, { shadow: true });
    // black gloss deck + chrome edge
    add(rbox(2.7, 0.18, towerLen + 0.1, 0.07), M.blackGloss, xc, deckY + 0.07, towerZc);
    add(new THREE.CylinderGeometry(0.08, 0.08, towerLen, 16), M.chrome, xi, deckY + 0.16, towerZc, { rx: Math.PI / 2 });
    add(new THREE.CylinderGeometry(0.08, 0.08, towerLen, 16), M.chrome, sx * (W + 3.6), deckY + 0.16, towerZc, { rx: Math.PI / 2 });
    // LED dot strip in a frosted channel along the deck
    add(new THREE.BoxGeometry(0.34, 0.05, towerLen - 1), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.6, transmission: 0, depthWrite: false }), xc, deckY + 0.2, towerZc);
    const d = dotStrip([xc, deckY + 0.18, towerZ0 + 0.6], [xc, deckY + 0.18, towerZ1 - 0.6], 0.36); g.add(d); dots.push({ mesh: d, phase: sx > 0 ? 0.5 : 0 });
    // speaker grille near the player
    const gz = towerZ1 - 2.2;
    add(new THREE.CircleGeometry(0.85, 40), grilleMat, xc, deckY + 0.17, gz, { rx: -Math.PI / 2 });
    add(new THREE.TorusGeometry(0.88, 0.07, 10, 40), M.chrome, xc, deckY + 0.18, gz, { rx: -Math.PI / 2 });
    // printed inner face (visible through the glass and above the gutter)
    const face = add(new THREE.PlaneGeometry(towerLen - 1, 4.8), artMat, xi - sx * 0.005, 1.2, towerZc + 0.3, { ry: -sx * Math.PI / 2 });
    face.receiveShadow = true;
    // gutter: dark steel channel with red LEDs (coins lost here)
    const gl = FZ - L.sideWallEnd;
    add(new THREE.BoxGeometry(1.1, 0.08, gl + 0.4), new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.8, roughness: 0.5 }), sx * (W + 0.55), -1.3, (FZ + L.sideWallEnd) / 2);
    glowMats['gutter' + sx] = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.4, toneMapped: false });
    add(new THREE.PlaneGeometry(0.9, gl), glowMats['gutter' + sx], sx * (W + 0.55), -1.24, (FZ + L.sideWallEnd) / 2, { rx: -Math.PI / 2 });
    const gd = dotStrip([sx * (W + 1.0), -0.6, L.sideWallEnd + 0.3], [sx * (W + 1.0), -0.6, FZ - 0.2], 0.5, 0.07); gd.userData.red = true; g.add(gd); dots.push({ mesh: gd, phase: 0, red: true });
    // acrylic side glass with polished top edge and chrome rail
    const gzl = L.sideWallEnd - L.backWallZ, gzc = (L.sideWallEnd + L.backWallZ) / 2;
    add(new THREE.BoxGeometry(0.06, 3.4, gzl), M.glass, sx * (W + 0.06), 1.7, gzc);
    add(new THREE.BoxGeometry(0.07, 0.03, gzl), M.glassEdge, sx * (W + 0.06), 3.41, gzc);
    add(new THREE.BoxGeometry(0.07, 3.4, 0.03), M.glassEdge, sx * (W + 0.06), 1.7, L.sideWallEnd);
    add(new THREE.CylinderGeometry(0.1, 0.1, gzl + 0.3, 16), M.chrome, sx * (W + 0.1), 3.5, gzc, { rx: Math.PI / 2 });
    const lm = new THREE.MeshBasicMaterial({ color: theme.led[0], toneMapped: false }); ledMats.push(lm);
    add(new THREE.BoxGeometry(0.08, 0.05, gzl), lm, sx * (W + 0.1), 3.36, gzc);
    add(new THREE.BoxGeometry(0.08, 0.05, gzl), lm, sx * (W + 0.1), 0.05, gzc);
    // LED pole beside the screen: chrome caps + frosted tube with a glowing core
    const px = sx * POLE_X(W), pz = L.backWallZ - 1.5;
    add(new THREE.CylinderGeometry(0.52, 0.6, 0.6, 24), M.chrome, px, 0.3, pz);
    if (Math.abs(px) > W + 3.4) add(rbox(1.4, 4.6, 1.4, 0.12), M.paint, px, -2.3, pz); // free-standing pole base on narrow tables
    add(new THREE.CylinderGeometry(0.52, 0.52, 0.5, 24), M.chrome, px, 11.75, pz);
    const core = new THREE.MeshBasicMaterial({ color: theme.led[1 % theme.led.length], toneMapped: false }); ledMats.push(core);
    add(new THREE.CylinderGeometry(0.18, 0.18, 11, 12), core, px, 6, pz);
    add(new THREE.CylinderGeometry(0.42, 0.42, 11, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.35, depthWrite: false, side: THREE.DoubleSide }), px, 6, pz);
  }

  // ---- back wall over the pusher: printed art panel with logo
  const bwArt = panelArt(theme, 2048, 360, { logo: true, seed: 2 });
  const bwFace = new THREE.MeshPhysicalMaterial({ map: bwArt, metalness: 0.3, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.04 });
  add(rbox(W * 2 + 0.2, 3.6, 1.0, 0.1), M.paint, 0, L.pusherH + 0.07 + 1.8, L.backWallZ - 0.5, { shadow: true });
  add(new THREE.PlaneGeometry(W * 2 - 0.2, 3.3), bwFace, 0, L.pusherH + 0.07 + 1.8, L.backWallZ + 0.005, { shadow: true });
  add(new THREE.CylinderGeometry(0.09, 0.09, W * 2 + 0.3, 16), M.chrome, 0, L.pusherH + 0.14, L.backWallZ + 0.02, { rz: Math.PI / 2 });
  const lm2 = new THREE.MeshBasicMaterial({ color: theme.led[1 % theme.led.length], toneMapped: false }); ledMats.push(lm2);
  add(new THREE.BoxGeometry(W * 2, 0.08, 0.06), lm2, 0, L.pusherH + 3.6, L.backWallZ + 0.02);

  // ---- backboard, screen bezel and topper marquee
  // backboard sits deeper so that the mechanical reel drums fit behind the screen windows
  add(rbox(W * 2 + 3.5, 10, 0.8, 0.2), M.paint, 0, 9.2, SCREEN.z - 1.4);
  // bezel: an open frame (top, bottom, sides) closing the gap between screen and backboard
  const bz = SCREEN.z - 0.52, bd = 1.3, bw2 = SCREEN.w + 1.7, bh2 = SCREEN.h + 1.7;
  add(rbox(bw2, 0.86, bd, 0.2), M.blackGloss, 0, SCREEN.y + bh2 / 2 - 0.43, bz);
  add(rbox(bw2, 0.86, bd, 0.2), M.blackGloss, 0, SCREEN.y - bh2 / 2 + 0.43, bz);
  for (const sx of [-1, 1]) add(rbox(0.86, bh2, bd, 0.2), M.blackGloss, sx * (bw2 / 2 - 0.43), SCREEN.y, bz);
  // dark reel box behind the screen
  add(new THREE.BoxGeometry(SCREEN.w, SCREEN.h, 0.05), new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.9 }), 0, SCREEN.y, SCREEN.z - 1.15);
  for (const [w, h, x, y] of [[SCREEN.w + 0.2, 0.08, 0, SCREEN.h / 2 + 0.06], [SCREEN.w + 0.2, 0.08, 0, -SCREEN.h / 2 - 0.06], [0.08, SCREEN.h + 0.2, SCREEN.w / 2 + 0.06, 0], [0.08, SCREEN.h + 0.2, -SCREEN.w / 2 - 0.06, 0]])
    add(new THREE.BoxGeometry(w, h, 0.1), M.chrome, x, SCREEN.y + y, SCREEN.z + 0.13);
  const topY = SCREEN.y + SCREEN.h / 2 + 1.75;
  const marq = marqueeArt(theme);
  const marqMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: marq, emissiveIntensity: 1.1, roughness: 0.2 });
  glowMats.marquee = marqMat;
  add(rbox(SCREEN.w + 2.6, 2.2, 1.0, 0.2), M.paint, 0, topY, SCREEN.z - 0.2);
  add(new THREE.PlaneGeometry(SCREEN.w + 1.8, 1.6), marqMat, 0, topY, SCREEN.z + 0.31);
  add(new THREE.PlaneGeometry(SCREEN.w + 1.8, 1.6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false }), 0, topY, SCREEN.z + 0.35);
  for (const y of [-0.85, 0.85]) add(new THREE.CylinderGeometry(0.07, 0.07, SCREEN.w + 2.4, 16), M.chrome, 0, topY + y, SCREEN.z + 0.33, { rz: Math.PI / 2 });

  return { group: g, dots, ledMats, glowMats, materials: M };
}
