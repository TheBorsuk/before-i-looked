/**
 * Morning digest: shared types (plan morning-digest, § 1).
 *
 * The implementation lives in `src/digest/read-night.ts` and exports
 * `readNight: ReadNight`. It is synchronous, like the rest of rig's fs code, and
 * returns rows sorted by `job` so the page and the JSON share one order (ADR 0001).
 */

/** Status of one run line in `runs/<night>.jsonl`. */
export type RunStatus = "ok" | "retry" | "fail";

/** One job's night, folded from all of its run lines. */
export interface DigestRow {
  job: string;
  /** `null` when the log has no owner for the job; render as `—`. */
  owner: string | null;
  /** Number of run lines for the job. */
  runs: number;
  /** Number of run lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** `error` of the last run line; `null` when it has none. */
  lastError: string | null;
  /** The log's own `at` string of the first run line, offset kept. */
  firstAt: string;
  /** The log's own `at` string of the last run line, offset kept. */
  lastAt: string;
}

/** Result of reading one night. Callers branch on `kind`. */
export type NightResult =
  /** No `runs/<night>.jsonl`: the route answers 404. */
  | { kind: "missing" }
  /** The file exists and is empty: the page says "nothing ran". */
  | { kind: "empty" }
  /** Non-empty file. `rows` is sorted by `job` (empty if every line was bad). */
  | {
      kind: "rows";
      rows: DigestRow[];
      /** Lines that did not parse; counted, never thrown. */
      badLines: number;
    };

/** Reads `<runsDir>/<night>.jsonl` into one row per job, sorted by job. */
export type ReadNight = (runsDir: string, night: string) => NightResult;
