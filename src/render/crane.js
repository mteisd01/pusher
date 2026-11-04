// Gantry crane over the table. The claw itself is simulated in the physics engine (three
// kinematic fingers, grabbed medals become kinematic and follow it); this draws the side
// rails, the bridge, the trolley, the cable and the claw from the packed crane state.
import * as THREE from 'three';
import { L, CRANE } from '../core/layout.js';

export class CraneRig {
  constructor(scene, W) {
    this.W = W;
    this.group = new THREE.Group();
    scene.add(this.group);
    const chrome = new THREE.MeshStandardMaterial({ color: 0xeef0f4, metalness: 1, roughness: 0.12 });
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xd81b60, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b22, metalness: 0.6, roughness: 0.35 });
    this.ledMat = new THREE.MeshBasicMaterial({ color: 0xff4fa0, toneMapped: false });
    const rx = W + 1.3, y = CRANE.railY, z0 = CRANE.parkZ - 0.6, z1 = L.frontZ - 1.0;
    // side rails on posts standing on the side decks
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, z1 - z0), chrome);
      rail.position.set(sx * rx, y, (z0 + z1) / 2); this.group.add(rail);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, z1 - z0 - 0.2), this.ledMat);
      led.position.set(sx * (rx - 0.13), y - 0.08, (z0 + z1) / 2); this.group.add(led);
      for (const z of [z0 + 0.2, z1 - 0.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, y - 3.6, 12), chrome);
        post.position.set(sx * rx, (y + 3.6) / 2, z); this.group.add(post);
      }
    }
    // bridge (moves along z)
    this.bridge = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.BoxGeometry(rx * 2 + 0.4, 0.32, 0.42), paint);
    this.bridge.add(beam);
    for (const sx of [-1, 1]) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), dark); car.position.set(sx * rx, 0.1, 0); this.bridge.add(car);
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(rx * 2 - 0.6, 0.05, 0.05), this.ledMat); strip.position.set(0, -0.17, 0.22); this.bridge.add(strip);
    this.bridge.position.y = y + 0.05;
    this.group.add(this.bridge);
    // trolley (moves along x on the bridge)
    this.trolley = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.7), dark);
    this.trolley.position.y = y - 0.28;
    this.group.add(this.trolley);
    this.lamp = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), this.lamp); lamp.position.set(0, -0.05, 0.38); this.trolley.add(lamp);
    // cable
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.4 }));
    this.group.add(this.cable);
    // claw: hub + three fingers (each a pivoted group so the tilt matches the physics)
    this.claw = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(CRANE.hubR, CRANE.hubR * 0.85, 0.36, 24), paint);
    hub.position.y = 0.18; this.claw.add(hub);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(CRANE.hubR * 0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), chrome); cap.position.y = 0.36; this.claw.add(cap);
    this.fingers = [];
    const half = CRANE.finger / 2 + 0.08;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + 0.3;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(a) * CRANE.hubR * 0.8, 0, Math.sin(a) * CRANE.hubR * 0.8);
      pivot.rotation.y = -a;
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, CRANE.finger, 6, 10), chrome);
      f.position.y = -half;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.26), chrome); tip.position.set(-0.08, -half * 2 + 0.06, 0); tip.rotation.z = 0.6;
      const inner = new THREE.Group(); inner.add(f, tip);
      pivot.add(inner);
      this.claw.add(pivot);
      this.fingers.push(inner);
    }
    this.group.add(this.claw);
    this.t = 0;
  }

  // st: [x, z, y, claw, phase]
  update(dt, st, active) {
    this.t += dt;
    const [x, z, y, claw] = st;
    this.bridge.position.z = z;
    this.trolley.position.set(x, this.trolley.position.y, z);
    this.claw.position.set(x, y, z);
    const top = this.trolley.position.y - 0.2, len = Math.max(0.05, top - (y + 0.36));
    this.cable.scale.y = len; this.cable.position.set(x, y + 0.36 + len / 2, z);
    const tilt = -0.25 + (1 - claw) * 0.75;
    for (const f of this.fingers) f.rotation.z = tilt;
    this.ledMat.color.setHSL(active ? (this.t * 0.6) % 1 : 0.92, 1, active ? 0.55 : 0.32);
    this.lamp.color.setHSL(0.13, 1, active ? 0.45 + 0.3 * Math.sin(this.t * 18) : 0.3);
  }

  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}
