import assert from "node:assert/strict";
import test from "node:test";
import { namingChecks } from "./entity-naming.ts";

const party = (key: string, type: string, dashcam?: string) =>
  ({ key, cells: { type: { option: type }, ...(dashcam ? { dashcam: { option: dashcam } } : {}) } });

test("a dashcam car that is not A gets a check line (guideline E: the dashcam vehicle is A)", () => {
  assert.deepEqual(namingChecks([party("A", "type.motorbike"), party("B", "type.car", "dashcam.yes")]), [
    "Bên B là xe ghi hình (ô tô có camera hành trình). Xe ghi hình thuộc cặp chính thì là A: bạn có đặt nhầm tên không?",
  ]);
});

test("the dashcam car as A, or no dashcam car, adds no check line", () => {
  assert.deepEqual(namingChecks([party("A", "type.car", "dashcam.yes"), party("B", "type.truck")]), []);
  assert.deepEqual(namingChecks([party("A", "type.motorbike"), party("B", "type.car", "dashcam.no")]), []);
  assert.deepEqual(namingChecks([party("A", "type.car")]), []);
  assert.deepEqual(namingChecks([]), []);
});

test("two dashcam cars get a check line", () => {
  assert.deepEqual(namingChecks([party("A", "type.car", "dashcam.yes"), party("B", "type.car", "dashcam.yes")]), [
    "Cả 2 bên đều chọn có camera hành trình, nhưng video chỉ có một xe ghi hình: bạn có chọn nhầm ô camera không?",
  ]);
});
