import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countByLastStatus, type StatusCounts } from './digest/counts.js';
import { readNight } from './digest/read-night.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightSummary = { night: string; counts: StatusCounts };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Missing or empty nights count as zeros.
function summarize(runsDir: string, night: string): NightSummary {
  const result = readNight(runsDir, night);
  const rows = result.kind === 'rows' ? result.rows : [];
  return { night, counts: countByLastStatus(rows) };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarize(config.runsDir, n)),
  };
}
