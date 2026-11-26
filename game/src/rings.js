// The ring course: a line of gates up the valley, laid out per sortie from a seed. One
// ring is always lit gold — the next one. Fly through its disc and it banks its points
// and lights the next; the rest wait in teal, and the ones behind you rest in green.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { makeRng, range } from './random.js';
import { heightAt, valleyCentreX } from './terrain.js';

export const RING_RADIUS = 13;

/**
 * Build a course of `count` rings for a sortie and add it to the scene. Ring centres
 * climb the valley from the home strip, offset from its centreline, each high enough
 * to clear the ground beneath it. Returns the course state the game steps each frame.
 */
export function createCourse(scene, sortie, count) {
  const rng = makeRng(77000 + sortie * 131);
  const group = new THREE.Group();
  const rings = [];
  const geo = new THREE.TorusGeometry(RING_RADIUS, 1.05, 10, 36);
  const mats = {
    next: new THREE.MeshStandardMaterial({ color: PALETTE.ringNext, emissive: PALETTE.ringNext, emissiveIntensity: 0.85, roughness: 0.35 }),
    open: new THREE.MeshStandardMaterial({ color: PALETTE.ringOpen, emissive: PALETTE.ringOpen, emissiveIntensity: 0.28, roughness: 0.35 }),
    done: new THREE.MeshStandardMaterial({ color: PALETTE.ringDone, emissive: PALETTE.ringDone, emissiveIntensity: 0.12, roughness: 0.5 }),
  };
  let z = -980;
  for (let i = 0; i < count; i += 1) {
    z -= range(rng, 210, 330);
    const x = valleyCentreX(z) + range(rng, -170, 170);
    const groundH = Math.max(heightAt(x, z), heightAt(x + 30, z), heightAt(x - 30, z));
    const y = groundH + range(rng, 34, 74);
    const mesh = new THREE.Mesh(geo, mats.open);
    mesh.position.set(x, y, z);
    group.add(mesh);
    rings.push({ x, y, z, mesh, passed: false, side: 0 });
  }
  scene.add(group);

  const course = {
    rings,
    index: 0, // the next ring to fly
    group,
    mats,
    /** The next ring's centre, or null when the course is done. */
    target() {
      return this.index < rings.length ? rings[this.index] : null;
    },
    /**
     * Watch the aircraft: when it crosses the next ring's plane inside the disc, the
     * ring is flown. Returns 'ring' on the crossing that scores, else null.
     */
    step(flight) {
      const ring = this.target();
      if (!ring) return null;
      ring.mesh.material = this.mats.next;
      const dz = flight.z - ring.z;
      const side = dz > 0 ? 1 : -1;
      if (ring.side !== 0 && side !== ring.side) {
        const dx = flight.x - ring.x;
        const dy = flight.y - ring.y;
        if (dx * dx + dy * dy <= RING_RADIUS * RING_RADIUS) {
          ring.passed = true;
          ring.mesh.material = this.mats.done;
          this.index += 1;
          return 'ring';
        }
      }
      ring.side = side;
      return null;
    },
    /** Pulse the next ring so it can be picked out of the valley at a glance. */
    animate(t) {
      const ring = this.target();
      if (ring) {
        const s = 1 + Math.sin(t * 3.4) * 0.045;
        ring.mesh.scale.setScalar(s);
      }
    },
    /** Take the course out of the scene (a new sortie builds its own). */
    dispose(sceneToClean) {
      sceneToClean.remove(group);
      geo.dispose();
    },
  };
  return course;
}
