// The valley itself: a seeded heightfield with a river lake, one flat apron and runway,
// scattered pines and a golden-hour sky. `heightAt` is the single source of truth — the
// mesh, the trees, the ring course and the flight model's ground all read the same hills.

import * as THREE from 'three';
import { PALETTE, RUNWAY, VALLEY_SEED, WORLD } from './config.js';
import { fbm, makeNoise2, makeRng, range } from './random.js';

const hills = makeNoise2(VALLEY_SEED);
const detail = makeNoise2(VALLEY_SEED + 7);

/** The valley's centreline wanders as it runs north: the river road a pilot follows. */
export function valleyCentreX(z) {
  return 300 * Math.sin(z * 0.00055) + 120 * Math.sin(z * 0.0017 + 1.3);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Ground height in metres at any point of the world. Pure and seeded: same answer always. */
export function heightAt(x, z) {
  const fromCentre = Math.abs(x - valleyCentreX(z));
  const rise = smoothstep(140, 950, fromCentre);
  let h = 14 + fbm(detail, x * 0.004, z * 0.004, 3) * 7; // the valley floor is not a billiard table
  h += rise * rise * (120 + fbm(hills, x * 0.0011 + 9, z * 0.0011, 4) * 260); // shoulders, then peaks
  h += rise * fbm(detail, x * 0.02, z * 0.02, 2) * 9; // texture on the slopes

  // The lake: a reach of the river, north, where the floor dips under the waterline.
  const lakeBand = smoothstep(260, 60, Math.abs(z + 1550));
  const lakePull = lakeBand * smoothstep(420, 120, fromCentre);
  h = h * (1 - lakePull) + 5.5 * lakePull;

  // The home apron: one flat rectangle around the runway, blended out at its edges.
  const apronX = smoothstep(96, 60, Math.abs(x - RUNWAY.centreX));
  const apronZ = smoothstep(430, 380, Math.abs(z + 260));
  const apron = Math.min(apronX, apronZ);
  h = h * (1 - apron) + WORLD.apronHeight * apron;
  return h;
}

/** True when the point is on the paved strip itself. */
export function isOnRunway(x, z) {
  return Math.abs(x - RUNWAY.centreX) <= RUNWAY.width / 2 && z <= RUNWAY.zNear && z >= RUNWAY.zFar;
}

/** True on the flat apron around the strip: firm ground, kind to a careful landing. */
export function isOnApron(x, z) {
  return Math.abs(x - RUNWAY.centreX) <= 58 && Math.abs(z + 260) <= 385;
}

function vertexColour(x, z, h, slope, out) {
  const n = fbm(detail, x * 0.01 + 40, z * 0.01, 3);
  if (h < WORLD.waterLevel + 1.1) out.set(PALETTE.sand);
  else if (slope > 0.55) out.set(PALETTE.rock);
  else {
    out.set(PALETTE.grassLow).lerp(new THREE.Color(PALETTE.grassHigh), n);
    if (slope > 0.32) out.lerp(new THREE.Color(PALETTE.rock), (slope - 0.32) * 2.2);
  }
  if (h > 205) out.lerp(new THREE.Color(PALETTE.snow), smoothstep(205, 265, h));
  return out;
}

/** Build the terrain mesh, water, runway, trees and sky into the scene. */
export function createTerrain(scene) {
  scene.fog = new THREE.Fog(PALETTE.fog, 500, 3900);

  // Sky: a big inverted sphere painted from zenith to horizon.
  const skyGeo = new THREE.SphereGeometry(5200, 24, 12);
  const skyPos = skyGeo.getAttribute('position');
  const skyColours = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(PALETTE.sky);
  const horizon = new THREE.Color(PALETTE.skyHorizon);
  const c = new THREE.Color();
  for (let i = 0; i < skyPos.count; i += 1) {
    const y = skyPos.getY(i) / 5200;
    c.copy(horizon).lerp(top, Math.pow(Math.max(0, y), 0.62));
    skyColours[i * 3] = c.r; skyColours[i * 3 + 1] = c.g; skyColours[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColours, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(-1900, 1150, 900);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ea, 0x77684a, 0.95));

  // The heightfield itself.
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const colours = new Float32Array(pos.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const slope = Math.abs(heightAt(x + 14, z) - h) / 14 + Math.abs(heightAt(x, z + 14) - h) / 14;
    vertexColour(x, z, h, slope, colour);
    colours[i * 3] = colour.r; colours[i * 3 + 1] = colour.g; colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  scene.add(ground);

  // The lake surface, one calm sheet at the waterline.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, transparent: true, opacity: 0.8, roughness: 0.18, metalness: 0.05 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterLevel;
  scene.add(water);

  buildRunway(scene);
  buildTrees(scene);
  return { heightAt, isOnRunway, isOnApron };
}

/** The paved strip, its markings, edge lights, a hangar and a windsock. */
function buildRunway(scene) {
  const y = WORLD.apronHeight + 0.07;
  const midZ = (RUNWAY.zNear + RUNWAY.zFar) / 2;
  const tarmac = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.width, 0.14, RUNWAY.length),
    new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.94 }),
  );
  tarmac.position.set(RUNWAY.centreX, WORLD.apronHeight, midZ);
  scene.add(tarmac);

  const markMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
  const dashGeo = new THREE.BoxGeometry(0.9, 0.05, 16);
  for (let z = RUNWAY.zFar + 46; z < RUNWAY.zNear - 30; z += 44) {
    const dash = new THREE.Mesh(dashGeo, markMat);
    dash.position.set(RUNWAY.centreX, y + 0.05, z);
    scene.add(dash);
  }
  const barGeo = new THREE.BoxGeometry(2.2, 0.05, 11);
  for (const endZ of [RUNWAY.zNear - 16, RUNWAY.zFar + 16]) {
    for (let i = -3; i <= 3; i += 1) {
      if (i === 0) continue;
      const bar = new THREE.Mesh(barGeo, markMat);
      bar.position.set(RUNWAY.centreX + i * 3.6, y + 0.05, endZ);
      scene.add(bar);
    }
  }
  const lightGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let z = RUNWAY.zFar + 8; z <= RUNWAY.zNear - 8; z += 52) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(RUNWAY.centreX + side * (RUNWAY.width / 2 + 1.6), y + 0.3, z);
      scene.add(lamp);
    }
  }

  // A hangar and fuel drums east of the apron, so the field reads as a place.
  const hangar = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 18), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.8 }));
  walls.position.y = 4;
  hangar.add(walls);
  const roofMat = new THREE.MeshStandardMaterial({ color: PALETTE.planeRed, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.35, 19.4), roofMat);
    slab.position.set(side * 6.4, 10.1, 0);
    slab.rotation.z = -side * 0.52;
    hangar.add(slab);
  }
  hangar.position.set(58, WORLD.apronHeight, 120);
  scene.add(hangar);

  // Windsock: a pole and an orange cone that will point downwind.
  const sock = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }));
  pole.position.y = 3.5;
  sock.add(pole);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.4, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xe87e2e, side: THREE.DoubleSide }));
  cone.rotation.z = Math.PI / 2;
  cone.position.set(1.9, 6.6, 0);
  sock.add(cone);
  sock.position.set(-26, WORLD.apronHeight, 190);
  scene.add(sock);
}

/** Pines wherever the ground is gentle, green and dry — placed by the seeded rng. */
function buildTrees(scene) {
  const rng = makeRng(VALLEY_SEED + 31);
  const COUNT = 1050;
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 9, 7), new THREE.MeshStandardMaterial({ color: PALETTE.treeLeaf, roughness: 1 }), COUNT);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.42, 2.6, 6), new THREE.MeshStandardMaterial({ color: PALETTE.treeTrunk, roughness: 1 }), COUNT);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < COUNT && guard < COUNT * 30) {
    guard += 1;
    const x = range(rng, -1900, 1900);
    const z = range(rng, -2000, 1900);
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel + 1.6 || h > 150) continue;
    if (isOnApron(x, z)) continue;
    const slope = Math.abs(heightAt(x + 8, z) - h) + Math.abs(heightAt(x, z + 8) - h);
    if (slope > 5.5) continue;
    const s = range(rng, 0.75, 1.5);
    dummy.position.set(x, h + 1.2 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trunk.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (2.4 + 4.2) * s;
    dummy.updateMatrix();
    leaf.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  leaf.count = placed;
  trunk.count = placed;
  scene.add(leaf);
  scene.add(trunk);
}
