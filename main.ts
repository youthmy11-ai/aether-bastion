// Aether Bastion packaging entry point (Node 22, standard library only).
// Copies game/ and screenshots/ to MAKEFUN_OUTPUT_DIR (or /output) and builds dossier.json
// using the vendored makefun-game.ts scorer contract.
//
// Serve locally with `node serve.ts` and open http://localhost:8080.
// Package locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, readGameTree } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const tree = readGameTree(gameSrc, CAPS);

mkdirSync(out, { recursive: true });
cpSync(gameSrc, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(out, 'screenshots'), { recursive: true });
}

const dossierBytes = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossierBytes);

console.log(
  `Aether Bastion packaged -> ${out} (${tree.files.length} game files, ${tree.totalBytes} bytes, dossier ${dossierBytes.length} bytes)`,
);
