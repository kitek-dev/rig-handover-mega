export type RunStatus = "ok" | "retry" | "fail";

/** One row per job for a night. Times are the original strings from the log, offset kept. */
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  rows: DigestRow[];
  /** Lines that did not parse; counted, never thrown. */
  badLines: number;
};

/** Reads `<runsDir>/<night>.jsonl`. Resolves to null when the file does not exist. */
export async function readNight(runsDir: string, night: string): Promise<NightDigest | null> {
  void runsDir;
  void night;
  throw new Error("not implemented");
}
