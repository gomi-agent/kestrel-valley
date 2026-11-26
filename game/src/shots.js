// Staged screenshots, flown honestly: each scene starts the real game from a fresh
// state and flies it forward in fixed steps under a simple autopilot — steer for the
// next ring, mind the altitude, flare for the strip — until the frame the maker wants.
// Same seed, same steps, same frame: `shots.json` at the repository root lists them,
// and a desktop browser at `?shot=<name>&seed=<n>` stages one.

import { STEP } from './config.js';
import { forwardVector } from './flight.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const fwd = { x: 0, y: 0, z: -1 };

/**
 * One step of autopilot input, steering the flight toward `target` ({x, y, z}) at a
 * cruise speed. On the ground it rolls for a takeoff; with `landing` set it flies a
 * gentle final toward the threshold instead.
 */
export function autopilotInput(flight, target, cruiseSpeed = 34) {
  const input = { pitch: 0, roll: 0, rudder: 0, throttle: 0, brake: false };
  if (flight.onGround) {
    input.throttle = 1;
    input.pitch = flight.speed > 20 ? 1 : 0;
    // Steer down the centreline while rolling.
    input.rudder = clamp(-flight.x * 0.04, -0.6, 0.6);
    return input;
  }
  forwardVector(flight.yaw, flight.pitch, fwd);
  const dx = target.x - flight.x;
  const dy = target.y - flight.y;
  const dz = target.z - flight.z;
  const distXZ = Math.max(20, Math.hypot(dx, dz));
  const desiredYaw = Math.atan2(dx, -dz);
  const yawErr = wrapAngle(desiredYaw - flight.yaw);
  input.roll = clamp(yawErr * 1.7, -1, 1);
  const desiredPitch = clamp(Math.atan2(dy, distXZ), -0.34, 0.3);
  input.pitch = clamp((desiredPitch - flight.pitch) * 2.4, -1, 1);
  input.throttle = clamp((cruiseSpeed - flight.speed) * 0.12, -1, 1);
  if (cruiseSpeed < 28 && flight.y - target.y < 26) input.brake = flight.speed > cruiseSpeed + 3;
  return input;
}

/** Fly the sortie under autopilot until `until(flight, course)` says stop (or a cap). */
function flyUntil(api, until, capSeconds) {
  const steps = Math.floor(capSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = api.course && api.course.target()
      ? api.course.target()
      : { x: 0, y: api.flight.y, z: api.flight.z - 500 };
    api.input0 = autopilotInput(api.flight, target, api.cruise || 34);
    api.stepOnce(api.input0);
    if (api.flight.crashed || api.flight.landed) return;
    if (until(api.flight, api.course)) return;
  }
}

/**
 * Stage one named scene. `api` is the game's wiring from main.js: the flight, the
 * course getter, a `stepOnce(input)` that advances one fixed step under a given
 * input, a `startSortie(n)` and the camera rig.
 */
export function stageShot(name, api) {
  if (name === 'landing') {
    api.startSortie(1);
    // The course is already flown in this scene: mark it done so the panel agrees.
    if (api.course) {
      api.course.index = api.course.rings.length;
      for (const ring of api.course.rings) {
        ring.passed = true;
        ring.mesh.material = api.course.mats.done;
      }
    }
    // Put the Kestrel on a long final: south of the field, lined up, descending.
    const f = api.flight;
    f.x = 6;
    f.z = 640;
    f.y = api.groundHeight(f.x, f.z) + 92;
    f.yaw = 0.04;
    f.pitch = -0.09;
    f.speed = 27;
    f.throttle = 0.32;
    f.onGround = false;
    const threshold = { x: 0, y: api.groundHeight(0, 200) + 3, z: 210 };
    for (let i = 0; i < 40 / STEP; i += 1) {
      api.stepOnce(autopilotInput(f, threshold, 24.5));
      if (f.crashed || f.landed) break;
      if (f.z < 330) break;
    }
    api.rig.view = 'chase';
    return;
  }

  api.startSortie(1);
  if (name === 'takeoff') {
    // Just off the ground: gear leaving the strip, the valley opening ahead.
    flyUntil(api, (f) => !f.onGround && f.airTime > 1.15, 40);
    api.rig.view = 'chase';
    return;
  }
  // rings and cockpit: fly the course until the third ring is close ahead.
  flyUntil(api, (f, course) => course && course.index >= 2 && course.target()
    && Math.hypot(course.target().x - f.x, course.target().z - f.z) < 165, 150);
  api.rig.view = name === 'cockpit' ? 'cockpit' : 'chase';
}
