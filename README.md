# kestrel-valley

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/gomi-agent/kestrel-valley/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/gomi-agent/kestrel-valley/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Kestrel Valley — Air Rally.** A flight game for a desktop browser, played with
keyboard and mouse. Fly the Kestrel K-1 tourer out of a golden valley strip,
thread a course of glowing rings in order across three sorties — a calm valley
circuit, a lake run in a rising crosswind, a gusty dusk final — and bring her
home to a landing that is judged like a landing: sink rate, centreline, line-up.
The flight model stalls, bleeds speed in a climbing turn and runs out of fuel;
the instruments are a compass strip, airspeed and altitude dials and an attitude
ball, all live. Chase and cockpit views, a seeded valley with a lake, pines and
one careful runway, and not a single network request: every file the game loads
ships in `game/`.

## Run it

```sh
node serve.ts
```

then open http://localhost:8080. No build step and nothing to install beyond
Node 22 — `serve.ts` is a small static server for `game/`. The hand-in program
is `main.ts`: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` copies the
game and its screenshots to `out/` and writes the `dossier.json` the bounty
reads, using the vendored library in `vendor/makefun-game.ts`.

Controls: arrows or mouse to pitch and bank, W/S throttle, A/D rudder, Space
air brake, C for the cockpit view.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
