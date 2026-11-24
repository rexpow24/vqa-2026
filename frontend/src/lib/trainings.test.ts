import assert from "node:assert/strict";
import test from "node:test";
import { GUIDE_TRAININGS, WELCOME_TRAINING, isTrainingId, missingForSave, requiredTraining } from "./trainings.ts";

test("the welcome training is not tied to a group, and its id is accepted (features/welcome-gate)", () => {
  assert.equal(WELCOME_TRAINING.id, "WELCOME-v1");
  assert.equal(WELCOME_TRAINING.video, "welcome");
  assert.equal(isTrainingId("WELCOME-v1"), true);
  assert.equal(isTrainingId("C-v1"), true);
  assert.equal(isTrainingId("E-v1"), true);
  assert.equal(isTrainingId("WELCOME-v0"), false);
  for (const group of ["S", "C", "E", "N", "O"]) assert.notEqual(requiredTraining(group)?.id, "WELCOME-v1");
});

test("a save needs the welcome video first, then the group's own training", () => {
  assert.deepEqual(missingForSave("S", []).map((t) => t.id), ["WELCOME-v1"]);
  assert.deepEqual(missingForSave("C", ["C-v1", "E-v1"]).map((t) => t.id), ["WELCOME-v1"]);
  assert.deepEqual(missingForSave("C", []).map((t) => t.id), ["WELCOME-v1", "C-v1"]);
  assert.deepEqual(missingForSave("C", ["WELCOME-v1"]).map((t) => t.id), ["C-v1"]);
  assert.deepEqual(missingForSave("E", ["WELCOME-v1", "C-v1"]).map((t) => t.id), ["E-v1"]);
  assert.deepEqual(missingForSave("S", ["WELCOME-v1"]), []);
  assert.deepEqual(missingForSave("C", ["WELCOME-v1", "C-v1"]), []);
});

test("the guide page lists the welcome video, then the C and E trainings", () => {
  assert.deepEqual(GUIDE_TRAININGS.map((item) => [item.heading, item.training.id]), [
    ["Video welcome (bắt buộc)", "WELCOME-v1"],
    ["Hướng dẫn nhóm C", "C-v1"],
    ["Hướng dẫn nhóm E", "E-v1"],
  ]);
});
