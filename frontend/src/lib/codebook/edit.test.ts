// Run with: node --test src/lib/codebook/edit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { editProblem, sentenceToStore } from "./edit.ts";

const composed = "Xe tải to màu xanh lấn khi vượt, đi đối đầu với xe ô tô (có camera hành trình), suýt xảy ra va chạm.";

test("adding connectives, changing case and punctuation is allowed", () => {
  assert.equal(editProblem(composed, composed), null);
  assert.equal(editProblem(composed,
    "Chiếc xe tải to màu xanh lấn làn khi vượt, rồi đi đối đầu với xe ô tô (có camera hành trình) nên suýt xảy ra va chạm."), null);
  assert.equal(editProblem("Trời nắng, ban ngày.", "trời nắng và là ban ngày"), null);
});

test("removing, changing or reordering a word of the composed sentence is refused", () => {
  assert.match(editProblem(composed, composed.replace("xanh", "đỏ"))!, /thiếu "xanh"/);
  assert.match(editProblem(composed, composed.replace("suýt ", ""))!, /thiếu "suýt"/);
  assert.match(editProblem("Trời nắng, ban ngày.", "Ban ngày, trời nắng.")!, /sai thứ tự/);
});

test("an empty or overlong sentence is refused", () => {
  assert.equal(editProblem(composed, "   "), "Câu không được để trống.");
  assert.match(editProblem(composed, composed + " x".repeat(600))!, /dài quá/);
});

test("the stored sentence is the edit only when it differs", () => {
  assert.equal(sentenceToStore(composed, null), composed);
  assert.equal(sentenceToStore(composed, `  ${composed} `), composed);
  assert.equal(sentenceToStore(composed, "Chiếc " + composed), "Chiếc " + composed);
});
