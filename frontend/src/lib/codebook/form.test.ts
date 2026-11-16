// Run with: node --test src/lib/codebook/form.test.ts (Node 24 runs TypeScript directly).
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntityCells, buildSlots, causePair, choose, defaultState, emptyState, entityCells, entityLabel, entityProblems,
  errorText, fields, nextEntityKey, preview, problems, stateFromSlots, type FormContext, type FormState,
} from "./form.ts";

const entity = (key: string, cells: Record<string, string>) => ({
  key, cells: Object.fromEntries(Object.entries(cells).map(([cell, option]) => [cell, { option }])),
});
const TWO: FormContext = { entities: [
  entity("A", { type: "type.car", dashcam: "dashcam.yes" }),
  entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" }),
] };
const THREE: FormContext = { entities: [...TWO.entities, entity("C", { type: "type.pedestrian" })] };

/** Chooses values in order, each through the field the form shows for it. */
function fill(qgroup: string, context: FormContext, steps: [string, unknown][], start: FormState = emptyState()): FormState {
  return steps.reduce((state, [key, value]) => {
    const item = fields(qgroup, state, context).find((candidate) => candidate.key === key);
    assert.ok(item, `field ${key} is not shown`);
    return choose(qgroup, state, item, value as never, context);
  }, start);
}
const keys = (qgroup: string, state: FormState, context: FormContext) => fields(qgroup, state, context).map((item) => item.key);

test("S shows its six cells and builds a flat payload that composes", () => {
  const state = fill("S", TWO, [["outer.weather", { option: "weather.sunny" }], ["outer.light", { option: "light.day" }],
    ["outer.road_type", { option: "road_type.one_way" }], ["outer.surface", { option: "surface.dry" }],
    ["outer.density", { option: "density.sparse" }], ["outer.segment", { option: "segment.straight" }]]);
  const slots = buildSlots("S", state, TWO);
  assert.deepEqual(Object.keys(slots).sort(), ["density", "light", "road_type", "segment", "surface", "weather"]);
  assert.deepEqual(problems("S", state, TWO), {});
  assert.equal(preview("S", slots, TWO), "Trời nắng, ban ngày, một chiều tại thẳng, mặt đường khô, mật độ xe thưa.");
});

test("S names every missing required cell", () => {
  const found = problems("S", fill("S", TWO, [["outer.weather", { option: "weather.rain" }]]), TWO);
  assert.equal(Object.keys(found).length, 5);
  assert.equal(found["outer.light"], "Chưa chọn.");
});

test("C fills the other party as object when the video has two, and filters actions by conflict type", () => {
  const state = fill("C", TWO, [["outer.event_type", { option: "event_type.collision" }], ["outer.subject", { entity: "B" }],
    ["outer.conflict_type", { option: "conflict_type.k04" }]]);
  assert.deepEqual(state.cells.object, { entity: "A" });
  const action = fields("C", state, TWO).find((item) => item.key === "outer.action")!;
  assert.deepEqual(action.options.map((option) => option.id), ["action.k04.lane_change_left", "action.k04.lane_change_right"]);
  assert.ok(!keys("C", state, TWO).includes("outer.evader"), "evasion cells only for a near miss");
});

test("C drops an action of another conflict type instead of sending it", () => {
  let state = fill("C", TWO, [["outer.event_type", { option: "event_type.collision" }], ["outer.subject", { entity: "B" }],
    ["outer.conflict_type", { option: "conflict_type.k04" }], ["outer.action", { option: "action.k04.lane_change_left" }]]);
  state = fill("C", TWO, [["outer.conflict_type", { option: "conflict_type.k06" }]], state);
  assert.equal(buildSlots("C", state, TWO).action, undefined);
  assert.equal(problems("C", state, TWO)["outer.action"], "Chưa chọn.");
  // Back to the first type: the earlier choice is still there.
  state = fill("C", TWO, [["outer.conflict_type", { option: "conflict_type.k04" }]], state);
  assert.deepEqual(buildSlots("C", state, TWO).action, { option: "action.k04.lane_change_left" });
});

test("C takes the only action of a conflict type at once, and none under an unclear type", () => {
  const state = fill("C", TWO, [["outer.event_type", { option: "event_type.collision" }], ["outer.subject", { entity: "A" }],
    ["outer.conflict_type", { option: "conflict_type.k09" }]]);
  assert.deepEqual(state.cells.action, { option: "action.k09.wrong_way_straight" });
  const unclear = fill("C", TWO, [["outer.conflict_type", { option: "conflict_type.unclear" }]], state);
  assert.ok(!keys("C", unclear, TWO).includes("outer.action"));
  assert.equal(buildSlots("C", unclear, TWO).action, undefined);
});

test("C near miss shows evader, evasion and result; hit_other needs an entity", () => {
  const state = fill("C", THREE, [["outer.event_type", { option: "event_type.near_miss" }], ["outer.subject", { entity: "B" }],
    ["outer.object", { entity: "A" }], ["outer.conflict_type", { option: "conflict_type.k14" }],
    ["outer.action", { option: "action.k14.left_to_right" }], ["outer.evader", { entity: "A" }],
    ["outer.evasion", { option: "evasion.hard_brake" }], ["outer.evasion_result", { option: "evasion_result.hit_other" }]]);
  assert.equal(problems("C", state, THREE)["outer.evasion_result"], "Chọn bên.");
  const done = fill("C", THREE, [["outer.evasion_result", { option: "evasion_result.hit_other", entity: "C" }]], state);
  assert.deepEqual(problems("C", done, THREE), {});
  assert.deepEqual(buildSlots("C", done, THREE).evasion_result, { option: "evasion_result.hit_other", entity: "C" });
  assert.match(preview("C", buildSlots("C", done, THREE), THREE)!, /chạm vào người đi bộ\.$/);
});

test("C \"cả hai bên\" gives one action per party, fills the two parties and hides speed and evasion", () => {
  const state = fill("C", TWO, [["outer.event_type", { option: "event_type.near_miss" }], ["outer.subject", { option: "subject.both" }],
    ["outer.conflict_type", { option: "conflict_type.k11" }], ["0.action", { option: "action.k11.left_to_right" }],
    ["1.action", { option: "action.k11.right_to_left" }]]);
  assert.deepEqual(keys("C", state, TWO), ["outer.event_type", "outer.subject", "outer.conflict_type",
    "0.party", "0.action", "1.party", "1.action"]);
  assert.deepEqual(buildSlots("C", state, TWO), {
    event_type: { option: "event_type.near_miss" }, subject: { option: "subject.both" },
    conflict_type: { option: "conflict_type.k11" },
    parties: [{ party: { entity: "A" }, action: { option: "action.k11.left_to_right" } },
      { party: { entity: "B" }, action: { option: "action.k11.right_to_left" } }],
  });
  assert.deepEqual(problems("C", state, TWO), {});
});

test("C \"cả hai bên\" refuses the same entity twice", () => {
  const state = fill("C", THREE, [["outer.subject", { option: "subject.both" }], ["1.party", { entity: "A" }]]);
  assert.equal(problems("C", state, THREE)["1.party"], "Hai bên phải khác nhau.");
});

test("V asks for violator and behaviour only when there is a violation, with a short text for \"khác\"", () => {
  assert.deepEqual(keys("V", fill("V", TWO, [["outer.result", { option: "result.none_observed" }]]), TWO), ["outer.result"]);
  const state = fill("V", TWO, [["outer.result", { option: "result.yes" }], ["outer.violator", { entity: "B" }],
    ["outer.behavior", { option: "behavior.other", text: "  " }]]);
  assert.equal(problems("V", state, TWO)["outer.behavior"], "Ghi ngắn nội dung cho lựa chọn \"khác\".");
  const named = fill("V", TWO, [["outer.behavior", { option: "behavior.other", text: " chở hàng cồng kềnh " }]], state);
  assert.deepEqual(buildSlots("V", named, TWO).behavior, { option: "behavior.other", text: "chở hàng cồng kềnh" });
  assert.equal(problems("V", fill("V", TWO, [["outer.behavior", { option: "behavior.other", text: "x".repeat(201) }]], state), TWO)
    ["outer.behavior"], "Tối đa 200 ký tự.");
});

test("O filters signs by level, takes \"không có\" for no collision, and starts with the C pair", () => {
  const cause = { subject: { entity: "B" }, object: { entity: "A" }, event_type: { option: "event_type.collision" } };
  const context = { ...TWO, cause };
  const start = defaultState("O", context);
  assert.deepEqual(start.refs, ["B", "A"]);
  const minor = fill("O", context, [["outer.level", { option: "level.minor" }]], start);
  assert.deepEqual(fields("O", minor, context).find((item) => item.key === "outer.sign")!.options.map((option) => option.id),
    ["sign.scrape_stationary", "sign.scrape_continued"]);
  const none = fill("O", context, [["outer.level", { option: "level.none" }]], start);
  assert.deepEqual(none.cells.sign, { option: "sign.none" });
  assert.equal(buildSlots("O", none, context).parties, undefined);
  assert.equal(problems("O", none, context)["outer.level"], "Nhóm C là \"va chạm\" nên mức độ không được là \"không va chạm\".");
  const unclear = fill("O", context, [["outer.level", { option: "level.unclear" }]], start);
  assert.deepEqual(keys("O", unclear, context), ["outer.level"]);
  const done = fill("O", context, [["outer.sign", { option: "sign.scrape_continued" }]], minor);
  assert.deepEqual(buildSlots("O", done, context), { level: { option: "level.minor" }, sign: { option: "sign.scrape_continued" },
    parties: [{ entity: "B" }, { entity: "A" }] });
});

test("R shows subject and object named after C, no object without one, nothing more without aftermath", () => {
  const cause = { subject: { entity: "B" }, object: { entity: "A" } };
  const state = fill("R", { ...TWO, cause }, [["outer.has_aftermath", { option: "has_aftermath.yes" }]]);
  const shown = fields("R", state, { ...TWO, cause });
  assert.deepEqual(shown.map((item) => item.label), ["Clip có đoạn sau sự kiện", "Chủ thể (B)", "Đối tượng (A)", "Người, xe xung quanh"]);
  assert.deepEqual(keys("R", state, { ...TWO, cause: { subject: { entity: "B" } } }),
    ["outer.has_aftermath", "outer.subject", "outer.bystanders"]);
  const no = fill("R", TWO, [["outer.has_aftermath", { option: "has_aftermath.no" }]], state);
  assert.deepEqual(buildSlots("R", no, TWO), { has_aftermath: { option: "has_aftermath.no" } });
});

test("Prev: one party, both parties with their own actions, or unclear", () => {
  const one = fill("Prev", TWO, [["outer.party", { entity: "B" }], ["0.main_action", { option: "main_action.slow_down" }],
    ["0.extra_action", { option: "extra_action.slow_down" }]]);
  assert.equal(problems("Prev", one, TWO)["0.extra_action"], "Hành động thêm phải khác hành động chính.");
  assert.deepEqual(buildSlots("Prev", fill("Prev", TWO, [["0.extra_action", undefined]], one), TWO),
    { parties: [{ party: { entity: "B" }, main_action: { option: "main_action.slow_down" } }] });
  const both = fill("Prev", TWO, [["outer.party", { option: "party.both" }], ["1.main_action", { option: "main_action.other", text: "bấm còi" }]], one);
  assert.deepEqual(buildSlots("Prev", both, TWO).parties, [
    { party: { entity: "B" }, main_action: { option: "main_action.slow_down" }, extra_action: { option: "extra_action.slow_down" } },
    { party: { entity: "A" }, main_action: { option: "main_action.other", text: "bấm còi" } },
  ]);
  const unclear = fill("Prev", TWO, [["outer.party", { option: "party.unclear" }]], both);
  assert.deepEqual(keys("Prev", unclear, TWO), ["outer.party"]);
  assert.deepEqual(buildSlots("Prev", unclear, TWO), { parties: [{ party: { option: "party.unclear" } }] });
  assert.equal(preview("Prev", buildSlots("Prev", unclear, TWO), TWO), "Không thể xác định.");
});

test("stored slots load back into the same form", () => {
  const cases: [string, FormState, FormContext][] = [
    ["C", fill("C", TWO, [["outer.event_type", { option: "event_type.collision" }], ["outer.subject", { option: "subject.both" }],
      ["outer.conflict_type", { option: "conflict_type.k11" }], ["0.action", { option: "action.k11.left_to_right" }],
      ["1.action", { option: "action.k11.right_to_left" }]]), TWO],
    ["Prev", fill("Prev", TWO, [["outer.party", { entity: "A" }], ["0.main_action", { option: "main_action.slow_down" }]]), TWO],
    ["Prev", fill("Prev", TWO, [["outer.party", { option: "party.both" }], ["0.main_action", { option: "main_action.slow_down" }],
      ["1.main_action", { option: "main_action.signal" }]]), TWO],
    ["Prev", fill("Prev", TWO, [["outer.party", { option: "party.unclear" }]]), TWO],
    ["O", fill("O", TWO, [["outer.level", { option: "level.severe" }], ["outer.sign", { option: "sign.thrown" }],
      ["outer.parties", ["A"]]]), TWO],
  ];
  for (const [qgroup, state, context] of cases) {
    const slots = buildSlots(qgroup, state, context);
    assert.deepEqual(buildSlots(qgroup, stateFromSlots(qgroup, slots, context), context), slots, qgroup);
  }
});

test("C pair for R and O: entity subject and object, both parties in key order, nothing for unclear", () => {
  assert.deepEqual(causePair({ subject: { entity: "B" }, object: { entity: "A" } }), ["B", "A"]);
  assert.deepEqual(causePair({ subject: { option: "subject.both" }, parties: [{ party: { entity: "C" } }, { party: { entity: "A" } }] }), ["A", "C"]);
  assert.deepEqual(causePair({ subject: { option: "subject.unclear" } }), []);
  assert.deepEqual(causePair(null), []);
});

test("E shows each cell only when its codebook condition holds, and sends only those", () => {
  const ids = (cells: Record<string, string>) => entityCells(entity("A", cells).cells).map((cell) => cell.id);
  assert.deepEqual(ids({}), ["type"]);
  assert.deepEqual(ids({ type: "type.car" }), ["type", "dashcam", "vehicle_color"]);
  assert.deepEqual(ids({ type: "type.car", dashcam: "dashcam.yes" }), ["type", "dashcam"]);
  assert.deepEqual(ids({ type: "type.truck" }), ["type", "size", "vehicle_color"]);
  assert.deepEqual(ids({ type: "type.motorbike" }), ["type", "vehicle_color", "clothing_color", "riders"]);
  assert.deepEqual(ids({ type: "type.pedestrian" }), ["type", "clothing_color"]);
  assert.deepEqual(ids({ type: "type.animal" }), ["type"]);
  assert.deepEqual(buildEntityCells(entity("A", { type: "type.pedestrian", riders: "riders.two", clothing_color: "clothing_color.red" }).cells),
    { type: { option: "type.pedestrian" }, clothing_color: { option: "clothing_color.red" } });
});

test("E needs a type, and a short text for \"khác\"", () => {
  assert.deepEqual(entityProblems([entity("A", {})]), { "A.type": "Chưa chọn loại." });
  assert.deepEqual(entityProblems([{ key: "B", cells: { type: { option: "type.other", text: " " } } }]),
    { "B.type": "Ghi ngắn loại cho lựa chọn \"khác\"." });
  assert.deepEqual(entityProblems([{ key: "B", cells: { type: { option: "type.other", text: "xe lu" } } }]), {});
  assert.equal(nextEntityKey(["A", "C"]), "B");
  assert.equal(entityLabel(entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" })), "B · xe máy màu đỏ");
});

test("422 codes read in Vietnamese, naming the cell", () => {
  assert.deepEqual(errorText("C", "missing_cell", "Slot answer: cell action is required"),
    { message: "Chưa chọn ô \"Hành động\".", cellId: "action" });
  assert.deepEqual(errorText("C", "wrong_parent", "Slot answer: action.k01.accelerate does not belong under conflict_type.k04"),
    { message: "\"tăng tốc\" không thuộc lựa chọn ở ô cha; chọn lại ô \"Hành động\".", cellId: "action" });
  assert.equal(errorText("V", "text_too_long", "Slot answer: the text of behavior.other is longer than 200 characters").message,
    "Chữ ghi ở lựa chọn \"khác\" dài quá 200 ký tự.");
  // Route and compose messages are Vietnamese already and are kept.
  assert.equal(errorText("R", "cause_missing", "Lưu nhóm C trước khi lưu nhóm R.").message, "Lưu nhóm C trước khi lưu nhóm R.");
  assert.equal(errorText("C", "unknown_entity", "Slot answer: entity D is not declared in E").message,
    "Có bên chưa được khai báo ở nhóm E. Lưu nhóm E trước.");
  assert.match(errorText("S", "something_new", "Slot answer: whatever").message, /^Không lưu được \(something_new\)/);
});

test("stored slots compare equal whatever their key order", async () => {
  const { sameSlots } = await import("./form.ts");
  assert.ok(sameSlots({ b: { option: "x" }, a: [{ y: 1, x: 2 }] }, { a: [{ x: 2, y: 1 }], b: { option: "x" } }));
  assert.ok(!sameSlots({ a: { option: "x" } }, { a: { option: "y" } }));
  assert.ok(sameSlots(null, undefined));
});
