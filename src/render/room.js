// The arcade around the machine: carpet, neighbouring cabinets, ceiling lights and neon.
// It fills the background instead of a flat gradient and the very same light layout is
// used to build the environment map, so metal reflections match the visible room.
import * as THREE from 'three';
import { carpetMaps, neighborScreen, shade } from './materials.js';

const TAU = Math.PI * 2;

function neonText(text, color, w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `900 ${h * 0.62}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = h * 0.25; g.fillStyle = color;
  for (let i = 0; i < 3; i++) g.fillText(text, w / 2, h / 2, w * 0.95);
  g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.7; g.fillText(text, w / 2, h / 2, w * 0.95);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// detail: 'off' | 'simple' | 'full'
export function buildRoom(theme, halfW, detail = 'full') {
  const g = new THREE.Group();
  g.name = 'room';
  const anim = [];
  if (detail === 'off') return { group: g, anim, update() {} };
  // carpet
  const carpet = carpetMaps(theme);
  carpet.repeat.set(14, 14);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95, metalness: 0, color: 0x4a4a4a }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4.6; floor.receiveShadow = true;
  g.add(floor);
  // back wall of the hall + neon signs
  const wallMat = new THREE.MeshStandardMaterial({ color: shade(theme.bgTop, 0.8), roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(220, 60), wallMat);
  wall.position.set(0, 25, -75); g.add(wall);
  const signs = [['MEDAL', theme.led[0]], ['JACKPOT', theme.accent], ['PRIZE', theme.led[1 % theme.led.length]], ['★ GAME ★', theme.led[2 % theme.led.length]]];
  signs.forEach(([txt, col], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: neonText(txt, col), transparent: true, toneMapped: false, depthWrite: false, fog: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    m.position.set((i - 1.5) * 26, 20 + (i % 2) * 6, -74); g.add(m);
    anim.push(t => { m.material.opacity = 0.75 + 0.25 * (Math.sin(t * 2.3 + i * 1.7) > -0.9 ? 1 : 0.2); });
  });
  // neighbouring medal machines (silhouettes with glowing screens and LED bars)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15151a, metalness: 0.4, roughness: 0.5 });
  const places = [];
  const off = halfW + 19;
  for (const sx of [-1, 1]) {
    places.push([sx * off, -12, 0.35 * sx], [sx * (off + 17), -20, 0.55 * sx]);
    if (detail === 'full') places.push([sx * (off + 32), -30, 0.7 * sx]);
  }
  if (detail === 'full') for (let i = -2; i <= 2; i++) places.push([i * 20, -46, 0]);
  places.forEach(([x, z, rotY], i) => {
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 14), bodyMat); body.position.y = 0; m.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 3), bodyMat); top.position.set(0, 9, -5); m.add(top);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(11, 6), new THREE.MeshBasicMaterial({ map: neighborScreen(theme, i), toneMapped: false, color: new THREE.Color(0.55, 0.55, 0.55) }));
    scr.position.set(0, 9.3, -3.45); m.add(scr);
    const ledMat = new THREE.MeshBasicMaterial({ color: theme.led[i % theme.led.length], toneMapped: false });
    for (const lx of [-7.6, 7.6]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 16, 0.4), ledMat); bar.position.set(lx, 4, -4); m.add(bar); }
    const lip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 0.3), ledMat); lip.position.set(0, 4.6, 7); m.add(lip);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.9, roughness: 0.35 }));
    field.rotation.x = -Math.PI / 2; field.position.set(0, 4.55, 2); m.add(field);
    m.position.set(x, -0.1, z); m.rotation.y = rotY;
    g.add(m);
    const base = new THREE.Color(theme.led[i % theme.led.length]);
    anim.push(t => { ledMat.color.copy(base).multiplyScalar(0.6 + 0.4 * Math.max(0, Math.sin(t * (1.5 + i * 0.37) + i))); });
  });
  // ceiling light panels (visible at the top of tall/low camera views)
  if (detail === 'full') {
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.light).multiplyScalar(1.2), toneMapped: false, fog: false });
    const panelGeo = new THREE.PlaneGeometry(6, 1.2);
    const n = 5 * 4, inst = new THREE.InstancedMesh(panelGeo, panelMat, n);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    let k = 0;
    for (let ix = -2; ix <= 2; ix++) for (let iz = 0; iz < 4; iz++) mtx.compose(new THREE.Vector3(ix * 18, 34, -10 - iz * 18), q, new THREE.Vector3(1, 1, 1)), inst.setMatrixAt(k++, mtx);
    g.add(inst);
  }
  return {
    group: g, anim,
    update(t) { for (const f of anim) f(t); },
  };
}

// Environment for reflections: a dim hall with soft-boxes over the machine, a grid of
// ceiling panels and coloured glows where the neighbouring machines stand.
export function makeEnvScene(theme) {
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.bgTop).lerp(new THREE.Color('#34343c'), 0.6), side: THREE.BackSide }));
  room.position.y = 10; sc.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.bgBottom).lerp(new THREE.Color('#202028'), 0.5) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4.9; sc.add(floor);
  const box = (w, h, x, y, z, color, k, lookY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, lookY, 0); sc.add(m);
  };
  box(34, 12, 0, 22, 2, '#ffffff', 1.8);        // canopy soft-box over the field
  box(20, 6, 0, 18, -14, '#ffffff', 1.4);       // back-top
  box(10, 4, -14, 14, 14, theme.light, 1.8);    // key soft-boxes
  box(10, 4, 14, 14, 14, theme.light, 1.8);
  box(40, 8, 0, 8, 28, '#ffffff', 0.85);        // front fill (player side)
  box(30, 6, 0, 4, -28, theme.accent, 0.7);     // back glow
  // ceiling panel grid
  for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) if (Math.abs(ix) + Math.abs(iz) > 1) box(4, 1.2, ix * 10, 24.5, iz * 10, theme.light, 1.1, -100);
  // neighbouring machines: coloured glows left & right
  const lc = theme.led;
  box(8, 12, -28, 4, -4, lc[0], 1.6); box(8, 12, 28, 4, -4, lc[1 % lc.length], 1.6);
  box(6, 8, -27, 4, 12, lc[2 % lc.length], 1.0); box(6, 8, 27, 4, 12, lc[0], 1.0);
  box(10, 3, -16, 12, -28, theme.accent, 1.0); box(10, 3, 16, 12, -28, lc[1 % lc.length], 1.0);
  return sc;
}
