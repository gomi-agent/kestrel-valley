// All of the game's sound is synthesised — an engine that follows the throttle, wind
// that follows the airspeed, a chime for a ring flown clean. No audio files, nothing
// borrowed: a handful of oscillators and one buffer of noise, started on first touch
// because browsers insist a person ask for sound before it plays.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
  }

  function blip(freq, at, dur, gain = 0.16) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur);
  }

  return {
    start,
    /** Follow the flight: engine note from throttle and revs, wind from airspeed. */
    update(flight) {
      if (!ctx || !engineOsc) return;
      const t = ctx.currentTime;
      const rpm = 42 + flight.throttle * 68 + flight.speed * 0.35;
      engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      engineFilter.frequency.setTargetAtTime(240 + flight.throttle * 620, t, 0.1);
      const engineLevel = flight.crashed ? 0 : 0.028 + flight.throttle * 0.075;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.09);
      windGain.gain.setTargetAtTime(Math.min(0.14, (flight.speed / 58) * 0.13), t, 0.15);
    },
    /** Two bright notes: a ring, flown. */
    chime() {
      blip(987, 0, 0.22);
      blip(1318, 0.09, 0.3);
    },
    /** A soft double-note for rubber meeting runway. */
    touchdown() {
      blip(196, 0, 0.18, 0.2);
      blip(147, 0.05, 0.22, 0.14);
    },
    /** A low crunch for the arrivals nobody walks away from smiling. */
    thud() {
      blip(70, 0, 0.5, 0.3);
      blip(52, 0.04, 0.6, 0.26);
    },
  };
}
