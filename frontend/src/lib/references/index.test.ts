import assert from "node:assert/strict";
import test from "node:test";
import { conflictCode, conflictHint, referenceDriveId } from "./index.ts";

test("conflictCode reads the K of a C conflict-type option", () => {
  assert.equal(conflictCode("conflict_type.k08"), "K08");
  assert.equal(conflictCode("conflict_type.unclear"), null);
  assert.equal(conflictCode(undefined), null);
});

test("every K has cues and a video; K08 flags K09 with the pair comparison (features/c-reference-hints)", () => {
  for (let n = 1; n <= 18; n += 1) {
    const hint = conflictHint(`K${String(n).padStart(2, "0")}`)!;
    assert.ok(hint.cues.length > 0 && hint.video, `K${n}`);
  }
  const k08 = conflictHint("K08")!;
  const k09 = k08.confusable.find((item) => item.code === "K09")!;
  assert.equal(k09.measured, true);
  assert.equal(k09.pair?.id, "K08-K09");
  // a pair without a rendered comparison falls back to the single K videos
  assert.equal(conflictHint("K04")!.confusable.find((item) => item.code === "K12")!.pair, null);
  assert.equal(conflictHint("K99"), null);
});

test("only listed reference ids resolve to a Drive file", () => {
  assert.match(referenceDriveId("K08-K09")!, /^[\w-]{20,}$/);
  assert.match(referenceDriveId("K14")!, /^[\w-]{20,}$/);
  assert.equal(referenceDriveId("K99"), null);
  assert.equal(referenceDriveId("../../etc"), null);
  assert.equal(referenceDriveId("toString"), null);
  // features/welcome-gate: listed, but without a Drive file until it is uploaded
  assert.equal(referenceDriveId("welcome"), null);
});
