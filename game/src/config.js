// Kestrel Valley — Air Rally: every tuning number, colour and world constant in one place.
// The world is measured in metres, speeds in metres per second, and the simulation advances
// in fixed steps so a flight (and a staged screenshot) is the same every run.

/** The simulation's fixed step, in seconds: 120 updates a second, whatever the display rate. */
export const STEP = 1 / 120;

/** Where the world ends: the terrain square is WORLD.size across, centred on the origin. */
export const WORLD = {
  size: 4200,
  segments: 150,
  waterLevel: 9.2,
  apronHeight: 12,
};

/** The home strip: runway 09/27 on the flat apron at the valley's south end, along the Z axis. */
export const RUNWAY = {
  centreX: 0,
  zNear: 240, // threshold of runway 27 (south end, where a landing rollout ends)
  zFar: -760, // threshold of runway 09 (north end, the takeoff direction)
  width: 30,
  length: 1000,
};

/** The Kestrel K-1 tourer: the flight model's limits, all in metres, seconds and radians. */
export const PLANE = {
  maxSpeed: 58, // full-throttle level speed, m/s (about 113 kt)
  idleSpeed: 7, // speed the engine holds at idle throttle on the ground
  stallSpeed: 19, // below this the wing gives up and the nose drops
  rotateSpeed: 21, // a gentle pull here lifts a loaded Kestrel off the strip
  groundRoll: 0.55, // how eagerly the speed chases its target, per second
  airAccel: 0.38,
  pitchRate: 0.85, // rad/s of pitch the elevator can command at full authority
  rollRate: 1.9, // rad/s the ailerons can roll toward the commanded bank
  maxBank: 1.02, // rad, about 58 degrees: a steep turn, not a roll
  maxPitch: 0.52,
  minPitch: -0.62,
  turnFactor: 1.55, // how hard a banked wing pulls the nose around
  fuelBurn: 0.30, // fuel units a second at full throttle (idle burns a third of this)
  groundClearance: 1.55, // the fuselage centre rides this far above the gear
};

/** Scoring: what a clean sortie is worth. */
export const SCORE = {
  ring: 100,
  ringStreakBonus: 25, // extra per ring while no ring is missed in a row
  landingBase: 200,
  landingGentle: 200, // scaled by how soft the touchdown was
  landingCentre: 100, // scaled by how close to the centreline
  parSeconds: [0, 150, 210, 280], // par time per sortie (index 0 unused)
  parBonusPerSecond: 4,
};

/** The three sorties: name, brief, ring count, wind strength and starting fuel. */
export const SORTIES = [
  null,
  { name: 'Sortie 1 — Valley Circuit', brief: 'Six rings up the valley, then home to runway 09.', rings: 6, wind: 0.0, fuel: 100 },
  { name: 'Sortie 2 — Lake Run', brief: 'Eight rings over the lake shore. A crosswind is picking up.', rings: 8, wind: 0.45, fuel: 92 },
  { name: 'Sortie 3 — Dusk Final', brief: 'Ten rings in gusty air, and a precision landing to finish.', rings: 10, wind: 0.8, fuel: 88 },
];

/** Colours of one golden-hour style: warm sun, teal shadows, cream-and-red aircraft. */
export const PALETTE = {
  sky: 0x87b5d9,
  skyHorizon: 0xf6c98f,
  fog: 0xd9b98c,
  sun: 0xffe3b3,
  grassLow: 0x5d8f4e,
  grassHigh: 0x86a860,
  rock: 0x8d8578,
  snow: 0xf4f1ea,
  sand: 0xcbb98a,
  water: 0x2e6f8e,
  treeTrunk: 0x6b4a2f,
  treeLeaf: 0x3e6b34,
  runway: 0x3c4147,
  runwayMark: 0xf2f0e6,
  planeCream: 0xf3ead8,
  planeRed: 0xc33d2e,
  planeDark: 0x2c313a,
  ringNext: 0xffc94d,
  ringOpen: 0x39d0c4,
  ringDone: 0x7dd069,
};

/** Fixed seed for the valley itself: the terrain is the same valley on every visit. */
export const VALLEY_SEED = 20261126;
