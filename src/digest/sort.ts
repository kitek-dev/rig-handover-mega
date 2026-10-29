import type { DigestRow } from "./types.js";

/** Rows ordered by job, plain string order. Shared by the page and the JSON (ADR 0001). */
export function sortRows(rows: readonly DigestRow[]): DigestRow[] {
  return [...rows].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}
