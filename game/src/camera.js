// Two cameras, both flown from the flight model: a chase camera that sits off the tail
// and leans into turns without ever fighting the pilot, and a cockpit camera at the
// pilot's head, where the panel and the nose fill the lower frame.

import * as THREE from 'three';
import { forwardVector } from './flight.js';

export const VIEW_CHASE = 'chase';
export const VIEW_COCKPIT = 'cockpit';

const fwd = { x: 0, y: 0, z: -1 };
const desired = new THREE.Vector3();
const looking = new THREE.Vector3();

/**
 * The aircraft's up vector: the level up for its heading, rolled around the nose by
 * `bank`. With bank 0 it is the world's up; the chase camera asks for a softened bank
 * so the horizon leans into a turn instead of snapping with the wings.
 */
function aircraftUp(yaw, bank, out) {
  const rx = Math.cos(yaw);
  const rz = Math.sin(yaw);
  // The un-banked up is right x forward, with right = (cos yaw, 0, sin yaw):
  const ux = -rz * fwd.y;
  const uy = rz * fwd.x - rx * fwd.z;
  const uz = rx * fwd.y;
  const c = Math.cos(bank);
  const s = Math.sin(bank);
  // Rolling by `bank` around the nose swings the up vector toward the rising wing:
  // up' = up*cos(bank) + right*sin(bank), matching the airframe's own rotation.
  out.set(ux * c + rx * s, uy * c, uz * c + rz * s);
  return out.normalize();
}

const up = new THREE.Vector3();

/** Create the camera rig: call `update` once a frame with the flight state. */
export function createCameraRig(camera) {
  const rig = {
    view: VIEW_CHASE,
    smoothed: null,
    toggle() {
      this.view = this.view === VIEW_CHASE ? VIEW_COCKPIT : VIEW_CHASE;
      this.smoothed = null; // never swing across the world on a view change
    },
    update(flight, dt) {
      forwardVector(flight.yaw, flight.pitch, fwd);
      if (this.view === VIEW_COCKPIT) {
        aircraftUp(flight.yaw, flight.roll, up);
        camera.position.set(flight.x + fwd.x * 0.4 + up.x * 1.3, flight.y + fwd.y * 0.4 + up.y * 1.3, flight.z + fwd.z * 0.4 + up.z * 1.3);
        looking.set(flight.x + fwd.x * 80, flight.y + fwd.y * 80, flight.z + fwd.z * 80);
        camera.up.copy(up);
        camera.lookAt(looking);
        return;
      }
      aircraftUp(flight.yaw, flight.roll * 0.5, up);
      const back = 13.2;
      const lift = 3.9;
      desired.set(
        flight.x - fwd.x * back + up.x * lift,
        flight.y - fwd.y * back + up.y * lift,
        flight.z - fwd.z * back + up.z * lift,
      );
      if (!this.smoothed) this.smoothed = desired.clone();
      this.smoothed.lerp(desired, Math.min(1, dt * 6.5));
      camera.position.copy(this.smoothed);
      looking.set(flight.x + fwd.x * 26 + up.x * 1.2, flight.y + fwd.y * 26 + up.y * 1.2, flight.z + fwd.z * 26 + up.z * 1.2);
      camera.up.set(0, 1, 0);
      camera.lookAt(looking);
    },
  };
  return rig;
}
