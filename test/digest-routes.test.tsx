import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestRow } from '../src/digest/types.js';

type DigestJson = { night: string; badLines: number; rows: DigestRow[] };

let dir: string;
const cfg = (runsDir: string): RigConfig => ({ adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir });

const good = [
  '{"at":"2026-10-01T23:00:00+01:00","job":"a/one","status":"ok","owner":"rook"}',
  '{"at":"2026-10-01T23:05:00+01:00","job":"b/two","status":"fail","owner":"rook","error":"boom"}',
];

beforeAll(async () => {
  process.env.LANE_MARKER = 'test-marker';
  dir = await mkdtemp(join(tmpdir(), 'rig-digest-'));
  await writeFile(join(dir, '2026-10-01.jsonl'), good.join('\n') + '\n');
  await writeFile(join(dir, '2026-10-02.jsonl'), '');
  await writeFile(join(dir, '2026-10-03.jsonl'), [good[0], 'not json {', good[1]].join('\n') + '\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function both(night: string) {
  const app = createApp(cfg(dir));
  const page = await app.request(`/digest/${night}`);
  const json = await app.request(`/api/digest/${night}`);
  return { page, json };
}

describe('digest routes', () => {
  it('200 for a night with data', async () => {
    const { page, json } = await both('2026-10-01');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('a/one');
    expect(html).toContain('b/two');
    expect(json.status).toBe(200);
    const body = (await json.json()) as DigestJson;
    expect(body.rows.map((r) => r.job).sort()).toEqual(['a/one', 'b/two']);
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file', async () => {
    const { page, json } = await both('2026-10-09');
    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('empty night', async () => {
    const { page, json } = await both('2026-10-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    const body = (await json.json()) as DigestJson;
    expect(body.rows).toEqual([]);
  });

  it('night with a bad line', async () => {
    const { page, json } = await both('2026-10-03');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('unreadable');
    expect(html).toContain('a/one');
    const body = (await json.json()) as DigestJson;
    expect(body.badLines).toBeGreaterThanOrEqual(1);
    expect(body.rows.length).toBe(2);
  });

  it('page and JSON list the same jobs in the same order (real night)', async () => {
    const app = createApp(cfg('runs'));
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const body = (await json.json()) as DigestJson;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.length).toBeGreaterThan(0);
    const html = await page.text();
    const inPage = [...html.matchAll(/<td>([^<]*)<\/td><td>/g)]
      .map((m) => m[1] ?? '')
      .filter((t) => jobs.includes(t));
    expect(inPage).toEqual(jobs);
  });
});
