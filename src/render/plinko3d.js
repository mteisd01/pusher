// Physical plinko board: hinged above the LCD, it swings down in front of the screen,
// the player picks the drop position, and the ball (simulated by plinkoPhysics in the
// physics engine) bounces through the pins into one of the pockets.
import * as THREE from 'three';
import { PLINKO_BOARD, plinkoPins } from '../core/plinkoPhysics.js';
import { makeBallTexture } from './textures.js';

const B = PLINKO_BOARD;

function boardArt(pockets) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 860;
  const g = c.getContext('2d');
  const sx = c.width / B.w, sy = c.height / B.h;
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, '#1b0f3a'); grd.addColorStop(0.7, '#2a0f45'); grd.addColorStop(1, '#100820');
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  // diagonal light lines
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 6;
  for (let i = -10; i < 20; i++) { g.beginPath(); g.moveTo(i * 80, 0); g.lineTo(i * 80 + 400, c.height); g.stroke(); }
  g.font = '900 64px "Arial Black", Arial'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,211,77,0.18)';
  g.fillText('PLINKO', c.width / 2, 90);
  // pockets
  const sw = B.w / B.slots;
  pockets.forEach((p, i) => {
    const x0 = i * sw * sx, w = sw * sx, h = B.pocketH * sy;
    g.fillStyle = p.color || '#444'; g.globalAlpha = 0.85; g.fillRect(x0 + 3, c.height - h, w - 6, h); g.globalAlpha = 1;
    g.fillStyle = p.ball ? '#1a1a1a' : '#fff'; g.font = `900 ${p.label.length > 2 ? 30 : 38}px Arial`; g.textBaseline = 'middle';
    g.fillText(p.label, x0 + w / 2, c.height - h / 2);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class Plinko3D {
  constructor(scene, stage, audio, screen, pockets) {
    this.stage = stage; this.audio = audio;
    this.scale = Math.min(0.94, (screen.h + 0.2) / B.h);
    this.hinge = new THREE.Group();
    this.hinge.position.set(0, screen.y + screen.h / 2 + 0.25, screen.z + 0.55);
    scene.add(this.hinge);
    this.board = new THREE.Group();
    this.board.scale.setScalar(this.scale);
    this.board.position.set(0, -B.h * this.scale, 0);     // board hangs below the hinge
    this.hinge.add(this.board);
    const chrome = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, metalness: 1, roughness: 0.1 });
    this.artMat = new THREE.MeshStandardMaterial({ map: boardArt(pockets), roughness: 0.5, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.25 });
    this.artMat.emissiveMap = this.artMat.map;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h), this.artMat); back.position.set(0, B.h / 2, -0.3);
    this.board.add(back);
    // frame
    const frame = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.75), chrome); m.position.set(x, y, 0); this.board.add(m); };
    frame(B.w + 0.6, 0.3, 0, B.h + 0.15); frame(B.w + 0.6, 0.3, 0, -0.15);
    frame(0.3, B.h, -B.w / 2 - 0.15, B.h / 2); frame(0.3, B.h, B.w / 2 + 0.15, B.h / 2);
    // pins
    const pins = plinkoPins();
    const pinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(B.pin, B.pin, 0.6, 10), chrome, pins.length);
    const m4 = new THREE.Matrix4(), rx = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    pins.forEach(([x, y], i) => { m4.copy(rx).setPosition(x, y, 0); pinMesh.setMatrixAt(i, m4); });
    this.board.add(pinMesh);
    this.pinFlash = [];
    // pocket dividers
    const sw = B.w / B.slots;
    for (let k = 1; k < B.slots; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.08, B.pocketH, 0.6), chrome); d.position.set(-B.w / 2 + k * sw, B.pocketH / 2, 0); this.board.add(d); }
    // front glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false }));
    glass.position.set(0, B.h / 2, 0.34); this.board.add(glass);
    // launcher (moves along the top)
    this.launcher = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.5, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }));
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), new THREE.MeshBasicMaterial({ color: 0xff4060, toneMapped: false }));
    this.arrow.rotation.x = Math.PI; this.arrow.position.y = -0.55;
    this.launcher.add(body, this.arrow);
    this.launcher.position.set(0, B.h - 0.1, 0);
    this.board.add(this.launcher);
    // guide showing the allowed aim range
    const rail = new THREE.Mesh(new THREE.BoxGeometry(B.aim * 2 + 0.8, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false }));
    rail.position.set(0, B.h + 0.32, 0.4); this.board.add(rail);
    // ball
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(B.ball, 24, 16), new THREE.MeshPhysicalMaterial({ map: makeBallTexture(), metalness: 0.85, roughness: 0.12, clearcoat: 1 }));
    this.ball.visible = false; this.board.add(this.ball);
    this.light = new THREE.PointLight(0xffd34d, 0, 5, 2); this.board.add(this.light);
    this.open = 0;          // 0 = folded back behind the screen, 1 = hanging in front
    this.want = 0;
    this.active = false;
    this.aim = 0;
    this.hinge.visible = false;
    this.screen = screen;
  }

  // runs one game: resolves with the pocket index
  run(physics, opts = {}) {
    this.physics = physics;
    this.active = true; this.want = 1; this.hinge.visible = true;
    this.state = 'aim'; this.t = 0; this.result = null; this.lastS = null;
    this.camFocus = opts.camera !== false;
    if (this.camFocus) {
      const S = this.screen;
      this.stage.setFocus({ look: new THREE.Vector3(0, S.y - 0.3, S.z), pos: new THREE.Vector3(0, S.y + 6.2, S.z + 9.2) });
    }
    this.audio.sweep && this.audio.sweep(200, 500, 0.6, 0.08);
    return new Promise(res => { this.resolve = res; });
  }

  setAim(u) { if (this.state === 'aim') this.aim = Math.max(-1, Math.min(1, u)) * B.aim; }
  // world x under the pointer (the board hangs right behind the drop lane, so x maps ~1:1)
  setAimWorld(x) { this.setAim(x / (this.scale * B.aim)); }
  drop() {
    if (this.state !== 'aim' || this.open < 0.95) return;
    this.state = 'fall'; this.t = 0;
    this.physics.cmd('plinkoDrop', this.aim);
    this.audio.ui && this.audio.ui();
  }

  onPhysics(p) {
    if (!this.active || !p) return;
    if (p.s) this.lastS = p.s;
    if (p.hits) for (let i = 0; i < Math.min(3, p.hits); i++) this.audio.pin && this.audio.pin(Math.floor(Math.random() * 8));
    if (p.slot >= 0 && this.state === 'fall') { this.state = 'done'; this.t = 0; this.result = p.slot; }
  }

  update(dt) {
    this.open += Math.sign(this.want - this.open) * Math.min(Math.abs(this.want - this.open), dt * 1.6);
    const e = this.open * this.open * (3 - 2 * this.open);
    this.hinge.rotation.x = (1 - e) * Math.PI / 2 * 1.05;   // folded back behind the screen
    if (!this.active && this.open <= 0) { this.hinge.visible = false; return; }
    this.t = (this.t || 0) + dt;
    this.artMat.emissiveIntensity = 0.2 + (this.state === 'done' ? 0.25 * (Math.sin(this.t * 20) > 0 ? 1 : 0) : 0);
    if (this.state === 'aim') {
      this.launcher.position.x += (this.aim - this.launcher.position.x) * Math.min(1, dt * 12);
      this.arrow.material.color.setHSL(0.97, 1, 0.45 + 0.2 * Math.sin(this.t * 10));
      this.ball.visible = this.open > 0.95;
      this.ball.position.set(this.launcher.position.x, B.h - 0.35, 0);
      if (this.t > 6 && this.open >= 1) this.drop();
    }
    if ((this.state === 'fall' || this.state === 'done') && this.lastS) {
      const s = this.lastS;
      this.ball.position.set(s[0], s[1], 0);
      this.ball.quaternion.set(0, 0, s[2], s[3]);
    }
    this.light.intensity = this.ball.visible ? 2.5 : 0;
    this.light.position.copy(this.ball.position).add(new THREE.Vector3(0, 0, 0.8));
    if (this.state === 'done' && this.t > 1.3) {
      this.state = 'close'; this.want = 0; this.ball.visible = false;
      if (this.camFocus) this.stage.setFocus(null);
      const r = this.result;
      this.active = false;
      this.resolve && this.resolve(r);
    }
  }

  abort() { if (this.active) { this.physics && this.physics.cmd('plinkoStop'); this.state = 'done'; this.result = 4; this.t = 10; } }
}
