// Kestrel Valley — Air Rally, handed in. The game is the game/ folder of this
// repository: plain static files a desktop browser plays offline. This program is
// the envelope, not the game — it copies game/ and screenshots/ into the output
// directory and writes dossier.json there with the vendored make.fun library, so
// the judge reads exactly the files a player would fly.
//
// Run it the way the grader does (outside the grader, MAKEFUN_OUTPUT_DIR names
// the output directory):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the gate's own (see the competition's RULES.txt): the dossier text
// is capped, screenshots are at most 4 files of 256 KiB, game/ is at most 993
// files, 48 MiB in all, and no path under it runs past 1,000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
