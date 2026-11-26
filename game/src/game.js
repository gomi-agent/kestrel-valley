// The game itself: three sorties over one valley, a state machine (title, flying,
// tally, crashed, results), the wind, and the scoring. The flight model flies the
// aircraft and the course watches the rings; this file decides what it all means.

import { SCORE, SORTIES } from './config.js';
import { createCourse } from './rings.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The wind at a moment: a slow veer and a gust, both smooth, both seeded by the clock. */
export function windAt(time, strength) {
  if (strength <= 0) return { x: 0, z: 0 };
  const dir = 0.8 + Math.sin(time * 0.021) * 0.7;
  const mag = strength * 7.5 * (0.55 + 0.45 * Math.sin(time * 0.13 + 1) * Math.sin(time * 0.047 + 2));
  return { x: Math.cos(dir) * mag, z: Math.sin(dir) * mag };
}

export function createGame({ scene, flight, input, rig, audio }) {
  const panel = document.getElementById('panel');
  const view = {
    state: 'title', score: 0, ringsDone: 0, ringsTotal: 0,
    objective: '', message: '', messageT: 0, sortieName: '',
  };
  let sortie = 1;
  let course = null;
  let banked = 0; // points from finished sorties
  let sortieScore = 0; // live points on this sortie (rings only, until the tally)
  let streak = 0;
  let elapsed = 0;
  let takenOff = false;
  let touchdownHeard = false;
  const tally = [0, 0, 0, 0];
  let tallyLines = [];

  function showPanel(html) {
    if (html === null) {
      panel.style.display = 'none';
      panel.innerHTML = '';
    } else {
      panel.style.display = 'flex';
      panel.innerHTML = html;
    }
  }

  function toTitle() {
    view.state = 'title';
    view.sortieName = '';
    view.objective = '';
    banked = 0;
    sortieScore = 0;
    showPanel(`
      <div class="card">
        <h1>KESTREL VALLEY</h1>
        <p class="sub">— AIR RALLY —</p>
        <p>Three sorties over one golden valley in the Kestrel K-1 tourer.
        Take off from the home strip, thread the glowing rings in order — the gold one is
        always next — then come home and land like you mean it. Rings pay points;
        a gentle, centred landing pays more; bent metal pays for itself.</p>
        <table class="keys">
          <tr><td>↑ ↓ or mouse</td><td>pitch</td><td>← → or mouse</td><td>bank &amp; turn</td></tr>
          <tr><td>W / S</td><td>throttle</td><td>A / D</td><td>rudder</td></tr>
          <tr><td>SPACE</td><td>air brake</td><td>C</td><td>chase / cockpit view</td></tr>
        </table>
        <p class="go">Press ENTER or click to fly sortie 1</p>
      </div>`);
  }

  function startSortie(n) {
    sortie = n;
    const def = SORTIES[n];
    if (course) course.dispose(scene);
    flight.reset(def.fuel);
    course = createCourse(scene, n, def.rings);
    streak = 0;
    elapsed = 0;
    sortieScore = 0;
    takenOff = false;
    touchdownHeard = false;
    view.state = 'flying';
    view.sortieName = def.name;
    view.ringsDone = 0;
    view.ringsTotal = def.rings;
    view.message = def.name;
    view.messageT = 2.6;
    showPanel(null);
  }

  function endSortie() {
    const def = SORTIES[sortie];
    const landed = flight.landed;
    const lines = [];
    lines.push(['Rings', sortieScore]);
    let bonus = 0;
    if (course.index >= def.rings) {
      if (landed.kind === 'runway') {
        const gentle = clamp(1 - (-landed.sink - 1.0) / 3.5, 0, 1) * SCORE.landingGentle;
        const centre = clamp(1 - landed.centreOffset / (15 + 1), 0, 1) * SCORE.landingCentre;
        const align = landed.headingError < 0.3 ? 1 : 0.45;
        bonus = Math.round((SCORE.landingBase + gentle + centre) * align);
        lines.push(['Runway landing', bonus]);
      } else if (landed.kind === 'apron') {
        bonus = Math.round(SCORE.landingBase * 0.5);
        lines.push(['Apron arrival', bonus]);
      } else {
        bonus = 40;
        lines.push(['Field return', bonus]);
      }
      const par = Math.max(0, SCORE.parSeconds[sortie] - elapsed) * SCORE.parBonusPerSecond;
      if (par > 0) lines.push(['Under par time', Math.round(par)]);
      bonus += Math.round(par);
    } else {
      lines.push(['Came home early — no landing bonus', 0]);
    }
    const repairs = Math.round(flight.damage) * 2;
    if (repairs > 0) lines.push(['Repairs', -repairs]);
    const total = sortieScore + bonus - repairs;
    tally[sortie] = total;
    banked += total;
    sortieScore = 0;
    tallyLines = lines;
    if (sortie >= 3) {
      view.state = 'results';
      showPanel(`
        <div class="card">
          <h2>RALLY COMPLETE</h2>
          ${tallyLines.map(([k, v]) => `<p class="line"><span>${k}</span><b>${v}</b></p>`).join('')}
          <p class="line"><span>Sortie 1</span><b>${tally[1]}</b></p>
          <p class="line"><span>Sortie 2</span><b>${tally[2]}</b></p>
          <p class="line total"><span>Total</span><b>${banked}</b></p>
          <p class="go">Press ENTER to return to the title</p>
        </div>`);
    } else {
      view.state = 'tally';
      showPanel(`
        <div class="card">
          <h2>${def.name} — FLOWN</h2>
          ${tallyLines.map(([k, v]) => `<p class="line"><span>${k}</span><b>${v}</b></p>`).join('')}
          <p class="line total"><span>Sortie total</span><b>${total}</b></p>
          <p>${SORTIES[sortie + 1].brief}</p>
          <p class="go">Press ENTER for ${SORTIES[sortie + 1].name}</p>
        </div>`);
    }
  }

  function crashNow() {
    view.state = 'crashed';
    audio.thud();
    showPanel(`
      <div class="card">
        <h2>ARRIVAL, OF A KIND</h2>
        <p>${flight.crashed}</p>
        <p>The valley keeps the wreck and the scorekeeper keeps the rings
        you banked on earlier sorties. This one starts over.</p>
        <p class="go">Press ENTER to fly ${SORTIES[sortie].name} again</p>
      </div>`);
  }

  const game = {
    view,
    get course() { return course; },
    get sortie() { return sortie; },

    /** Keys that change the game's state (called once a frame, not per step). */
    handleKeys(pressed) {
      if (pressed.has('KeyC') && view.state === 'flying') rig.toggle();
      if (pressed.has('KeyM')) input.mouseSteer = !input.mouseSteer;
      const go = pressed.has('Enter') || pressed.has('NumpadEnter');
      if (!go) return;
      if (view.state === 'title') startSortie(1);
      else if (view.state === 'tally') startSortie(sortie + 1);
      else if (view.state === 'crashed') startSortie(sortie);
      else if (view.state === 'results') toTitle();
    },

    /** One fixed simulation step. */
    step(dt) {
      if (view.state !== 'flying') return;
      elapsed += dt;
      const wind = windAt(elapsed, SORTIES[sortie].wind);
      flight.step(dt, input, wind);
      if (!flight.onGround) takenOff = true;
      if (flight.landed && !flight.onGround) flight.landed = null; // a touch-and-go is not a landing
      if (flight.crashed) {
        crashNow();
        return;
      }
      if (course && course.step(flight) === 'ring') {        const pts = SCORE.ring + streak * SCORE.ringStreakBonus;
        streak += 1;
        sortieScore += pts;
        view.ringsDone = course.index;
        view.message = `RING ${course.index} · +${pts}`;
        view.messageT = 1.5;
        audio.chime();
      }
      if (course) view.ringsDone = course.index;
      if (flight.landed && !touchdownHeard) {
        touchdownHeard = true;
        audio.touchdown();
        view.message = flight.landed.kind === 'runway' ? 'TOUCHDOWN' : 'DOWN — ROLL IT OUT';
        view.messageT = 1.6;
      }
      if (flight.landed && flight.speed < 1.2) {
        endSortie();
        return;
      }
      // The objective line, in the pilot's ear.
      if (!takenOff) view.objective = 'Full throttle (W) — pull gently (↓) at 40 kt';
      else if (course && course.target()) {
        const t = course.target();
        const d = Math.round(Math.hypot(t.x - flight.x, t.z - flight.z));
        view.objective = `Ring ${course.index + 1} of ${SORTIES[sortie].rings} — ${d} m`;
      } else view.objective = 'Course complete — return and land on the strip';
      view.score = banked + sortieScore;
    },

    /** Per-frame dressing: message timers and the course's pulse. */
    frame(dt, t) {
      if (view.messageT > 0) view.messageT = Math.max(0, view.messageT - dt);
      if (course) course.animate(t);
    },

    startTitle: toTitle,
    startSortie,
  };
  toTitle();
  return game;
}
