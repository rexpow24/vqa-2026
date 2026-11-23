// Run with: node --test src/lib/codebook/compose.test.ts (Node 24 runs TypeScript directly).
import assert from "node:assert/strict";
import test from "node:test";
import { compose, render } from "./compose.ts";

test("S.v1 fills the guideline template with the chosen labels", () => {
  assert.equal(compose("S", {
    weather: { option: "weather.sunny" }, light: { option: "light.day" }, road_type: { option: "road_type.one_way" },
    segment: { option: "segment.straight" }, surface: { option: "surface.dry" }, density: { option: "density.sparse" },
  }, { version: "S.v1" }), "Trời nắng, ban ngày, một chiều tại thẳng, mặt đường khô, mật độ xe thưa.");
});

const S2 = {
  weather: { option: "weather.no_rain" }, light: { option: "light.day" }, road_type: { option: "road_type.one_way" },
  segment: { option: "segment.straight" }, surface: { option: "surface.dry" }, density: { option: "density.sparse" },
  surface_material: { option: "surface_material.asphalt" },
};

test("S.v3 adds concrete while preserving the road sentence", () => {
  assert.equal(compose("S", S2), "Trời tạnh ráo, ban ngày, đường một chiều tại đoạn đường thẳng, mặt đường nhựa khô, mật độ xe thưa.");
  assert.equal(compose("S", { ...S2, surface_material: { option: "surface_material.concrete" } }),
    "Trời tạnh ráo, ban ngày, đường một chiều tại đoạn đường thẳng, mặt đường bê tông khô, mật độ xe thưa.");
});

test("S.v2 leaves out the parts that are unclear, and needs every cell", () => {
  assert.equal(compose("S", { ...S2, weather: { option: "weather.unclear" }, segment: { option: "segment.unclear" },
    surface_material: { option: "surface_material.unclear" } }), "Ban ngày, đường một chiều, mặt đường khô, mật độ xe thưa.");
  assert.equal(compose("S", { ...S2, surface_material: { option: "surface_material.dirt" }, surface: { option: "surface.unclear" } }),
    "Trời tạnh ráo, ban ngày, đường một chiều tại đoạn đường thẳng, mặt đường đất cát, mật độ xe thưa.");
  assert.throws(() => compose("S", { ...S2, weather: { option: "weather.overcast" } }), { code: "unknown_option" });
  const noMaterial = Object.fromEntries(Object.entries(S2).filter(([key]) => key !== "surface_material"));
  assert.throws(() => compose("S", noMaterial), { code: "missing_cell" });
});

test("render drops an optional part with an empty placeholder and a part whose placeholders are all empty", () => {
  assert.equal(render("{a} {b}( và {c}), {d} {e}, xong.", { a: "x", b: null, c: null, d: null, e: null }), "X, xong.");
  assert.equal(render("{a}( và {c}); {d}.", { a: "x", c: "y, z", d: "w" }), "X và y, z; w.");
  assert.equal(render("{a}, {b}.", {}), "Không thể xác định.");
});

const entity = (key: string, cells: Record<string, string>) => ({
  key, cells: Object.fromEntries(Object.entries(cells).map(([cell, option]) => [cell, { option }])),
});

test("E joins the entities in key order, lower-casing all but the first", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.car", dashcam: "dashcam.yes" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" }),
    entity("C", { type: "type.pedestrian", clothing_color: "clothing_color.white_gray_silver" }),
  ] }), "Xe ô tô (có camera hành trình), xe máy màu đỏ, người đi bộ.");
});

test("E.v4 phrases an ambulance with its colour and a bicycle without a colour", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.ambulance", vehicle_color: "vehicle_color.white_gray_silver" }),
    entity("B", { type: "type.bicycle" }),
  ] }), "Xe cứu thương màu trắng, xám/bạc, xe đạp.");
});

test("E without any declared entity cannot be determined", () => {
  assert.equal(compose("E", { entities: [] }), "Không thể xác định.");
});

test("E does not apply a colour to a car with a dashcam or to a bicycle", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.car", dashcam: "dashcam.yes", vehicle_color: "vehicle_color.red" }),
    entity("B", { type: "type.bicycle", vehicle_color: "vehicle_color.red" }),
  ] }), "Xe ô tô (có camera hành trình), xe đạp.");
});

test("E names trucks and buses by type and colour", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.truck", vehicle_color: "vehicle_color.blue_green" }),
    entity("B", { type: "type.bus", vehicle_color: "vehicle_color.white_gray_silver" }),
    entity("C", { type: "type.animal" }),
  ] }), "Xe tải màu xanh, xe khách màu trắng, xám/bạc, động vật.");
});

test("E omits colour for a bicycle", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.bicycle" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" }),
  ] }), "Xe đạp, xe máy màu đỏ.");
});

test("E adds the letter when two entities share type and colour", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.motorbike", vehicle_color: "vehicle_color.white_gray_silver" }),
    entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.white_gray_silver" }),
  ] }), "Xe máy màu trắng, xám/bạc A, xe máy màu trắng, xám/bạc B.");
});

const ENTITIES = [
  entity("A", { type: "type.car", dashcam: "dashcam.yes" }),
  entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" }),
  entity("C", { type: "type.pedestrian", clothing_color: "clothing_color.white_gray_silver" }),
];
const o = (option: string) => ({ option });
const e = (key: string) => ({ entity: key });

test("C names the parties by their E name and fills the collision pattern", () => {
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: e("B"), object: e("A"),
    conflict_type: o("conflict_type.k04"), action: o("action.k04.lane_change_left") },
  { entities: ENTITIES }),
  "Xe máy màu đỏ chuyển sang làn bên trái, đi vào đường đi của xe ô tô (có camera hành trình), dẫn đến va chạm.");
});

test("C.v1 near miss names who evaded, how, and the result", () => {
  assert.equal(compose("C", { event_type: o("event_type.near_miss"), subject: e("C"), object: e("A"),
    conflict_type: o("conflict_type.k15"), action: o("action.k15.left_to_right"),
    evader: e("A"), evasion: o("evasion.hard_brake"), evasion_result: { option: "evasion_result.hit_other", entity: "B" } },
  { entities: ENTITIES, version: "C.v1" }),
  "Người đi bộ từ trái sang phải, cắt ngang phía trước xe ô tô (có camera hành trình), "
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
    { entities: ENTITIES }), "Người đi bộ đi vào làn xe buýt.");
  assert.equal(compose("V", { result: o("result.none_observed") }, { version: "V.v9" }), "Không quan sát thấy vi phạm quy tắc giao thông rõ ràng.");
  assert.equal(compose("V", { result: o("result.unclear") }), "Không thể xác định.");
});

test("V.v3 composes multiple behaviour tags in codebook order", () => {
  assert.equal(compose("V", { result: o("result.yes"), violator: e("B"),
    behavior: { options: ["behavior.no_helmet", "behavior.wrong_lane"] } }, { entities: ENTITIES }),
  "Xe máy màu đỏ đi sai làn, lấn làn và không đội mũ bảo hiểm.");
  assert.equal(compose("V", { result: o("result.yes"), violator: o("violator.both"), parties: [
    { party: e("A"), behavior: { options: ["behavior.wrong_lane", "behavior.no_helmet"] } },
    { party: e("B"), behavior: { options: ["behavior.fail_to_yield"] } },
  ] }, { entities: ENTITIES, version: "V.v3" }),
  "Xe ô tô (có camera hành trình) đi sai làn, lấn làn và không đội mũ bảo hiểm, đồng thời xe máy màu đỏ không nhường đường.");
});

test("V.v6 composes an unidentified keeper beside a vehicle without widening older V or C", () => {
  const slots = { result: o("result.yes"), violator: o("violator.both"), parties: [
    { party: o("violator.unidentified"), behavior: { options: ["behavior.other"], text: "để vật nuôi đi rông" } },
    { party: e("A"), behavior: { options: ["behavior.wrong_lane"] } },
  ] };
  const sentence = compose("V", slots, { version: "V.v6", entities: ENTITIES });
  assert.match(sentence, /chủ\/người quản lý vật nuôi chưa xác định để vật nuôi đi rông/);
  assert.equal(compose("V", { ...slots, parties: [...slots.parties].reverse() }, { version: "V.v6", entities: ENTITIES }), sentence);
  assert.throws(() => compose("V", slots, { version: "V.v5", entities: ENTITIES }), { code: "parties" });
  assert.throws(() => compose("V", { ...slots, parties: [slots.parties[0], slots.parties[0]] },
    { version: "V.v6", entities: ENTITIES }), { code: "parties" });
  assert.throws(() => compose("C", { event_type: o("event_type.collision"), subject: o("subject.both"),
    conflict_type: o("conflict_type.k11"), parties: [
      { party: e("A"), action: o("action.k11.left_to_right") },
      { party: o("violator.unidentified"), action: o("action.k11.right_to_left") },
    ] }, { entities: ENTITIES }), { code: "parties" });
});

test("O.v1 names both parties, one party, or uses the fixed sentences", () => {
  const v1 = { version: "O.v1", entities: ENTITIES };
  assert.equal(compose("O", { parties: [e("B"), e("A")], level: o("level.minor"), sign: o("sign.scrape_continued") },
    v1), "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm nhẹ, chạm quẹt, vẫn đi tiếp.");
  assert.equal(compose("O", { parties: [e("B")], level: o("level.severe"), sign: o("sign.overturned") },
    v1), "Xe máy màu đỏ bị lật.");
  assert.equal(compose("O", { level: o("level.none"), sign: o("sign.none") }, v1), "Không quan sát thấy va chạm hoặc hư hỏng phương tiện.");
  assert.equal(compose("O", { level: o("level.unclear") }, v1), "Không thể xác định.");
});

test("O.v2 lists the chosen level and the visible signs of that level, with a fixed sentence for none", () => {
  const signs = (...ids: string[]) => ({ options: ids });
  assert.equal(compose("O", { parties: [e("B"), e("A")], level: o("level.severe"),
    signs: signs("sign.person_thrown", "sign.overturned") }, { entities: ENTITIES }),
  "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm mạnh, bị lật, người bị hất văng khỏi xe.");
  assert.equal(compose("O", { parties: [e("B")], level: o("level.moderate"), signs: signs("sign.person_fell", "sign.vehicle_fell") },
    { entities: ENTITIES }), "Xe máy màu đỏ: xe đổ tại chỗ, người ngã tại chỗ.");
  // One party is followed by a colon, without the level: the O.v2 sign labels are noun
  // phrases ("người ngã tại chỗ"), so "[Chủ thể] [2]" read "Xe máy màu đỏ người ngã tại chỗ."
  assert.equal(compose("O", { parties: [e("B")], level: o("level.moderate"), signs: signs("sign.person_fell") },
    { entities: ENTITIES }), "Xe máy màu đỏ: người ngã tại chỗ.");
  // the merged "xe hoặc người ngã tại chỗ" was split in two
  assert.throws(() => compose("O", { level: o("level.moderate"), signs: signs("sign.fell_in_place") }), { code: "unknown_option" });
  // features/o-signs-max-grouped: the level is the highest level of the signs, so a moderate
  // and a severe sign together read as severe, and a level below its highest sign is refused.
  assert.equal(compose("O", { parties: [e("B"), e("A")], level: o("level.severe"),
    signs: signs("sign.person_thrown", "sign.vehicle_fell") }, { entities: ENTITIES }),
  "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm mạnh, xe đổ tại chỗ, người bị hất văng khỏi xe.");
  assert.throws(() => compose("O", { level: o("level.moderate"), signs: signs("sign.vehicle_fell", "sign.person_thrown") }),
    { code: "level_mismatch" });
  assert.throws(() => compose("O", { level: o("level.severe"), signs: signs("sign.vehicle_fell") }), { code: "level_mismatch" });
  // the secondary collision sign was removed from the severe level
  assert.throws(() => compose("O", { level: o("level.severe"), signs: signs("sign.secondary_collision") }), { code: "unknown_option" });
  // features/o-v2-sign-revision: the car body-damage sign is moderate and lists after the spin sign.
  assert.equal(compose("O", { parties: [e("B"), e("A")], level: o("level.moderate"),
    signs: signs("sign.visible_body_damage", "sign.spun_or_lost_control") }, { entities: ENTITIES }),
  "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm vừa, xoay ngang mất lái, có hư hỏng nhìn thấy được ở thân xe (ô tô).");
  assert.equal(compose("O", { parties: [e("B"), e("A")], level: o("level.severe"), signs: signs("sign.major_deformation") },
    { entities: ENTITIES }),
  "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm mạnh, biến dạng nghiêm trọng, cấu trúc xe bị phá vỡ rõ rệt.");
  assert.equal(compose("O", { level: o("level.none") }), "Không quan sát thấy va chạm hoặc hư hỏng phương tiện.");
  // "không đánh giá" was merged into "không va chạm".
  assert.throws(() => compose("O", { level: o("level.not_assessed") }), { code: "unknown_option" });
  assert.throws(() => compose("O", { level: o("level.unclear") }), { code: "unknown_option" });
  assert.throws(() => compose("O", { level: o("level.minor"), signs: signs("sign.overturned") }), { code: "level_mismatch" });
  assert.throws(() => compose("O", { level: o("level.severe") }), { code: "missing_cell" });
  assert.throws(() => compose("O", { level: o("level.none"), signs: signs("sign.person_fell") }), { code: "level_mismatch" });
  assert.throws(() => compose("O", { level: o("level.severe"), signs: signs("sign.contact_balanced", "sign.overturned") }),
    { code: "exclusive_sign" });
});

test("Prev gives one clause per party in key order", () => {
  assert.equal(compose("Prev", { parties: [{ party: e("B"), main_action: o("main_action.observe_and_yield") }] },
    { entities: ENTITIES }), "Xe máy màu đỏ nên quan sát và nhường đường.");
  assert.equal(compose("Prev", { parties: [
    { party: e("B"), main_action: o("main_action.slow_down") },
    { party: e("A"), main_action: { option: "main_action.other", text: "bấm còi cảnh báo" } },
  ] }, { entities: ENTITIES }),
  "Xe ô tô (có camera hành trình) nên bấm còi cảnh báo; xe máy màu đỏ nên giảm tốc.");
});

test("Prev does not repeat \"và\" when an action already holds one", () => {
  assert.equal(compose("Prev", { parties: [{ party: e("B"), main_action: o("main_action.slow_down") }] }, { entities: ENTITIES }),
  "Xe máy màu đỏ nên giảm tốc.");
});

test("Prev with an unclear party cannot be determined", () => {
  assert.equal(compose("Prev", { parties: [{ party: o("party.unclear") }] }, { entities: ENTITIES }), "Không thể xác định từ tình huống C.");
});

test("C with both parties uses the \"Cả A và B\" pattern, parties in key order", () => {
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
    parties: [{ party: e("B"), action: o("action.k11.right_to_left") }, { party: e("A"), action: o("action.k11.left_to_right") }] },
  { entities: ENTITIES }),
  "Xe ô tô (có camera hành trình) từ trái sang phải, đồng thời xe máy màu đỏ từ phải sang trái, "
  + "đi vào đường đi của nhau, dẫn đến va chạm.");
  assert.equal(compose("C", { event_type: o("event_type.near_miss"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
    parties: [{ party: e("A"), action: o("action.k11.left_to_right") }, { party: e("C"), action: o("action.k11.right_to_left") }] },
  { entities: ENTITIES, version: "C.v1" }).endsWith(", đi vào đường đi của nhau, dẫn đến suýt va chạm."), true);
  assert.equal(compose("C", { event_type: o("event_type.near_miss"), subject: o("subject.both"), conflict_type: o("conflict_type.k11"),
    parties: [{ party: e("A"), action: o("action.k11.left_to_right") }, { party: e("C"), action: o("action.k11.right_to_left") }] },
  { entities: ENTITIES }).endsWith(", đi vào đường đi của nhau, suýt xảy ra va chạm."), true);
});

test("C.v2 near miss has no evasion part, and \"tốc độ cao\" reads as a phrase", () => {
  assert.equal(compose("C", { event_type: o("event_type.near_miss"), subject: e("C"), object: e("A"),
    conflict_type: o("conflict_type.k15"), action: o("action.k15.left_to_right") }, { entities: ENTITIES, version: "C.v2" }),
  "Người đi bộ từ trái sang phải, cắt ngang phía trước xe ô tô (có camera hành trình), suýt xảy ra va chạm.");
  assert.equal(compose("C", { event_type: o("event_type.collision"), subject: e("A"), object: e("B"),
    conflict_type: o("conflict_type.k08"), action: o("action.k08.encroach_overtaking"), speed: o("speed.high") }, { entities: ENTITIES, version: "C.v2" }),
  "Xe ô tô (có camera hành trình) lấn khi vượt và chạy tốc độ cao, đi đối đầu với xe máy màu đỏ, dẫn đến va chạm.");
  assert.equal(compose("C", { event_type: o("event_type.unclear"), subject: e("B"), conflict_type: o("conflict_type.k18"),
    action: o("action.k18.skid") }, { entities: ENTITIES, version: "C.v3" }), "Xe máy màu đỏ trượt.");
});

test("V.v2 \"cả hai bên\": one behaviour per party, one sentence when both did the same", () => {
  const both = (a: string, b: string) => ({ result: o("result.yes"), violator: o("violator.both"),
    parties: [{ party: e("B"), behavior: o(b) }, { party: e("A"), behavior: o(a) }] });
  assert.equal(compose("V", both("behavior.wrong_lane", "behavior.no_slowdown_intersection"), { entities: ENTITIES, version: "V.v2" }),
    "Xe ô tô (có camera hành trình) đi sai làn, lấn làn, đồng thời xe máy màu đỏ không giảm tốc độ qua giao lộ.");
  assert.equal(compose("V", both("behavior.fail_to_yield", "behavior.fail_to_yield"), { entities: ENTITIES, version: "V.v2" }),
    "Cả xe ô tô (có camera hành trình) và xe máy màu đỏ cùng không nhường đường.");
  assert.throws(() => compose("V", { result: o("result.yes"), violator: o("violator.both"),
    parties: [{ party: e("A"), behavior: o("behavior.wrong_lane") }] }, { entities: ENTITIES, version: "V.v2" }), { code: "parties" });
});

test("Attr names one or two parties in key order, or cannot be determined", () => {
  assert.equal(compose("Attr", { parties: [e("B")] }, { entities: ENTITIES }), "Xe máy màu đỏ.");
  assert.equal(compose("Attr", { parties: [e("B"), e("A")] }, { entities: ENTITIES }),
    "Cả xe ô tô (có camera hành trình) và xe máy màu đỏ.");
  assert.equal(compose("Attr", { parties: o("parties.unclear") }, { entities: ENTITIES }), "Không thể xác định.");
  assert.throws(() => compose("Attr", { parties: [e("A"), e("A")] }, { entities: ENTITIES }), { code: "parties" });
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
  "Xe máy màu đỏ dừng lại, người đi bộ tiếp tục di chuyển, rời đi, người và xe xung quanh dừng lại hoặc đến hỗ trợ.");
});

test("R uses the guideline's short forms", () => {
  const cause = C_BOTH_BA;
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.no") }, { entities: ENTITIES, cause }), "Không thể xác định.");
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), object: o("object.stopped"),
    bystanders: o("bystanders.helped") }, { entities: ENTITIES, cause }), "Các bên dừng lại.");
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.left"), object: o("object.unclear"),
    bystanders: o("bystanders.unclear") }, { entities: ENTITIES, cause }), "Xe ô tô (có camera hành trình) tiếp tục di chuyển, rời đi.");
  assert.equal(compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), bystanders: o("bystanders.helped") },
    { entities: ENTITIES, cause: { event_type: o("event_type.collision"), subject: o("subject.unclear"), conflict_type: o("conflict_type.unclear") } }),
  "Không thể xác định.");
});

test("R without a C answer cannot be composed", () => {
  assert.throws(() => compose("R", { has_aftermath: o("has_aftermath.yes"), subject: o("subject.stopped"), bystanders: o("bystanders.helped") },
    { entities: ENTITIES }), { code: "cause_missing" });
});

test("E.v6 names a pedestrian without clothing colour; same-type parties get their letter", () => {
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.motorbike" }), entity("B", { type: "type.motorbike" }),
  ] }), "Xe máy A, xe máy B.");
  assert.equal(compose("E", { entities: [
    entity("A", { type: "type.car", dashcam: "dashcam.yes" }), entity("B", { type: "type.pedestrian" }),
  ] }), "Xe ô tô (có camera hành trình), người đi bộ.");
});

test("E.v6 keeps a stored E.v5 vehicle colour and leaves out the clothing colour it no longer asks", () => {
  const legacy = [
    entity("A", { type: "type.truck", vehicle_color: "vehicle_color.blue_green" }),
    entity("B", { type: "type.pedestrian", clothing_color: "clothing_color.red" }),
  ];
  assert.equal(compose("E", { entities: legacy }), "Xe tải màu xanh, người đi bộ.");
});
