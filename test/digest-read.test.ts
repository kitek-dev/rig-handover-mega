import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-runs-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function night(name: string, lines: string[]): string {
  writeFileSync(join(tmp, `${name}.jsonl`), lines.join('\n'));
  return name;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  it('has 5 jobs and 1 bad line', async () => {
    const digest = await readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.badLines).toBe(1);
    expect(digest!.rows.map((r) => r.job).sort()).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds each job into one row, times kept as logged', async () => {
    const rows = (await readNight('runs', '2026-10-28'))!.rows;
    const byJob = new Map(rows.map((r) => [r.job, r]));
    expect(byJob.get('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob.get('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(byJob.get('notes/backup')).toMatchObject({
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
    expect(byJob.get('digest/render')).toMatchObject({ owner: null, lastError: null });
  });
});

describe('readNight edge cases', () => {
  it('missing file resolves to null', async () => {
    expect(await readNight(tmp, '2026-01-01')).toBeNull();
  });

  it('missing runs dir resolves to null', async () => {
    expect(await readNight(join(tmp, 'nope'), '2026-01-01')).toBeNull();
  });

  it('a night that is not a date resolves to null', async () => {
    expect(await readNight(tmp, '../etc/passwd')).toBeNull();
  });

  it('empty file has no rows and no bad lines', async () => {
    expect(await readNight(tmp, night('2026-01-02', []))).toEqual({ rows: [], badLines: 0 });
  });

  it('keeps a row whose owner is null', async () => {
    const n = night('2026-01-03', [
      '{"at":"2026-01-03T01:00:00-05:00","job":"a","status":"ok","owner":null}',
    ]);
    expect(await readNight(tmp, n)).toEqual({
      rows: [
        {
          job: 'a',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-01-03T01:00:00-05:00',
          lastAt: '2026-01-03T01:00:00-05:00',
        },
      ],
      badLines: 0,
    });
  });

  it('counts unparsable and wrong-shape lines, never throws', async () => {
    const n = night('2026-01-04', [
      '{"at":"2026-01-04T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      'not json',
      '[]',
      'null',
      '{"at":"2026-01-04T01:01:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"at":"2026-01-04T01:02:00+01:00","status":"ok","owner":"x"}',
      '{"at":"2026-01-04T01:03:00+01:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-01-04T01:04:00+01:00","job":"a","status":"fail","owner":"x","error":42}',
      '',
      '{"at":"2026-01-04T01:05:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '',
    ]);
    const digest = await readNight(tmp, n);
    expect(digest!.badLines).toBe(7);
    expect(digest!.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 2,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-01-04T01:00:00+01:00',
        lastAt: '2026-01-04T01:05:00+01:00',
      },
    ]);
  });
});
