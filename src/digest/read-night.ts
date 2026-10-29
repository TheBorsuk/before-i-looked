import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightResult, ReadNight, RunStatus } from './types.js';

type Run = {
  at: string;
  instant: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// One log line -> Run, or null when it is not a well-formed run line.
function parseRun(line: string): Run | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const instant = Date.parse(at);
  if (Number.isNaN(instant)) return null;
  return { at, instant, job, status: status as RunStatus, owner, error: error ?? null };
}

function foldJob(job: string, runs: Run[]): DigestRow {
  // Array.prototype.sort is stable: equal instants keep file order.
  const ordered = [...runs].sort((a, b) => a.instant - b.instant);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  let owner: string | null = null;
  for (const run of ordered) if (run.owner !== null) owner = run.owner;
  return {
    job,
    owner,
    runs: ordered.length,
    retries: ordered.filter((r) => r.status === 'retry').length,
    lastStatus: last.status,
    lastError: last.error,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night): NightResult => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' };
    throw err;
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { kind: 'empty' };

  const byJob = new Map<string, Run[]>();
  let badLines = 0;
  for (const line of lines) {
    const run = parseRun(line);
    if (run === null) {
      badLines += 1;
      continue;
    }
    const runs = byJob.get(run.job);
    if (runs) runs.push(run);
    else byJob.set(run.job, [run]);
  }

  const rows = [...byJob].map(([job, runs]) => foldJob(job, runs));
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { kind: 'rows', rows, badLines };
};
