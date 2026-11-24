/**
 * Group C hints and reference videos (features/c-reference-hints): for each
 * conflict type K, what to look at, which K it is easily confused with, and the
 * rendered reference clips on Drive. Built by scripts/build-c-references.mjs.
 */
import data from "./C.json" with { type: "json" };

export type PairReference = { id: string; title: string; cues: string[] };
export type Confusable = { code: string; title: string; measured: boolean; pair: PairReference | null };
export type ConflictHint = { title: string; cues: string[]; edge: string; video: string; confusable: Confusable[] };

const TYPES = data.types as Record<string, ConflictHint>;
const VIDEOS = data.videos as Record<string, string>;

/** "conflict_type.k08" gives "K08"; anything that is not a K gives null. */
export function conflictCode(option: string | undefined | null): string | null {
  const match = /^conflict_type\.k(\d\d)$/.exec(option ?? "");
  return match ? `K${match[1]}` : null;
}

/** The hint of one K, or null for a code that is not listed. */
export function conflictHint(code: string): ConflictHint | null {
  return Object.hasOwn(TYPES, code) ? TYPES[code] : null;
}

/**
 * The Drive file of a reference clip ("K08" or "K08-K09"), or null when it is
 * not listed or listed without a file yet.
 */
export function referenceDriveId(id: string): string | null {
  return Object.hasOwn(VIDEOS, id) && VIDEOS[id] ? VIDEOS[id] : null;
}

/** Every K, in order, for the "đang phân vân" picker. */
export function conflictCodes(): string[] {
  return Object.keys(TYPES).sort();
}
