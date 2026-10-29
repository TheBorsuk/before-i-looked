import { describe, expect, it } from 'vitest';
import { countByLastStatus } from '../src/digest/counts.js';
import type { DigestRow, RunStatus } from '../src/digest/types.js';

const row = (job: string, lastStatus: RunStatus, retries = 0): DigestRow => ({
  job,
  owner: null,
  runs: 1 + retries,
  retries,
  lastStatus,
  lastError: null,
  firstAt: '2026-10-28T02:00:00+01:00',
  lastAt: '2026-10-28T02:05:00+01:00',
});

describe('countByLastStatus', () => {
  it('is all zeros for no rows', () => {
    expect(countByLastStatus([])).toEqual({ ok: 0, retry: 0, fail: 0 });
  });

  it('counts jobs by how they ended, not by retries along the way', () => {
    const rows = [row('a', 'ok', 2), row('b', 'ok'), row('c', 'retry'), row('d', 'fail', 3)];
    expect(countByLastStatus(rows)).toEqual({ ok: 2, retry: 1, fail: 1 });
  });
});
