// Run with: node --test --experimental-strip-types src/lib/codebook/c-roles.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { C_SUBJECT_ROLES, subjectRoleLabel } from "./c-roles.ts";
import { getCodebook } from "./index.ts";

const conflictOptions = () => getCodebook("C.v4")!.cells.find((cell) => cell.id === "conflict_type")!.options ?? [];

test("every K01-K18 conflict type of C.v4 has a subject role, and nothing else does", () => {
  const coded = conflictOptions().filter((option) => /^K\d\d$/.test(String(option.code ?? "")));
  assert.equal(coded.length, 18);
  for (const option of coded) assert.ok(C_SUBJECT_ROLES[option.id], `no role for ${option.id}`);
  assert.deepEqual(Object.keys(C_SUBJECT_ROLES).sort(), coded.map((option) => option.id).sort());
});

test("the roles are the ones of the reference sheet kieu-xung-dot.html", () => {
  const html = readFileSync(new URL("../../../../annotator-guidelines/tham-khao-C/kieu-xung-dot.html", import.meta.url), "utf8");
  const rows = [...html.matchAll(/\["(K\d\d)", "f\d", "[^"]*", "([^"]*)"/g)];
  assert.equal(rows.length, 18);
  for (const [, code, role] of rows) assert.equal(C_SUBJECT_ROLES[`conflict_type.${code.toLowerCase()}`], role, code);
});

test("the subject question names the role, and falls back without a K", () => {
  assert.equal(subjectRoleLabel("conflict_type.k12"), "Bên nào là xe từ đường nhánh?");
  assert.equal(subjectRoleLabel("conflict_type.k01"), "Bên nào là xe phía sau?");
  assert.equal(subjectRoleLabel("conflict_type.k15"), "Bên nào là người đi bộ?");
  assert.equal(subjectRoleLabel("conflict_type.unclear"), null);
  assert.equal(subjectRoleLabel(undefined), null);
  assert.equal(subjectRoleLabel("constructor"), null);
});
