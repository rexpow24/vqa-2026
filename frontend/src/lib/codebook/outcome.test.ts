// Run with: node --test src/lib/codebook/outcome.test.ts (Node 24 runs TypeScript directly).
import assert from "node:assert/strict";
import test from "node:test";
import { outcomeConflict, outcomeRow } from "./outcome.ts";

const ENTITIES = [
  { key: "A", cells: { type: { option: "type.car" }, dashcam: { option: "dashcam.yes" } } },
  { key: "B", cells: { type: { option: "type.motorbike" }, vehicle_color: { option: "vehicle_color.red" } } },
];
const COLLISION = { event_type: { option: "event_type.collision" }, subject: { entity: "B" }, object: { entity: "A" } };
const NEAR_MISS = { ...COLLISION, event_type: { option: "event_type.near_miss" } };
const SEVERE = { level: { option: "level.severe" }, signs: { options: ["sign.overturned"] }, parties: [{ entity: "B" }, { entity: "A" }] };

test("saving a near-miss C writes O as no collision, once", () => {
  const row = outcomeRow(NEAR_MISS, null, ENTITIES, "o-draft");
  assert.deepEqual(row, { draft_id: "o-draft", codebook_version: "O.v2", slots: { level: { option: "level.none" } },
    human_keyframes_s: [], edited_answer: "Không quan sát thấy va chạm hoặc hư hỏng phương tiện." });
  assert.equal(outcomeRow(NEAR_MISS, { slots: row!.slots as never, codebook_version: "O.v2", edited_answer: row!.edited_answer as string },
    ENTITIES, "o-draft"), null);
  assert.equal(outcomeRow(NEAR_MISS, null, ENTITIES, null), null);
});

test("saving a collision C leaves O to the annotator unless an O.v2 answer already has signs", () => {
  assert.equal(outcomeRow(COLLISION, null, ENTITIES, "o-draft"), null);
  assert.equal(outcomeRow(COLLISION, { slots: { level: { option: "level.none" } }, codebook_version: "O.v2", edited_answer: "x" },
    ENTITIES, "o-draft"), null);
  assert.equal(outcomeRow(COLLISION, { slots: { level: { option: "level.minor" }, sign: { option: "sign.scrape_stationary" } },
    codebook_version: "O.v1", edited_answer: "x" }, ENTITIES, "o-draft"), null);
  const swapped = { ...COLLISION, subject: { entity: "A" }, object: { entity: "B" } };
  const kept = outcomeRow(swapped, { slots: { ...SEVERE, parties: undefined } as never, codebook_version: "O.v2", edited_answer: "x" },
    ENTITIES, "o-draft");
  assert.deepEqual(kept?.slots, { level: { option: "level.severe" }, signs: { options: ["sign.overturned"] },
    parties: [{ entity: "A" }, { entity: "B" }] });
});

test("a stored O.v2 that contradicts C blocks completion; O.v1 is not checked", () => {
  assert.equal(outcomeConflict(COLLISION, { slots: SEVERE, codebook_version: "O.v2", edited_answer: "x" }), null);
  assert.match(outcomeConflict(COLLISION, { slots: { level: { option: "level.none" } }, codebook_version: "O.v2", edited_answer: "x" })!,
    /chọn dấu hiệu/);
  assert.match(outcomeConflict(NEAR_MISS, { slots: SEVERE, codebook_version: "O.v2", edited_answer: "x" })!, /tải lại trang/);
  assert.equal(outcomeConflict(NEAR_MISS, { slots: { level: { option: "level.minor" } }, codebook_version: "O.v1", edited_answer: "x" }), null);
  assert.equal(outcomeConflict(null, { slots: SEVERE, codebook_version: "O.v2", edited_answer: "x" }), null);
});
