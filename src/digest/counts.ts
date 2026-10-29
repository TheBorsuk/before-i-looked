import type { DigestRow, RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Jobs by how they ended (last status per job), not run lines.
export function countByLastStatus(rows: DigestRow[]): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) counts[row.lastStatus] += 1;
  return counts;
}
