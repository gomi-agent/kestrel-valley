// The Kestrel K-1, built from primitives: a cream-and-red high-wing tourer with a spinning
// prop, lit wingtips and a panel of glowing gauges for the cockpit view. The group faces
// -Z (three.js forward); the flight model poses it each step.

import * as THREE from 'three';
import { PALETTE } from './config.js';

function box(w, h, d, color, x, y, z, rough = 0.55) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough }));
  m.position.set(x, y, z);
  return m;
}

/** Build the aircraft. Returns the group and the parts the game animates. */
export function buildPlane() {
  const plane = new THREE.Group();
  const cream = PALETTE.planeCream;
  const red = PALETTE.planeRed;
  const dark = PALETTE.planeDark;

  // Fuselage: a tapered tube, nose at -Z, plus a rounded spinner and exhaust stubs.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.78, 5.9, 14), new THREE.MeshStandardMaterial({ color: cream, roughness: 0.42 }));
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.2;
  plane.add(body);
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.9, 14), new THREE.MeshStandardMaterial({ color: red, roughness: 0.4 }));
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -2.6;
  plane.add(cowl);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.46, 1.7, 12), new THREE.MeshStandardMaterial({ color: cream, roughness: 0.45 }));
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.9;
  plane.add(tailCone);

  // Canopy: a dark glasshouse over the cabin.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1d2b38, roughness: 0.12, metalness: 0.35 }));
  canopy.scale.set(0.88, 0.6, 1.7);
  canopy.position.set(0, 0.48, -0.55);
  plane.add(canopy);

  // High wing with red tips, tail feathers behind.
  plane.add(box(8.8, 0.16, 1.45, cream, 0, 0.98, -0.35));
  plane.add(box(1.1, 0.17, 1.45, red, -4.85, 0.98, -0.35));
  plane.add(box(1.1, 0.17, 1.45, red, 4.85, 0.98, -0.35));
  plane.add(box(3.1, 0.13, 1.0, cream, 0, 0.42, 3.35)); // tailplane
  const fin = box(0.13, 1.25, 1.05, red, 0, 0.95, 3.4);
  plane.add(fin);

  // Fixed gear: two mains and a tail wheel, on spring struts.
  const strutMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 6), strutMat);
    strut.position.set(side * 0.72, -0.85, -0.7);
    strut.rotation.z = side * 0.35;
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.95, -1.19, -0.7);
    plane.add(wheel);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff4444 : 0x44ff77 }));
    light.position.set(side * 5.42, 0.98, -0.35);
    plane.add(light);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 10), wheelMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.62, 3.6);
  plane.add(tailWheel);

  // The propeller: two blades and a spinner, spun by the game loop.
  const prop = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.35 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.07), bladeMat);
  prop.add(blade);
  const blade2 = blade.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 12), new THREE.MeshStandardMaterial({ color: red, roughness: 0.3 }));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.3;
  prop.add(spinner);
  prop.position.z = -3.12;
  plane.add(prop);

  // Everything built so far is the airframe: the cockpit view hides it (the camera
  // sits where the metal is) and shows only the cockpit dressing below.
  const airframe = new THREE.Group();
  while (plane.children.length) airframe.add(plane.children[0]);
  plane.add(airframe);

  // Cockpit dressing for the inside view: a panel group the pilot faces — dark
  // panel, a glareshield, six lit gauges, a yoke — and the red nose ahead of it.
  const cockpit = new THREE.Group();
  const panelGroup = new THREE.Group();
  panelGroup.position.set(0, 0.24, -1.95);
  panelGroup.rotation.x = -0.16;
  const panel = box(2.05, 0.88, 0.1, 0x14171c, 0, 0, 0, 0.85);
  panelGroup.add(panel);
  const shield = box(2.05, 0.09, 0.55, 0x0c0e12, 0, 0.47, -0.12, 0.9);
  panelGroup.add(shield);
  const gaugeMat = new THREE.MeshBasicMaterial({ color: 0xffca7a });
  const dimMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff });
  const gaugeFace = new THREE.MeshBasicMaterial({ color: 0x232830 });
  for (let i = 0; i < 6; i += 1) {
    const gx = -0.62 + (i % 3) * 0.62;
    const gy = 0.2 - Math.floor(i / 3) * 0.42;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.155, 16), gaugeFace);
    face.position.set(gx, gy, 0.056);
    panelGroup.add(face);
    const needle = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), i % 2 ? dimMat : gaugeMat);
    needle.position.set(gx, gy, 0.062);
    panelGroup.add(needle);
  }
  cockpit.add(panelGroup);
  const yoke = box(0.52, 0.07, 0.07, 0x22262e, 0, -0.42, -1.45, 0.7);
  cockpit.add(yoke);
  const cowlTop = box(1.15, 0.09, 1.6, red, 0, 0.4, -3.0, 0.4);
  cockpit.add(cowlTop);
  plane.add(cockpit);

  return { group: plane, airframe, prop, cockpit };
}

/** Pose the aircraft group from the flight model's angles (yaw 0 faces -Z, north). */
export function posePlane(group, flight) {
  group.position.set(flight.x, flight.y, flight.z);
  group.rotation.order = 'YXZ';
  group.rotation.set(flight.pitch, -flight.yaw, -flight.roll);
}

/** Spin the propeller at a rate set by the engine's throttle and speed. */
export function spinProp(prop, dt, throttle, running) {
  if (running) prop.rotation.z -= dt * (4 + throttle * 55);
}
