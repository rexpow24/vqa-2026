// Run with: node --test src/lib/codebook/compose.test.ts (Node 24 runs TypeScript directly).
import assert from "node:assert/strict";
import test from "node:test";
import { compose } from "./compose.ts";

test("S fills the guideline template with the chosen labels", () => {
  assert.equal(compose("S", {
    weather: { option: "weather.sunny" }, light: { option: "light.day" }, road_type: { option: "road_type.one_way" },
    segment: { option: "segment.straight" }, surface: { option: "surface.dry" }, density: { option: "density.sparse" },
  }), "Trời nắng, ban ngày, một chiều tại thẳng, mặt đường khô, mật độ xe thưa.");
});

const entity = (key: string, cells: Record<string, string>) => ({
  key, cells: Object.fromEntries(Object.entries(cells).map(([cell, option]) => [cell, { option }])),
});

test("E joins the entities in key order, lower-casing all but the first", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.car", dashcam: "dashcam.yes" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red",
      clothing_color: "clothing_color.blue_green", riders: "riders.one" }),
    entity("C", { type: "type.pedestrian", clothing_color: "clothing_color.white" }),
  ] }), "Xe ô tô (có camera hành trình), xe máy màu đỏ do người mặc áo xanh điều khiển, người đi bộ mặc áo trắng.");
});

test("E without any declared entity cannot be determined", () => {
  assert.equal(compose("E", { entities: [] }), "Không thể xác định.");
});

test("E drops the part of an unclear cell", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.motorbike", vehicle_color: "vehicle_color.black", clothing_color: "clothing_color.unclear" }),
    entity("B", { type: "type.car", dashcam: "dashcam.no", vehicle_color: "vehicle_color.unclear" }),
  ] }), "Xe máy màu đen, xe ô tô.");
});

test("E names trucks and buses by type, size and colour, and counts riders from two", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.truck", size: "size.large", vehicle_color: "vehicle_color.blue_green" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.white", clothing_color: "clothing_color.red", riders: "riders.two" }),
    entity("C", { type: "type.animal" }),
  ] }), "Xe tải to màu xanh, xe máy màu trắng do người mặc áo đỏ điều khiển chở 2 người, động vật.");
});

test("E puts \"trở lên\" after \"người\" for three riders or more", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.motorbike", vehicle_color: "vehicle_color.black", riders: "riders.three_plus" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red", riders: "riders.two" }),
  ] }), "Xe máy màu đen chở 3 người trở lên, xe máy màu đỏ chở 2 người.");
});

test("E adds the letter when two entities share type and colour", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.motorbike", vehicle_color: "vehicle_color.white" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.white", clothing_color: "clothing_color.black" }),
  ] }), "Xe máy màu trắng A, xe máy màu trắng B do người mặc áo đen điều khiển.");
});

const ENTITIES = [
  entity("A", { type: "type.car", dashcam: "dashcam.yes" }),
  entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red", clothing_color: "clothing_color.blue_green" }),
  entity("C", { type: "type.pedestrian", clothing_color: "clothing_color.white" }),
];
const o = (option: string) => ({ option });
const e = (key: string) => ({ entity: key });

test("C names the parties by their E name and fills the collision pattern", () => {
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: e("B"), object: e("A"),
    conflict_type: o("conflict_type.k04"), action: o("action.k04.lane_change_left"), speed: o("speed.accelerate") },
  { entities: ENTITIES }),
  "Xe máy màu đỏ chuyển sang làn bên trái và tăng tốc, đi vào đường đi của xe ô tô (có camera hành trình), dẫn đến va chạm.");
});

test("C near miss names who evaded, how, and the result", () => {
  assert.equal(compose("C", { event_type: o("event_type.near_miss"), subject: e("C"), object: e("A"),
    conflict_type: o("conflict_type.k15"), action: o("action.k15.left_to_right"),
    evader: e("A"), evasion: o("evasion.hard_brake"), evasion_result: { option: "evasion_result.hit_other", entity: "B" } },
  { entities: ENTITIES }),
  "Người đi bộ mặc áo trắng từ trái sang phải, cắt ngang phía trước xe ô tô (có camera hành trình), "
  + "xe ô tô (có camera hành trình) phải phanh gấp, chạm vào xe máy màu đỏ.");
});

test("C drops the parts an unclear or relation-less cell leaves empty", () => {
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: e("B"), conflict_type: o("conflict_type.unclear") },
    { entities: ENTITIES }), "Xe máy màu đỏ, dẫn đến va chạm.");
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: e("B"),
    conflict_type: o("conflict_type.k18"), action: o("action.k18.skid") }, { entities: ENTITIES }),
  "Xe máy màu đỏ trượt, dẫn đến va chạm.");
});

test("C refuses an entity the annotator did not declare", () => {
  assert.throws(() => compose("C", { event_type: o("event_type.collision"), subject: e("D"),
    conflict_type: o("conflict_type.unclear") }, { entities: ENTITIES }), { code: "unknown_entity" });
});

test("V uses the three guideline sentences, with the free text of 'khác'", () => {
  assert.equal(compose("V", { result: o("result.yes"), violator: e("B"), behavior: o("behavior.wrong_lane") },
    { entities: ENTITIES }), "Xe máy màu đỏ đi sai làn, lấn làn.");
  assert.equal(compose("V", { result: o("result.yes"), violator: e("C"), behavior: { option: "behavior.other", text: "đi vào làn xe buýt" } },
    { entities: ENTITIES }), "Người đi bộ mặc áo trắng đi vào làn xe buýt.");
  assert.equal(compose("V", { result: o("result.none_observed") }), "Không quan sát thấy vi phạm quy tắc giao thông rõ ràng.");
  assert.equal(compose("V", { result: o("result.unclear") }), "Không thể xác định.");
});

test("O names both parties, one party, or uses the fixed sentences", () => {
  assert.equal(compose("O", { parties: [e("B"), e("A")], level: o("level.minor"), sign: o("sign.scrape_continued") },
    { entities: ENTITIES }), "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm nhẹ, chạm quẹt, vẫn đi tiếp.");
  assert.equal(compose("O", { parties: [e("B")], level: o("level.severe"), sign: o("sign.overturned") },
    { entities: ENTITIES }), "Xe máy màu đỏ bị lật.");
  assert.equal(compose("O", { level: o("level.none"), sign: o("sign.none") }), "Không quan sát thấy va chạm hoặc hư hỏng phương tiện.");
  assert.equal(compose("O", { level: o("level.unclear") }), "Không thể xác định.");
});

test("Prev gives one clause per party in key order", () => {
  assert.equal(compose("Prev", { parties: [{ party: e("B"), main_action: o("main_action.observe_and_yield") }] },
    { entities: ENTITIES }), "Xe máy màu đỏ nên quan sát và nhường đường.");
  assert.equal(compose("Prev", { parties: [
    { party: e("B"), main_action: o("main_action.slow_down"), extra_action: o("extra_action.keep_distance") },
    { party: e("A"), main_action: { option: "main_action.other", text: "bấm còi cảnh báo" } },
  ] }, { entities: ENTITIES }),
  "Xe ô tô (có camera hành trình) nên bấm còi cảnh báo; xe máy màu đỏ nên giảm tốc và giữ khoảng cách an toàn.");
});

test("Prev with an unclear party cannot be determined", () => {
  assert.equal(compose("Prev", { parties: [{ party: o("party.unclear") }] }, { entities: ENTITIES }), "Không thể xác định.");
});

test("C with both parties uses the \"Cả A và B\" pattern, parties in key order", () => {
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
    parties: [{ party: e("B"), action: o("action.k11.right_to_left") }, { party: e("A"), action: o("action.k11.left_to_right") }] },
  { entities: ENTITIES }),
  "Xe ô tô (có camera hành trình) từ trái sang phải, đồng thời xe máy màu đỏ từ phải sang trái, "
  + "đi vào đường đi của nhau, dẫn đến va chạm.");
  assert.equal(compose("C", { event_type: o("event_type.near_miss"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
    parties: [{ party: e("A"), action: o("action.k11.left_to_right") }, { party: e("C"), action: o("action.k11.right_to_left") }] },
  { entities: ENTITIES }).endsWith(", đi vào đường đi của nhau, dẫn đến suýt va chạm."), true);
});

test("C with both parties refuses anything but two parties", () => {
  assert.throws(() => compose("C", { event_type: o("event_type.collision"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
    parties: [{ party: e("A"), action: o("action.k11.left_to_right") }] }, { entities: ENTITIES }), { code: "parties" });
});

const C_BOTH_BA = { event_type: o("event_type.collision"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
  parties: [{ party: e("B"), action: o("action.k11.right_to_left") }, { party: e("A"), action: o("action.k11.left_to_right") }] };

test("R reads its subject and object from C, the first party by key for subject.both", () => {
  const r = { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), object: o("object.left"), bystanders: o("bystanders.helped") };
  assert.equal(compose("R", r, { entities: ENTITIES, cause: C_BOTH_BA }),
    "Xe ô tô (có camera hành trình) dừng lại, xe máy màu đỏ tiếp tục di chuyển, rời đi, người và xe xung quanh dừng lại hoặc đến hỗ trợ.");
  assert.equal(compose("R", r, { entities: ENTITIES, cause: { event_type: o("event_type.collision"), subject: e("B"), object: e("C"),
    conflict_type: o("conflict_type.unclear") } }),
  "Xe máy màu đỏ dừng lại, người đi bộ mặc áo trắng tiếp tục di chuyển, rời đi, người và xe xung quanh dừng lại hoặc đến hỗ trợ.");
});

test("R uses the guideline's short forms", () => {
  const cause = C_BOTH_BA;
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.no") }, { entities: ENTITIES, cause }), "Không thể xác định.");
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), object: o("object.stopped"),
    bystanders: o("bystanders.helped") }, { entities: ENTITIES, cause }), "Các bên dừng lại.");
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.left"), object: o("object.unclear"),
    bystanders: o("bystanders.nobody_stopped") }, { entities: ENTITIES, cause }), "Xe ô tô (có camera hành trình) tiếp tục di chuyển, rời đi.");
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), bystanders: o("bystanders.helped") },
    { entities: ENTITIES, cause: { event_type: o("event_type.collision"), subject: o("subject.unclear"), conflict_type: o("conflict_type.unclear") } }),
  "Không thể xác định.");
});

test("R without a C answer cannot be composed", () => {
  assert.throws(() => compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), bystanders: o("bystanders.helped") },
    { entities: ENTITIES }), { code: "cause_missing" });
});
