// ai-excited-01 — "The Whale That Jumped Through the Sun".
//
// This program's only job is to place the entry image where the judge
// expects it. It reads the image that ships next to this file and writes
// an exact copy to the output directory, so the result is identical on
// every run — no generation, no randomness, no network.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
copyFileSync(join(here, 'entry.png'), join(outDir, 'entry.png'));
