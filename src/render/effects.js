// Particle sparkles and confetti
import * as THREE from 'three';
import { makeSparkleSprite } from './textures.js';

const MAXP = 1500, MAXC = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.amount = 1;
    // sparkles
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAXP * 3);
    this.pCol = new Float32Array(MAXP * 3);
    this.pSize = new Float32Array(MAXP);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeSparkleSprite() }, scale: { value: 400 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC;
        uniform float scale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb*1.6,t.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = [];
    // confetti
    this.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.16), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), MAXC);
    this.conf.count = 0; this.conf.frustumCulled = false;
    this.conf.setColorAt(0, new THREE.Color());
    scene.add(this.conf);
    this.confs = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
  }

  setScale(h) { this.points.material.uniforms.scale.value = h * 0.6; }

  burst(x, y, z, color = '#ffd34d', n = 14, speed = 4, size = 0.6, life = 0.8) {
    n = Math.round(n * this.amount);
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.parts.length < MAXP; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      const r = Math.sqrt(1 - u * u);
      this.parts.push({ x, y, z, vx: Math.cos(a) * r * s, vy: Math.abs(u) * s + speed * 0.3, vz: Math.sin(a) * r * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.5 + Math.random()), c });
    }
  }

  confetti(n = 120, area = 11) {
    n = Math.round(n * this.amount);
    const cols = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9', '#ff9100', '#ffffff'];
    for (let i = 0; i < n && this.confs.length < MAXC; i++) {
      this.confs.push({
        x: (Math.random() - 0.5) * area * 2, y: 9 + Math.random() * 5, z: -8 + Math.random() * 14,
        vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, sr: 3 + Math.random() * 6,
        life: 4 + Math.random() * 2, c: new THREE.Color(cols[i % cols.length]),
      });
    }
  }

  update(dt) {
    // sparkles
    let k = 0;
    const P = this.parts;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 0.98; p.vz *= 0.98;
      const a = p.life / p.max;
      this.pPos[k * 3] = p.x; this.pPos[k * 3 + 1] = p.y; this.pPos[k * 3 + 2] = p.z;
      this.pCol[k * 3] = p.c.r * a; this.pCol[k * 3 + 1] = p.c.g * a; this.pCol[k * 3 + 2] = p.c.b * a;
      this.pSize[k] = p.size * (0.5 + a * 0.5);
      P[k++] = p;
    }
    P.length = k;
    const g = this.points.geometry;
    g.setDrawRange(0, k);
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
    // confetti
    let j = 0;
    const C = this.confs;
    for (let i = 0; i < C.length; i++) {
      const c = C[i];
      c.life -= dt;
      if (c.life <= 0 || c.y < -3) continue;
      c.vy = Math.max(-2.2, c.vy - 3 * dt);
      c.x += (c.vx + Math.sin(c.life * 3 + i) * 0.8) * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.sr * dt; c.ry += c.sr * 0.7 * dt;
      this._e.set(c.rx, c.ry, c.rz); this._q.setFromEuler(this._e); this._v.set(c.x, c.y, c.z);
      this._m.compose(this._v, this._q, this._s);
      this.conf.setMatrixAt(j, this._m); this.conf.setColorAt(j, c.c);
      C[j++] = c;
    }
    C.length = j;
    this.conf.count = j;
    this.conf.instanceMatrix.needsUpdate = true;
    if (this.conf.instanceColor) this.conf.instanceColor.needsUpdate = true;
  }
}
