// The flight model: an honest arcade simulation. Throttle and turn discipline matter —
// the wing stalls, a banked turn bleeds speed in a climb, a landing is judged by its sink
// rate and its line. Fixed-step and free of randomness, so a flight replays exactly.

import { PLANE, RUNWAY, WORLD } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The forward unit vector for a yaw (0 = north, -Z) and pitch (positive = nose up). */
export function forwardVector(yaw, pitch, out) {
  const cp = Math.cos(pitch);
  out.x = Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * cp;
  return out;
}

/**
 * Create the flight state on the home strip, ready for a sortie with the given fuel.
 * `ground` is the terrain module: heightAt / isOnRunway / isOnApron.
 */
export function createFlight(ground, fuel) {
  const s = {
    x: RUNWAY.centreX, y: 0, z: 190,
    yaw: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0, fuel, damage: 0,
    onGround: true, stalled: false, crashed: null, landed: null,
    airTime: 0, flightTime: 0, maxSink: 0,
    vy: 0, // last step's vertical speed, for judging a touchdown
  };
  s.y = ground.heightAt(s.x, s.z) + PLANE.groundClearance;
  s.reset = (nextFuel) => {
    s.x = RUNWAY.centreX; s.z = 190;
    s.y = ground.heightAt(s.x, s.z) + PLANE.groundClearance;
    s.yaw = 0; s.pitch = 0; s.roll = 0;
    s.speed = 0; s.throttle = 0; s.fuel = nextFuel; s.damage = 0;
    s.onGround = true; s.stalled = false; s.crashed = null; s.landed = null;
    s.airTime = 0; s.flightTime = 0; s.vy = 0;
  };
  s.step = (dt, input, wind) => stepFlight(s, ground, dt, input, wind);
  return s;
}

const fwd = { x: 0, y: 0, z: -1 };

function stepFlight(s, ground, dt, input, wind) {
  if (s.crashed) return; // a landed aircraft still rolls out under its pilot's hands
  s.flightTime += dt;

  // Engine and fuel.
  if (s.fuel > 0) {
    s.throttle = clamp(s.throttle + input.throttle * dt * 0.5, 0, 1);
    s.fuel = Math.max(0, s.fuel - PLANE.fuelBurn * (0.35 + 0.65 * s.throttle) * dt);
  } else {
    s.throttle = 0;
  }
  const power = s.fuel > 0 ? s.throttle : 0;

  // Speed: thrust chases its target, gravity trades speed for height, brakes bite.
  const target = PLANE.idleSpeed + power * (PLANE.maxSpeed - PLANE.idleSpeed);
  let accel = (target - s.speed) * (s.onGround ? PLANE.groundRoll : PLANE.airAccel);
  if (!s.onGround) accel += -9.4 * Math.sin(s.pitch);
  if (input.brake) accel -= s.onGround ? 16 : 9;
  s.speed = clamp(s.speed + accel * dt, 0, 78);

  // Controls: authority grows with airspeed; the stall takes it away.
  const authority = clamp((s.speed - 5) / 15, 0.12, 1);
  s.stalled = !s.onGround && s.speed < PLANE.stallSpeed;
  if (s.onGround) {
    // Ground steering from the rudder, and a little from the ailerons at speed.
    s.yaw += (input.rudder * 0.55 + input.roll * 0.12) * clamp(s.speed / 9, 0, 1) * dt;
    s.roll += (0 - s.roll) * Math.min(1, dt * 6);
    const wantsOff = input.pitch > 0.25 && s.speed >= PLANE.rotateSpeed;
    s.pitch += ((wantsOff ? 0.16 : 0) - s.pitch) * Math.min(1, dt * 3.2);
    if (wantsOff && s.pitch > 0.1) s.onGround = false;
  } else {
    const pitchAuthority = s.stalled ? authority * 0.35 : authority;
    s.pitch = clamp(s.pitch + input.pitch * PLANE.pitchRate * pitchAuthority * dt, PLANE.minPitch, PLANE.maxPitch);
    if (s.stalled) s.pitch += (-0.38 - s.pitch) * Math.min(1, dt * 1.6); // the nose drops away
    const bankTarget = input.roll * PLANE.maxBank;
    const rollStep = clamp(bankTarget - s.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
    s.roll += rollStep * (0.35 + 0.65 * authority);
    if (Math.abs(input.roll) < 0.05) s.roll += (0 - s.roll) * Math.min(1, dt * 0.55); // gentle self-levelling
    const turn = (9.8 * Math.tan(clamp(s.roll, -1.15, 1.15))) / Math.max(s.speed, 11);
    s.yaw += turn * dt * 0.92 + input.rudder * 0.22 * authority * dt;
    s.airTime += dt;
  }

  // Move: through the air along the nose, plus the wind's push once airborne.
  forwardVector(s.yaw, s.pitch, fwd);
  const prevY = s.y;
  s.x += fwd.x * s.speed * dt + (s.onGround ? 0 : wind.x * dt);
  s.y += fwd.y * s.speed * dt;
  s.z += fwd.z * s.speed * dt + (s.onGround ? 0 : wind.z * dt);
  s.x = clamp(s.x, -2050, 2050);
  s.z = clamp(s.z, -2050, 2050);
  s.y = Math.min(s.y, 850);
  s.vy = dt > 0 ? (s.y - prevY) / dt : 0;

  // The ground, and what meeting it means.
  const terrainH = ground.heightAt(s.x, s.z);
  const surfaceH = Math.max(terrainH, terrainH < WORLD.waterLevel ? WORLD.waterLevel : terrainH);
  const floor = surfaceH + PLANE.groundClearance;
  if (s.y <= floor) {
    if (s.onGround) {
      s.y = floor;
      s.vy = 0;
      if (s.speed < 0.4 && power === 0) s.speed = 0;
      return;
    }
    touchDown(s, ground, terrainH);
  }
}

/** Judge a first contact with the ground: a landing, a rough arrival, or a crash. */
function touchDown(s, ground, terrainH) {
  const sink = s.vy; // negative going down
  const onStrip = ground.isOnRunway(s.x, s.z);
  const onApron = ground.isOnApron(s.x, s.z);
  const inWater = terrainH < WORLD.waterLevel - 0.4;
  const banked = Math.abs(s.roll) > 0.42;
  const slope = Math.abs(ground.heightAt(s.x + 6, s.z) - terrainH) + Math.abs(ground.heightAt(s.x, s.z + 6) - terrainH);

  if (inWater) return crash(s, 'Ditched in the lake. The Kestrel floats — briefly.');
  if (banked) return crash(s, 'A wingtip caught the ground.');
  if (sink < -8.5) return crash(s, 'Came down far too hard — the gear folded.');
  if (!onStrip && !onApron && slope > 7) return crash(s, 'The hillside was steeper than it looked.');

  s.y = Math.max(terrainH, WORLD.waterLevel) + PLANE.groundClearance;
  if (onStrip || onApron) {
    if (sink < -4.5) s.damage = Math.min(100, s.damage + (-sink - 4.5) * 14);
    s.landed = {
      kind: onStrip ? 'runway' : 'apron',
      sink,
      centreOffset: Math.abs(s.x - RUNWAY.centreX),
      speed: s.speed,
      headingError: Math.min(Math.abs(s.yaw), Math.abs(Math.abs(s.yaw) - Math.PI * 2), Math.abs(Math.abs(s.yaw) - Math.PI)),
    };
    s.onGround = true;
    s.pitch = 0;
    s.roll = 0;
    return;
  }
  // A farmer's field: kind to the slow and gentle, unkind to everyone else.
  if (sink < -3.2 || s.speed > 34) return crash(s, 'The field arrival was more crash than landing.');
  s.damage = Math.min(100, s.damage + 22);
  s.landed = { kind: 'field', sink, centreOffset: 999, speed: s.speed, headingError: 0 };
  s.onGround = true;
  s.pitch = 0;
  s.roll = 0;
}

function crash(s, reason) {
  s.crashed = reason;
  s.speed = 0;
}
