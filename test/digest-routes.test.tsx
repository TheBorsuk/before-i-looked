import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Line = { at: string; job: string; status: string; owner: string | null; error?: string };

const lines = (rows: Line[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

const GOOD_NIGHT = '2026-10-20';
const EMPTY_NIGHT = '2026-10-21';
const BAD_NIGHT = '2026-10-22';
const MISSING_NIGHT = '2026-10-23';

// Written out of job order on purpose: the reader sorts by job.
const goodRuns: Line[] = [
  { at: '2026-10-20T23:00:03+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' },
  { at: '2026-10-20T23:00:05+01:00', job: 'rig/rotate-logs', status: 'ok', owner: 'lane-07' },
  { at: '2026-10-21T01:00:04+01:00', job: 'lane/sync', status: 'fail', owner: 'rook', error: 'timeout' },
  { at: '2026-10-21T02:00:00+01:00', job: 'billing/export', status: 'ok', owner: null },
];
const goodJobs = ['billing/export', 'lane/sync', 'rig/rotate-logs'];

const badRuns = [
  JSON.stringify({ at: '2026-10-22T23:00:00+01:00', job: 'zeta/job', status: 'ok', owner: 'rook' }),
  'this is not json',
  JSON.stringify({ at: '2026-10-22T23:30:00+01:00', job: 'alpha/job', status: 'ok', owner: 'lane-07' }),
].join('\n') + '\n';
const badJobs = ['alpha/job', 'zeta/job'];

let runsDir: string;
let app: Hono;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, `${GOOD_NIGHT}.jsonl`), lines(goodRuns));
  writeFileSync(join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
  writeFileSync(join(runsDir, `${BAD_NIGHT}.jsonl`), badRuns);
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

type Digest = { night: string; rows: { job: string }[]; badLines: number };

function expectInOrder(html: string, jobs: string[]) {
  const at = jobs.map((job) => html.indexOf(job));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
}

describe('GET /digest/:night', () => {
  it('answers 200 with the jobs in job order', async () => {
    const res = await app.request(`/digest/${GOOD_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest ${GOOD_NIGHT}`);
    expectInOrder(html, goodJobs);
  });

  it('keeps the log offset and renders missing owner as a dash', async () => {
    const html = await (await app.request(`/digest/${GOOD_NIGHT}`)).text();
    expect(html).toContain('2026-10-20T23:00:03+01:00');
    expect(html).toContain('—');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('digest');
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('shows the good rows and counts the bad line', async () => {
    const res = await app.request(`/digest/${BAD_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expectInOrder(html, badJobs);
  });

  it('does not mention unreadable lines on a clean night', async () => {
    const html = await (await app.request(`/digest/${GOOD_NIGHT}`)).text();
    expect(html).not.toContain('could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with rows in job order', async () => {
    const res = await app.request(`/api/digest/${GOOD_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Digest;
    expect(body.night).toBe(GOOD_NIGHT);
    expect(body.rows.map((r) => r.job)).toEqual(goodJobs);
    expect(body.badLines).toBe(0);
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('answers empty rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY_NIGHT, rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the good rows', async () => {
    const res = await app.request(`/api/digest/${BAD_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Digest;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(badJobs);
  });
});

describe('page and JSON agree', () => {
  it.each([
    [GOOD_NIGHT, goodJobs],
    [BAD_NIGHT, badJobs],
  ])('%s lists the same jobs in the same order', async (night, jobs) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as Digest;
    expect(body.rows.map((r) => r.job)).toEqual(jobs);
    expectInOrder(html, body.rows.map((r) => r.job));
  });
});
