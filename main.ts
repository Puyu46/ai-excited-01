// ai-excited-01 entry: "The Whale That Jumped Through the Sun".
// The image beside this file (entry.png, JPEG bytes) is copied byte-for-byte
// to the output directory, so every run of this program writes identical bytes.
// Local runs: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
copyFileSync(new URL('./entry.png', import.meta.url), join(outDir, 'entry.png'));
