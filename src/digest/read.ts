import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DigestRow, NightDigest, RunStatus } from "./types.js";

/** One validated line of the run log. */
type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ["ok", "retry", "fail"] satisfies RunStatus[];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStatus(v: unknown): v is RunStatus {
  return typeof v === "string" && STATUSES.includes(v);
}

/** Parses one line. Returns null when it is not JSON or not the expected shape. */
export function parseLine(line: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const { at, job, status, owner, error } = raw;
  if (typeof at !== "string" || at === "") return null;
  if (typeof job !== "string" || job === "") return null;
  if (!isStatus(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== "string") return null;
  if (error !== undefined && error !== null && typeof error !== "string") return null;
  return { at, job, status, owner: owner ?? null, error: error ?? null };
}

/** Folds the log text into one row per job, in order of first appearance. */
export function digestLines(text: string): NightDigest {
  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const run = parseLine(line);
    if (!run) {
      badLines++;
      continue;
    }
    const row = rows.get(run.job);
    if (!row) {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === "retry" ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error,
        firstAt: run.at,
        lastAt: run.at,
      });
      continue;
    }
    row.runs++;
    if (run.status === "retry") row.retries++;
    row.lastStatus = run.status;
    if (run.error !== null) row.lastError = run.error;
    if (run.owner !== null) row.owner = run.owner;
    row.lastAt = run.at;
  }
  return { rows: [...rows.values()], badLines };
}

/** Reads `<runsDir>/<night>.jsonl`. Resolves to null when the file does not exist. */
export async function readNight(runsDir: string, night: string): Promise<NightDigest | null> {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = await readFile(join(runsDir, `${night}.jsonl`), "utf8");
  } catch (err) {
    if (isRecord(err) && err.code === "ENOENT") return null;
    throw err;
  }
  return digestLines(text);
}
