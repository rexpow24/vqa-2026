// Run with: node --test --experimental-strip-types src/lib/keyframes.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { AFTERMATH_MIN_S, IMPACT_PAD_S, impactMark, impactWindow, suggestAftermath } from "./keyframes.ts";

test("impactWindow puts start and end 2 s around the mark", () => {
  assert.equal(IMPACT_PAD_S, 2);
  assert.deepEqual(impactWindow(10, 30), [8, 12]);
  assert.deepEqual(impactWindow(10.12345, 30), [8.123, 12.123]);
  assert.deepEqual(impactWindow(5, 30, 1), [4, 6]);
});

test("impactWindow clamps to the start of the clip", () => {
  assert.deepEqual(impactWindow(0.5, 30), [0, 2.5]);
  assert.deepEqual(impactWindow(0, 30), [0, 2]);
});

test("impactWindow clamps to the end of the clip", () => {
  assert.deepEqual(impactWindow(29, 30), [27, 30]);
  assert.deepEqual(impactWindow(30, 30), [28, 30]);
});

test("impactWindow on a very short clip spans the whole clip, and refuses an empty span", () => {
  assert.deepEqual(impactWindow(1, 3), [0, 3]);
  assert.deepEqual(impactWindow(0.2, 0.5), [0, 0.5]);
  assert.equal(impactWindow(0, 0), null);
});

test("impactWindow refuses a mark outside the clip or not a number", () => {
  assert.equal(impactWindow(-0.1, 30), null);
  assert.equal(impactWindow(30.1, 30), null);
  assert.equal(impactWindow(Number.NaN, 30), null);
  assert.equal(impactWindow(5, Number.NaN), null);
});

test("impactMark recovers the mark of a window, also a clamped one, and none for a legacy free pair", () => {
  assert.equal(impactMark([8, 12], 30), 10);
  assert.equal(impactMark([8.123, 12.123], 30), 10.123);
  assert.equal(impactMark([0, 2.5], 30), 0.5);
  assert.equal(impactMark([27, 30], 30), 29);
  assert.equal(impactMark([3.1, 6.7], 30), null);
  assert.equal(impactMark([0, 3], 3), null);
  assert.equal(impactMark([5], 30), null);
  assert.equal(impactMark([], 30), null);
});

test("suggestAftermath: at least 2 s after C End suggests yes, less suggests no", () => {
  assert.equal(AFTERMATH_MIN_S, 2);
  assert.equal(suggestAftermath([8, 12], 14), "has_aftermath.yes");
  assert.equal(suggestAftermath([8, 12], 20), "has_aftermath.yes");
  assert.equal(suggestAftermath([8, 12], 13.999), "has_aftermath.no");
  assert.equal(suggestAftermath([27, 30], 30), "has_aftermath.no");
});

test("suggestAftermath gives nothing without C keyframes, a duration, or once R is saved", () => {
  assert.equal(suggestAftermath(null, 30), null);
  assert.equal(suggestAftermath([], 30), null);
  assert.equal(suggestAftermath([5], 30), null);
  assert.equal(suggestAftermath([8, 12], Number.NaN), null);
  assert.equal(suggestAftermath([8, 12], 30, { has_aftermath: { option: "has_aftermath.no" } }), null);
});
