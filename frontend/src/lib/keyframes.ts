// Evidence keyframes from one impact mark (features/impact-keyframe).
//
// The annotator marks the collision frame (near miss: the moment the two
// parties are closest) and the app stores [mark - pad, mark + pad], clamped
// to the clip. Storage is unchanged: `human_keyframes_s` is still [start, end].
// The 2 s pad is a project convention, chosen from the Start-End spans
// annotators set by hand on videos #1-#40 (median 3.6 s).

import type { Slots } from "./codebook/compose.ts";

export const IMPACT_PAD_S = 2;
/** R `has_aftermath` is suggested "có" when the clip runs at least this long after C End. */
export const AFTERMATH_MIN_S = 2;

const round = (time: number) => Number(time.toFixed(3));
const EPS = 0.0015;

/** [start, end] around `mark`, clamped to [0, duration]; null when the mark is outside the clip or the span is empty. */
export function impactWindow(mark: number, duration: number, pad = IMPACT_PAD_S): [number, number] | null {
  if (!Number.isFinite(mark) || !Number.isFinite(duration) || mark < 0 || mark > duration) return null;
  const start = round(Math.max(0, mark - pad));
  const end = round(Math.min(duration, mark + pad));
  return start < end ? [start, end] : null;
}

/**
 * The mark a stored pair was made from, or null when it was not made by
 * `impactWindow` (a legacy pair set by hand, or a clip shorter than the
 * window, where both ends are clamped and the mark is lost).
 */
export function impactMark(pair: readonly number[], duration: number, pad = IMPACT_PAD_S): number | null {
  if (pair.length !== 2) return null;
  const [start, end] = pair;
  if (!(start < end)) return null;
  if (Math.abs(end - start - 2 * pad) < EPS) return round((start + end) / 2);
  const atStart = start === 0;
  const atEnd = Math.abs(end - duration) < EPS;
  if (atStart && !atEnd && end >= pad && end < 2 * pad) return round(end - pad);
  if (atEnd && !atStart && end - start >= pad && end - start < 2 * pad) return round(start + pad);
  return null;
}

/**
 * The suggested R `has_aftermath` option from the caller's own C keyframes:
 * "có" when the clip runs at least AFTERMATH_MIN_S after C End, else "không".
 * Nothing when C has no [start, end] pair, the duration is unknown, or R is
 * already saved (a saved answer is never overridden).
 */
export function suggestAftermath(causeKeyframes: readonly number[] | null | undefined, duration: number | undefined,
  savedR?: Slots | null): "has_aftermath.yes" | "has_aftermath.no" | null {
  if (savedR) return null;
  if (!causeKeyframes || causeKeyframes.length !== 2 || !(causeKeyframes[0] < causeKeyframes[1])) return null;
  if (duration === undefined || !Number.isFinite(duration)) return null;
  // Rounded so a float like 14 - 12.000000001 is not read as under 2 s.
  return round(duration - causeKeyframes[1]) >= AFTERMATH_MIN_S ? "has_aftermath.yes" : "has_aftermath.no";
}
