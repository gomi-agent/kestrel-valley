// Kestrel Valley — Air Rally: the boot and the frame loop. Builds the world (terrain,
// aircraft, instruments, sound), wires the game, and steps the simulation at a fixed
// rate so the sky behaves the same on every machine. With `?shot=<name>` in the URL it
// stages that screenshot scene instead of opening the title, as shots.json describes.

import * as THREE from 'three';
import { STEP } from './config.js';
import { createTerrain } from './terrain.js';
import { buildPlane, posePlane, spinProp } from './plane.js';
import { createFlight } from './flight.js';
import { createInput } from './input.js';
import { createCameraRig } from './camera.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const hudCtx = hudCanvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(63, 16 / 9, 0.1, 9000);
const terrain = createTerrain(scene);
const plane = buildPlane();
scene.add(plane.group);
const flight = createFlight(terrain, 100);
const input = createInput(canvas);
const rig = createCameraRig(camera);
const audio = createAudio();
const game = createGame({ scene, flight, input, rig, audio });

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hudCanvas.width = w;
  hudCanvas.height = h;
}
addEventListener('resize', resize);
resize();

addEventListener('keydown', () => audio.start());
addEventListener('pointerdown', () => {
  audio.start();
  if (game.view.state === 'title') game.handleKeys(new Set(['Enter']));
});

// Screenshot staging: build the named frame, hold it, and say so on window.
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
let frozen = false;
if (shotName) {
  const shotApi = {
    flight,
    rig,
    get course() { return game.course; },
    groundHeight: (x, z) => terrain.heightAt(x, z),
    startSortie: (n) => game.startSortie(n),
    stepOnce: (inp) => {
      input.pitch = inp.pitch;
      input.roll = inp.roll;
      input.rudder = inp.rudder;
      input.throttle = inp.throttle;
      input.brake = inp.brake;
      game.step(STEP);
    },
  };
  stageShot(shotName, shotApi);
  game.view.messageT = 0; // the sortie banner has no place in a screenshot
  frozen = true;
  window.__shotReady = true;
}

let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!frozen) {
    game.handleKeys(input.takePressed());
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 40) {
      input.read();
      game.step(STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 40) accumulator = 0;
    game.frame(dt, now / 1000);
  }
  posePlane(plane.group, flight);
  plane.cockpit.visible = rig.view === 'cockpit';
  plane.airframe.visible = rig.view !== 'cockpit';
  spinProp(plane.prop, dt, flight.throttle, !flight.crashed);
  if (!frozen && game.view.state === 'title') {
    // The title's slow orbit: the parked Kestrel from her good side, valley behind.
    const t = now / 1000 * 0.07;
    camera.position.set(flight.x + Math.sin(t) * 17, flight.y + 4.2, flight.z + Math.cos(t) * 17);
    camera.up.set(0, 1, 0);
    camera.lookAt(flight.x, flight.y + 0.6, flight.z - 30);
  } else {
    rig.update(flight, frozen ? 0.016 : dt);
  }
  renderer.render(scene, camera);
  drawHud(hudCtx, hudCanvas.width, hudCanvas.height, flight, game.view);
  audio.update(flight);
}
requestAnimationFrame(frame);
