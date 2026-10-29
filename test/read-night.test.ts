import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';
import type { DigestRow } from '../src/digest/types.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-night-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function night(content: string): ReturnType<typeof readNight> {
  writeFileSync(join(dir, 'n.jsonl'), content);
  return readNight(dir, 'n');
}

function rowsOf(content: string): { rows: DigestRow[]; badLines: number } {
  const result = night(content);
  if (result.kind !== 'rows') throw new Error(`expected rows, got ${result.kind}`);
  return result;
}

const line = (o: Record<string, unknown>) => JSON.stringify(o);
const run = (at: string, job: string, extra: Record<string, unknown> = {}) =>
  line({ at, job, status: 'ok', owner: 'rook', ...extra });

describe('readNight on the real log', () => {
  const result = readNight('runs', '2026-10-28');
  if (result.kind !== 'rows') throw new Error('expected rows');
  const byJob = (job: string) => result.rows.find((r) => r.job === job)!;

  it('folds 5 jobs, sorted, and counts the cut-off last line as bad', () => {
    expect(result.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(result.badLines).toBe(1);
  });

  it('does not turn the cut-off line into a lane/sync run', () => {
    const sync = byJob('lane/sync');
    expect(sync.runs).toBe(8);
    expect(sync.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('counts retries and takes the last status', () => {
    expect(byJob('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the last error of a failed job', () => {
    expect(byJob('notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      owner: 'lane-07',
    });
  });

  it('keeps a row whose owner is null', () => {
    expect(byJob('digest/render')).toMatchObject({ owner: null, runs: 1 });
  });
});

describe('readNight edge cases', () => {
  it('missing file is missing', () => {
    expect(readNight(dir, 'nope')).toEqual({ kind: 'missing' });
  });

  it('empty file is empty', () => {
    expect(night('')).toEqual({ kind: 'empty' });
  });

  it('whitespace-only file is empty', () => {
    expect(night('\n  \n\t\n')).toEqual({ kind: 'empty' });
  });

  it('a file of only bad lines is rows: [] with badLines', () => {
    expect(night('nope\n{"at":\n')).toEqual({ kind: 'rows', rows: [], badLines: 2 });
  });

  it('ignores blank lines and a trailing newline', () => {
    const { rows, badLines } = rowsOf(`${run('2026-10-28T23:00:00+01:00', 'a')}\n\n  \n${run('2026-10-28T23:05:00+01:00', 'a')}\n`);
    expect(badLines).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.runs).toBe(2);
  });

  it('handles CRLF line endings', () => {
    const { rows, badLines } = rowsOf(`${run('2026-10-28T23:00:00+01:00', 'a')}\r\n${run('2026-10-28T23:05:00+01:00', 'a')}\r\n`);
    expect(badLines).toBe(0);
    expect(rows[0]!.runs).toBe(2);
  });

  it.each([
    ['truncated json', '{"at":"2026-10-28T23:00:00+01:00","job":"a","sta'],
    ['an unknown status', line({ at: '2026-10-28T23:00:00+01:00', job: 'a', status: 'done', owner: null })],
    ['an unparseable at', line({ at: 'yesterday', job: 'a', status: 'ok', owner: null })],
    ['a missing owner key', line({ at: '2026-10-28T23:00:00+01:00', job: 'a', status: 'ok' })],
  ])('counts %s as a bad line', (_name, bad) => {
    const { rows, badLines } = rowsOf(`${bad}\n${run('2026-10-28T23:00:00+01:00', 'ok-job')}\n`);
    expect(badLines).toBe(1);
    expect(rows.map((r) => r.job)).toEqual(['ok-job']);
  });

  it('orders by instant, not by file order or string, and keeps the original strings', () => {
    // 23:30+01:00 is 22:30Z, earlier than 23:00+00:00 even though the string sorts later.
    const { rows } = rowsOf(
      [
        run('2026-10-28T23:00:00+00:00', 'a', { status: 'fail', error: 'late' }),
        run('2026-10-28T23:30:00+01:00', 'a', { status: 'retry' }),
      ].join('\n'),
    );
    expect(rows[0]).toMatchObject({
      firstAt: '2026-10-28T23:30:00+01:00',
      lastAt: '2026-10-28T23:00:00+00:00',
      lastStatus: 'fail',
      lastError: 'late',
      retries: 1,
    });
  });

  it('owner is the last non-null owner seen', () => {
    const { rows } = rowsOf(
      [
        run('2026-10-28T23:00:00+01:00', 'a', { owner: 'x' }),
        run('2026-10-28T23:10:00+01:00', 'a', { owner: 'y' }),
        run('2026-10-28T23:20:00+01:00', 'a', { owner: null }),
      ].join('\n'),
    );
    expect(rows[0]!.owner).toBe('y');
  });

  it('lastError is null when the last line has no error', () => {
    const { rows } = rowsOf(
      [
        run('2026-10-28T23:00:00+01:00', 'a', { status: 'retry', error: 'boom' }),
        run('2026-10-28T23:10:00+01:00', 'a'),
      ].join('\n'),
    );
    expect(rows[0]).toMatchObject({ lastStatus: 'ok', lastError: null });
  });

  it('sorts rows by job with a plain string compare', () => {
    const { rows } = rowsOf(
      ['b', 'B', 'a', 'a/b'].map((j) => run('2026-10-28T23:00:00+01:00', j)).join('\n'),
    );
    expect(rows.map((r) => r.job)).toEqual(['B', 'a', 'a/b', 'b']);
  });
});
