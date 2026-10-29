// Saves one rig page as a single HTML file: `pnpm preview <night> [out]`.
// The banner shows LANE_MARKER, or "no marker set" when it is unset (ADR 0003).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';

const night = process.argv[2];
const out = process.argv[3] ?? 'var/preview/index.html';
if (!night || !/^\d{4}-\d{2}-\d{2}$/.test(night)) {
  console.error('usage: pnpm preview <YYYY-MM-DD> [out.html]');
  process.exit(1);
}

const res = await createApp().request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`/digest/${night} answered ${res.status}`);
  process.exit(1);
}
await mkdir(dirname(out), { recursive: true });
await writeFile(out, await res.text());
console.log(`saved ${out}`);
