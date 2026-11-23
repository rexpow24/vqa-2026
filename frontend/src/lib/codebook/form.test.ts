// Run with: node --test src/lib/codebook/form.test.ts (Node 24 runs TypeScript directly).
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntityCells, buildSlots, causePair, choose, defaultState, emptyState, entityCells, entityLabel, entityLimit, entityProblems,
  errorText, fields, nextEntityKey, prefilledKeys, prefillFromCause, preview, problems, staleChoices, stateFromSlots,
  outcomeState, type FormContext, type FormState,
} from "./form.ts";
import { deriveOutcome, outcomeNeedsAnnotator } from "./derivation.ts";
import { currentVersion, getCodebook } from "./index.ts";
import { GROUP_CODES } from "../qgroups.ts";

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
const O_COLLISION: FormContext = { ...TWO, cause: { subject: { entity: "B" }, object: { entity: "A" },
  event_type: { option: "event_type.collision" } } };
const keys = (qgroup: string, state: FormState, context: FormContext) => fields(qgroup, state, context).map((item) => item.key);

test("S shows its seven cells (S.v2) and builds a flat payload that composes", () => {
  const state = fill("S", TWO, [["outer.weather", { option: "weather.sunny" }], ["outer.light", { option: "light.day" }],
    ["outer.road_type", { option: "road_type.one_way" }], ["outer.surface", { option: "surface.dry" }],
    ["outer.density", { option: "density.sparse" }], ["outer.segment", { option: "segment.straight" }],
    ["outer.surface_material", { option: "surface_material.asphalt" }]]);
  const slots = buildSlots("S", state, TWO);
  assert.deepEqual(Object.keys(slots).sort(), ["density", "light", "road_type", "segment", "surface", "surface_material", "weather"]);
  assert.deepEqual(problems("S", state, TWO), {});
  assert.equal(preview("S", slots, TWO), "Trời nắng, ban ngày, đường một chiều tại đoạn đường thẳng, mặt đường nhựa khô, mật độ xe thưa.");
  const weather = fields("S", state, TWO).find((item) => item.key === "outer.weather")!;
  assert.ok(weather.options.some((option) => option.label === "tạnh ráo") && !weather.options.some((option) => option.label === "âm u"));
});

test("current rule codebooks add concrete, drop unclear C event, and retain C object", () => {
  assert.deepEqual([currentVersion("S"), currentVersion("E"), currentVersion("C"), currentVersion("V")],
    ["S.v3", "E.v6", "C.v4", "V.v9"]);
  const scene = getCodebook("S.v3")!;
  assert.ok(scene.cells.find((cell) => cell.id === "surface_material")!.options!.some((option) => option.label === "bê tông"));
  const cause = getCodebook("C.v4")!;
  assert.ok(cause.cells.find((cell) => cell.id === "event_type")!.options!.every((option) => option.id !== "event_type.unclear"));
  assert.ok(cause.cells.some((cell) => cell.id === "object"));
  assert.equal(cause.cells.find((cell) => cell.id === "conflict_type")!.options!.find((option) => option.id === "conflict_type.k14")!.label,
    "Băng ngang đường giữa đoạn, không ở giao lộ");
});

test("V is absent from new work and Prev.v4 is inferred from C", () => {
  assert.deepEqual(GROUP_CODES, ["S", "E", "N", "C", "O", "R", "Attr", "Prev"]);
  assert.equal(currentVersion("Prev"), "Prev.v4");
  const book = getCodebook("Prev.v4")!;
  assert.equal(book.inferred_from, "C");
  assert.ok(!book.cells.some((cell) => cell.id === "extra_action"));
  assert.ok(!book.cells.find((cell) => cell.id === "main_action")!.options!.some((option) => option.id === "main_action.wear_helmet"));
});

test("Prev derives one safe-distance action from a K01 scenario", () => {
  const context: FormContext = { ...TWO, cause: {
    subject: { entity: "B" }, object: { entity: "A" },
    conflict_type: { option: "conflict_type.k01" }, action: { option: "action.k01.no_slowdown" },
  } };
  const state = prefillFromCause("Prev", context)!;
  assert.deepEqual(buildSlots("Prev", state, context), { parties: [
    { party: { entity: "B" }, main_action: { option: "main_action.keep_distance" } },
  ] });
  assert.equal(preview("Prev", buildSlots("Prev", state, context), context), "Xe máy màu đỏ nên giữ khoảng cách an toàn.");
});

test("Prev abstains for K18 and never infers a violation or blame", () => {
  const context: FormContext = { ...TWO, cause: {
    subject: { entity: "B" }, conflict_type: { option: "conflict_type.k18" },
    action: { option: "action.k18.tire_blowout" },
  } };
  const state = prefillFromCause("Prev", context)!;
  assert.deepEqual(buildSlots("Prev", state, context), { parties: [{ party: { option: "party.unclear" } }] });
  assert.equal(preview("Prev", buildSlots("Prev", state, context), context), "Không thể xác định từ tình huống C.");
});

test("Prev uses the road user's role in K14: a pedestrian stops and looks, a crossing vehicle observes and yields", () => {
  const crossingPedestrian: FormContext = { entities: [
    entity("A", { type: "type.car", dashcam: "dashcam.yes" }),
    entity("B", { type: "type.pedestrian" }),
  ], cause: {
    subject: { entity: "A" }, object: { entity: "B" },
    conflict_type: { option: "conflict_type.k14" }, action: { option: "action.k14.left_to_right" },
  } };
  const state = prefillFromCause("Prev", crossingPedestrian)!;
  assert.deepEqual(buildSlots("Prev", state, crossingPedestrian), { parties: [
    { party: { entity: "A" }, main_action: { option: "main_action.slow_down" } },
  ] });

  // Prev guideline, K14 "phương tiện: quan sát và nhường đường": a motorbike crossing mid-block in front of a car.
  const crossingVehicle: FormContext = { entities: TWO.entities, cause: {
    subject: { entity: "B" }, object: { entity: "A" },
    conflict_type: { option: "conflict_type.k14" }, action: { option: "action.k14.left_to_right" },
  } };
  const vehicle = prefillFromCause("Prev", crossingVehicle)!;
  assert.deepEqual(buildSlots("Prev", vehicle, crossingVehicle), { parties: [
    { party: { entity: "B" }, main_action: { option: "main_action.observe_and_yield" } },
  ] });
  assert.equal(preview("Prev", buildSlots("Prev", vehicle, crossingVehicle), crossingVehicle), "Xe máy màu đỏ nên quan sát và nhường đường.");

  const crossingPedestrianSubject: FormContext = { entities: crossingPedestrian.entities, cause: {
    subject: { entity: "B" }, object: { entity: "A" },
    conflict_type: { option: "conflict_type.k14" }, action: { option: "action.k14.left_to_right" },
  } };
  assert.deepEqual(buildSlots("Prev", prefillFromCause("Prev", crossingPedestrianSubject)!, crossingPedestrianSubject), { parties: [
    { party: { entity: "B" }, main_action: { option: "main_action.stop_and_look" } },
  ] });

  // no Prev for an animal
  const animal: FormContext = { entities: [entity("A", { type: "type.car", dashcam: "dashcam.yes" }), entity("B", { type: "type.animal" })],
    cause: { subject: { entity: "B" }, object: { entity: "A" },
      conflict_type: { option: "conflict_type.k14" }, action: { option: "action.k14.left_to_right" } } };
  assert.deepEqual(buildSlots("Prev", prefillFromCause("Prev", animal)!, animal), { parties: [{ party: { option: "party.unclear" } }] });
});

test("S names every missing required cell", () => {
  const found = problems("S", fill("S", TWO, [["outer.weather", { option: "weather.rain" }]]), TWO);
  assert.equal(Object.keys(found).length, 6);
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

test("C takes the only action of a conflict type at once and no longer offers unclear event", () => {
  const state = fill("C", TWO, [["outer.event_type", { option: "event_type.collision" }], ["outer.subject", { entity: "A" }],
    ["outer.conflict_type", { option: "conflict_type.k09" }]]);
  assert.deepEqual(state.cells.action, { option: "action.k09.wrong_way_straight" });
  assert.ok(!fields("C", state, TWO).find((item) => item.key === "outer.event_type")!.options.some((option) => option.id === "event_type.unclear"));
});

test("Current C near miss keeps the object, omits removed speed, and drops legacy evasion cells", () => {
  const state = fill("C", THREE, [["outer.event_type", { option: "event_type.near_miss" }], ["outer.subject", { entity: "B" }],
    ["outer.object", { entity: "A" }], ["outer.conflict_type", { option: "conflict_type.k14" }],
    ["outer.action", { option: "action.k14.left_to_right" }]]);
  assert.deepEqual(keys("C", state, THREE), ["outer.event_type", "outer.subject", "outer.object", "outer.conflict_type",
    "outer.action"]);
  assert.deepEqual(problems("C", state, THREE), {});
  assert.match(preview("C", buildSlots("C", state, THREE), THREE)!, /suýt xảy ra va chạm\.$/);
  const old = stateFromSlots("C", { ...buildSlots("C", state, THREE), speed: { option: "speed.high" },
    evader: { entity: "A" }, evasion: { option: "evasion.hard_brake" } }, THREE);
  assert.equal(buildSlots("C", old, THREE).speed, undefined);
  assert.equal(buildSlots("C", old, THREE).evader, undefined);
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
  assert.deepEqual(keys("V", fill("V", TWO, [["outer.result", { option: "result.none_observed" }]]), TWO),
    ["outer.result", "outer.additional_violator"]);
  const state = fill("V", TWO, [["outer.result", { option: "result.yes" }], ["outer.violator", { entity: "B" }],
    ["outer.behavior", { option: "behavior.other", text: "  " }]]);
  assert.equal(problems("V", state, TWO)["outer.behavior"], "Ghi ngắn nội dung cho lựa chọn \"khác\".");
  const named = fill("V", TWO, [["outer.behavior", { option: "behavior.other", text: " chở hàng cồng kềnh " }]], state);
  assert.deepEqual(buildSlots("V", named, TWO).behavior, { options: ["behavior.other"], text: "chở hàng cồng kềnh" });
  assert.equal(problems("V", fill("V", TWO, [["outer.behavior", { option: "behavior.other", text: "x".repeat(201) }]], state), TWO)
    ["outer.behavior"], "Tối đa 200 ký tự.");
});

test("O.v2 on a collision asks the level first, then only the signs of that level (features/o-level-first)", () => {
  const cause = { subject: { entity: "B" }, object: { entity: "A" }, event_type: { option: "event_type.collision" } };
  const context = { ...TWO, cause };
  const start = defaultState("O", context);
  assert.deepEqual(start.refs, ["B", "A"]);
  assert.deepEqual(keys("O", start, context), ["outer.level", "outer.parties"]);
  const level = fields("O", start, context).find((item) => item.key === "outer.level")!;
  assert.ok(!level.readOnly);
  assert.deepEqual(level.options.map((item) => item.id), ["level.minor", "level.moderate", "level.severe"]);
  assert.equal(problems("O", start, context)["outer.level"], "Chưa chọn.");
  const moderate = fill("O", context, [["outer.level", { option: "level.moderate" }]], start);
  assert.deepEqual(keys("O", moderate, context), ["outer.level", "outer.signs", "outer.parties"]);
  assert.deepEqual(outcomeState(moderate, context).cells.level, { option: "level.moderate" });
  const signsOf = (state: FormState) => fields("O", state, context).find((item) => item.key === "outer.signs")!.options.map((item) => item.id);
  assert.deepEqual(signsOf(moderate), ["sign.vehicle_fell", "sign.person_fell", "sign.spun_or_lost_control", "sign.visible_body_damage"]);
  assert.equal(problems("O", moderate, context)["outer.signs"], "Chưa chọn.");
  const damaged = fill("O", context, [["outer.signs", { options: ["sign.visible_body_damage", "sign.person_fell", "sign.vehicle_fell"] }]], moderate);
  assert.deepEqual(buildSlots("O", damaged, context), { level: { option: "level.moderate" },
    signs: { options: ["sign.vehicle_fell", "sign.person_fell", "sign.visible_body_damage"] }, parties: [{ entity: "B" }, { entity: "A" }] });
  assert.deepEqual(problems("O", damaged, context), {});
  assert.equal(preview("O", buildSlots("O", damaged, context), context),
    "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm vừa, xe đổ tại chỗ, người ngã tại chỗ, có hư hỏng nhìn thấy được ở thân xe (ô tô).");
  // A new level drops the signs of the old one; severe no longer offers "va chạm thứ cấp".
  const severe = fill("O", context, [["outer.level", { option: "level.severe" }]], damaged);
  assert.equal(severe.cells.signs, undefined);
  assert.deepEqual(signsOf(severe), ["sign.overturned", "sign.person_thrown", "sign.vehicle_thrown", "sign.major_deformation"]);
  assert.equal(problems("O", severe, context)["outer.signs"], "Chưa chọn.");
  // "va chạm nhẹ" has one sign, which is ticked at once.
  const minor = fill("O", context, [["outer.level", { option: "level.minor" }]], damaged);
  assert.deepEqual(buildSlots("O", minor, context), { level: { option: "level.minor" },
    signs: { options: ["sign.contact_balanced"] }, parties: [{ entity: "B" }, { entity: "A" }] });

  const nearMiss = { ...TWO, cause: { ...cause, event_type: { option: "event_type.near_miss" } } };
  assert.deepEqual(keys("O", defaultState("O", nearMiss), nearMiss), ["outer.level"]);
  assert.equal(fields("O", defaultState("O", nearMiss), nearMiss)[0].readOnly, true);
  assert.deepEqual(outcomeState(defaultState("O", nearMiss), nearMiss).cells.level, { option: "level.none" });
  assert.deepEqual(buildSlots("O", damaged, nearMiss), { level: { option: "level.none" } });
  assert.deepEqual(problems("O", damaged, nearMiss), {});
  const legacyUnclear = { ...TWO, cause: { ...cause, event_type: { option: "event_type.unclear" } } };
  // features/o-v2-sign-revision: "không đánh giá" was merged into "không va chạm".
  assert.deepEqual(buildSlots("O", start, legacyUnclear), { level: { option: "level.none" } });
  assert.deepEqual(keys("O", defaultState("O", legacyUnclear), legacyUnclear), ["outer.level"]);
  const noCause = { ...TWO, cause: null };
  assert.deepEqual(keys("O", emptyState(), noCause), ["outer.level"]);
  assert.equal(problems("O", emptyState(), noCause)["outer.level"], "Lưu nhóm C trước để hệ thống suy ra mức độ.");
  assert.ok(!getCodebook(currentVersion("O")!)!.cells.find((cell) => cell.id === "level")!.options!
    .some((option) => option.id === "level.unclear"));
});

test("deriveOutcome reads C: near miss and legacy unclear are none; a collision keeps the chosen level and only its signs", () => {
  const cause = { subject: { entity: "B" }, object: { entity: "A" }, event_type: { option: "event_type.collision" } };
  assert.equal(deriveOutcome(null, null), null);
  assert.deepEqual(deriveOutcome({ ...cause, event_type: { option: "event_type.near_miss" } }, { signs: { options: ["sign.overturned"] } }),
    { level: { option: "level.none" } });
  assert.deepEqual(deriveOutcome({ ...cause, event_type: { option: "event_type.unclear" } }, null), { level: { option: "level.none" } });
  assert.deepEqual(deriveOutcome(cause, { level: { option: "level.moderate" },
    signs: { options: ["sign.visible_body_damage", "sign.overturned", "sign.person_fell"] }, parties: [{ entity: "A" }] }),
  { level: { option: "level.moderate" }, signs: { options: ["sign.person_fell", "sign.visible_body_damage"] }, parties: [{ entity: "A" }] });
  // no level chosen, or "không va chạm" on a collision: no level yet, so the save is refused
  assert.deepEqual(deriveOutcome(cause, { signs: { options: ["sign.overturned"] } }), { parties: [{ entity: "B" }, { entity: "A" }] });
  assert.deepEqual(deriveOutcome(cause, { level: { option: "level.none" } }), { parties: [{ entity: "B" }, { entity: "A" }] });
  assert.deepEqual(deriveOutcome(cause, null), { parties: [{ entity: "B" }, { entity: "A" }] });
  // the removed secondary-collision sign is dropped
  assert.deepEqual(deriveOutcome(cause, { level: { option: "level.severe" }, signs: { options: ["sign.secondary_collision"] } }),
    { level: { option: "level.severe" }, parties: [{ entity: "B" }, { entity: "A" }] });
  assert.equal(outcomeNeedsAnnotator(cause), true);
  assert.equal(outcomeNeedsAnnotator({ ...cause, event_type: { option: "event_type.near_miss" } }), false);
});

test("O.v1 answers report the cells and choices O.v2 dropped", () => {
  const stale = staleChoices("O", "O.v1", { level: { option: "level.unclear" }, parties: [{ entity: "A" }] });
  assert.deepEqual(stale.cells, { level: "không rõ" });
  assert.deepEqual(staleChoices("O", "O.v1", { level: { option: "level.minor" }, sign: { option: "sign.scrape_stationary" } }).removed,
    ["Dấu hiệu nhìn thấy"]);
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

test("Prev.v4: one party, both parties with one action each, or unclear", () => {
  const one = fill("Prev", TWO, [["outer.party", { entity: "B" }], ["0.main_action", { option: "main_action.slow_down" }]]);
  assert.deepEqual(problems("Prev", one, TWO), {});
  assert.deepEqual(buildSlots("Prev", one, TWO),
    { parties: [{ party: { entity: "B" }, main_action: { option: "main_action.slow_down" } }] });
  const both = fill("Prev", TWO, [["outer.party", { option: "party.both" }], ["0.main_action", { option: "main_action.slow_down" }],
    ["1.main_action", { option: "main_action.other", text: "bấm còi" }]], one);
  assert.deepEqual(buildSlots("Prev", both, TWO).parties, [
    { party: { entity: "B" }, main_action: { option: "main_action.slow_down" } },
    { party: { entity: "A" }, main_action: { option: "main_action.other", text: "bấm còi" } },
  ]);
  assert.ok(!keys("Prev", both, TWO).some((key) => key.includes("extra_action")));
  const unclear = fill("Prev", TWO, [["outer.party", { option: "party.unclear" }]], both);
  assert.deepEqual(keys("Prev", unclear, TWO), ["outer.party"]);
  assert.deepEqual(buildSlots("Prev", unclear, TWO), { parties: [{ party: { option: "party.unclear" } }] });
  assert.equal(preview("Prev", buildSlots("Prev", unclear, TWO), TWO), "Không thể xác định từ tình huống C.");
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
    ["O", fill("O", O_COLLISION, [["outer.level", { option: "level.severe" }], ["outer.signs", { options: ["sign.person_thrown"] }],
      ["outer.parties", ["A"]]]), O_COLLISION],
  ];
  for (const [qgroup, state, context] of cases) {
    const slots = buildSlots(qgroup, state, context);
    assert.deepEqual(buildSlots(qgroup, stateFromSlots(qgroup, slots, context), context), slots, qgroup);
  }
});

test("V.v9 \"cả hai bên\" keeps multiple allowed behavior tags in each party", () => {
  const state = fill("V", TWO, [["outer.result", { option: "result.yes" }], ["outer.violator", { option: "violator.both" }],
    ["0.behavior", { options: ["behavior.wrong_lane", "behavior.no_helmet"] }],
    ["1.behavior", { option: "behavior.fail_to_yield" }]]);
  assert.deepEqual(keys("V", state, TWO), ["outer.result", "outer.violator", "0.party", "0.behavior", "1.party", "1.behavior",
    "outer.additional_violator"]);
  const slots = buildSlots("V", state, TWO);
  assert.deepEqual(slots, { result: { option: "result.yes" }, violator: { option: "violator.both" },
    parties: [{ party: { entity: "A" }, behavior: { options: ["behavior.wrong_lane", "behavior.no_helmet"] } },
      { party: { entity: "B" }, behavior: { options: ["behavior.fail_to_yield"] } }] });
  assert.deepEqual(problems("V", state, TWO), {});
  assert.deepEqual(buildSlots("V", stateFromSlots("V", slots, TWO), TWO), slots);
});

test("V keeps animals out of the violator party selectors", () => {
  const context = { entities: [TWO.entities[0], entity("B", { type: "type.animal" })] };
  const state = fill("V", context, [["outer.result", { option: "result.yes" }],
    ["outer.violator", { option: "violator.both" }]]);
  const selectors = fields("V", state, context).filter((item) => item.kind === "party");
  assert.deepEqual(selectors.map((item) => item.entities), [["A"], ["A"]]);
  assert.ok(selectors.every((item) => item.options.length === 0));
  assert.equal(state.parties[1].entity, undefined);
});

test("V never prefills an animal as a violator from C", () => {
  const entities = [TWO.entities[0], entity("B", { type: "type.animal" })];
  for (const cause of [{ subject: { entity: "B" }, conflict_type: { option: "conflict_type.k16" } },
    { subject: { option: "subject.both" }, parties: [{ party: { entity: "A" } }, { party: { entity: "B" } }] }]) {
    const state = prefillFromCause("V", { entities, cause });
    assert.deepEqual(buildSlots("V", state!, { entities }).violator, undefined);
    assert.deepEqual(buildSlots("V", state!, { entities }).result, { option: "result.unclear" });
  }
});

test("F-V: only the coded C wrong-way event derives V; other C cases remain unclear", () => {
  const one = prefillFromCause("V", { ...TWO, cause: { event_type: { option: "event_type.collision" }, subject: { entity: "B" },
    object: { entity: "A" }, conflict_type: { option: "conflict_type.k09" }, action: { option: "action.k09.wrong_way_straight" } } });
  assert.deepEqual(buildSlots("V", one!, TWO), { result: { option: "result.yes" }, violator: { entity: "B" },
    behavior: { options: ["behavior.wrong_way"] } });
  const both = prefillFromCause("V", { ...TWO, cause: { event_type: { option: "event_type.collision" },
    subject: { option: "subject.both" }, conflict_type: { option: "conflict_type.k11" },
    parties: [{ party: { entity: "B" }, action: { option: "action.k11.right_to_left" } },
      { party: { entity: "A" }, action: { option: "action.k11.left_to_right" } }] } });
  assert.deepEqual(buildSlots("V", both!, TWO), { result: { option: "result.unclear" } });
  const noRule = prefillFromCause("V", { ...TWO, cause: { subject: { entity: "A" }, conflict_type: { option: "conflict_type.k18" } } });
  assert.deepEqual(buildSlots("V", noRule!, TWO), { result: { option: "result.unclear" } });
  assert.deepEqual(buildSlots("V", prefillFromCause("V", { ...TWO, cause: { subject: { option: "subject.unclear" } } })!, TWO),
    { result: { option: "result.unclear" } });
  assert.deepEqual(buildSlots("V", prefillFromCause("V", TWO)!, TWO), { result: { option: "result.unclear" } });
  const changed = fill("V", TWO, [["outer.behavior", { option: "behavior.red_light" }]], one!);
  assert.deepEqual([...prefilledKeys("V", changed, one, TWO)], ["outer.result", "outer.violator"]);
});

test("Attr: one or two parties, or \"không rõ\", which exclude each other", () => {
  assert.equal(problems("Attr", emptyState(), TWO)["outer.parties"], "Chưa chọn.");
  const two = fill("Attr", TWO, [["outer.parties", ["B", "A"]]]);
  assert.deepEqual(buildSlots("Attr", two, TWO), { parties: [{ entity: "B" }, { entity: "A" }] });
  assert.equal(preview("Attr", buildSlots("Attr", two, TWO), TWO), "Cả xe ô tô (có camera hành trình) và xe máy màu đỏ.");
  const unclear = fill("Attr", TWO, [["outer.parties", { option: "parties.unclear" }]], two);
  assert.deepEqual(buildSlots("Attr", unclear, TWO), { parties: { option: "parties.unclear" } });
  assert.deepEqual(problems("Attr", unclear, TWO), {});
  for (const state of [two, unclear]) {
    const slots = buildSlots("Attr", state, TWO);
    assert.deepEqual(buildSlots("Attr", stateFromSlots("Attr", slots, TWO), TWO), slots);
  }
});

test("F-v1: an answer saved with v1 keeps what v2 still has and names what it lost", () => {
  const s1 = { weather: { option: "weather.overcast" }, light: { option: "light.day" }, road_type: { option: "road_type.one_way" },
    segment: { option: "segment.straight" }, surface: { option: "surface.dry" }, density: { option: "density.sparse" } };
  const state = stateFromSlots("S", s1, TWO);
  const slots = buildSlots("S", state, TWO);
  assert.equal(slots.weather, undefined);
  assert.equal(slots.light && (slots.light as { option: string }).option, "light.day");
  assert.deepEqual(staleChoices("S", "S.v1", s1), { cells: { weather: "âm u" }, removed: [] });
  assert.deepEqual(staleChoices("C", "C.v1", { event_type: { option: "event_type.near_miss" }, evader: { entity: "A" },
    evasion: { option: "evasion.hard_brake" } }), { cells: {}, removed: ["Bên né", "Cách né"] });
  const s2 = { ...s1, weather: { option: "weather.no_rain" } };
  assert.deepEqual(staleChoices("S", "S.v2", s2), { cells: {}, removed: [] });
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
  assert.deepEqual(ids({ type: "type.car" }), ["type", "dashcam"]);
  assert.deepEqual(ids({ type: "type.car", dashcam: "dashcam.yes" }), ["type", "dashcam"]);
  assert.deepEqual(ids({ type: "type.car", dashcam: "dashcam.no" }), ["type", "dashcam", "vehicle_color"]);
  assert.deepEqual(ids({ type: "type.truck" }), ["type", "vehicle_color"]);
  assert.deepEqual(ids({ type: "type.motorbike" }), ["type", "vehicle_color"]);
  // E.v6 asks no clothing colour
  assert.deepEqual(ids({ type: "type.pedestrian" }), ["type"]);
  assert.deepEqual(ids({ type: "type.animal" }), ["type"]);
  assert.deepEqual(ids({ type: "type.ambulance" }), ["type", "vehicle_color"]);
  assert.deepEqual(ids({ type: "type.bicycle" }), ["type"]);
  assert.deepEqual(buildEntityCells(entity("A", { type: "type.car", dashcam: "dashcam.yes", vehicle_color: "vehicle_color.red" }).cells),
    { type: { option: "type.car" }, dashcam: { option: "dashcam.yes" } });
  assert.deepEqual(buildEntityCells(entity("A", { type: "type.pedestrian", riders: "riders.two", clothing_color: "clothing_color.red" }).cells),
    { type: { option: "type.pedestrian" } });
});

test("E needs a type, and a short text for \"khác\"", () => {
  assert.deepEqual(entityProblems([entity("A", {})]), { "A.type": "Chưa chọn loại." });
  assert.deepEqual(entityProblems([{ key: "B", cells: { type: { option: "type.other", text: " " } } }]),
    { "B.type": "Ghi ngắn loại cho lựa chọn \"khác\".", "B.vehicle_color": "Bắt buộc chọn màu xe." });
  assert.deepEqual(entityProblems([{ key: "B", cells: { type: { option: "type.other", text: "xe lu" },
    vehicle_color: { option: "vehicle_color.yellow" } } }]), {});
  assert.equal(nextEntityKey(["A", "C"]), "B");
  assert.equal(entityLabel(entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" })), "B · xe máy màu đỏ");
});

test("E requires dashcam for cars and a vehicle colour only when its field applies", () => {
  assert.deepEqual(entityCells({ type: { option: "type.car" }, dashcam: { option: "dashcam.yes" } })
    .map((cell) => [cell.id, cell.required]), [["type", true], ["dashcam", true]]);
  assert.deepEqual(entityCells({ type: { option: "type.car" }, dashcam: { option: "dashcam.no" } })
    .map((cell) => [cell.id, cell.required]), [["type", true], ["dashcam", true], ["vehicle_color", true]]);
  assert.deepEqual(entityCells({ type: { option: "type.bicycle" } }).map((cell) => [cell.id, cell.required]), [["type", true]]);
  assert.deepEqual(entityCells({ type: { option: "type.truck" } }).map((cell) => [cell.id, cell.required]),
    [["type", true], ["vehicle_color", true]]);
  assert.deepEqual(entityProblems([entity("A", { type: "type.car" })]), {
    "A.dashcam": "Ô tô bắt buộc chọn có hoặc không có camera hành trình.",
  });
  assert.deepEqual(entityProblems([entity("A", { type: "type.car", dashcam: "dashcam.yes" })]), {});
  assert.deepEqual(entityProblems([entity("A", { type: "type.car", dashcam: "dashcam.no" })]), {
    "A.vehicle_color": "Bắt buộc chọn màu xe.",
  });
  assert.deepEqual(entityProblems([entity("A", { type: "type.bicycle" })]), {});
  assert.deepEqual(entityProblems([entity("A", { type: "type.motorbike" })]), {
    "A.vehicle_color": "Bắt buộc chọn màu xe.",
  });
});

test("E.v5 declares at most the two main parties (features/two-entity-subject-rules)", () => {
  const e5 = getCodebook("E.v5")!;
  assert.equal(e5.max_entities, 2);
  assert.deepEqual(e5.cells, getCodebook("E.v4")!.cells);
  assert.equal(entityLimit(), 2);
  assert.deepEqual(entityProblems(TWO.entities), {});
  assert.deepEqual(entityProblems([entity("A", { type: "type.bicycle" })]), {});
  assert.deepEqual(entityProblems(THREE.entities), { _list: "Chỉ khai báo 2 bên chính; xóa bớt 1 bên." });
});

test("C fills the object from the other party when E has the two main parties", () => {
  const state = fill("C", TWO, [["outer.subject", { entity: "B" }]]);
  assert.deepEqual(state.cells.object, { entity: "A" });
  const object = fields("C", state, TWO).find((item) => item.key === "outer.object")!;
  assert.deepEqual(object.entities, ["A"]);
});

test("V additional behavior is optional even after choosing an additional violator", () => {
  const state = fill("V", TWO, [["outer.result", { option: "result.yes" }], ["outer.violator", { entity: "B" }],
    ["outer.behavior", { option: "behavior.no_helmet" }], ["outer.additional_violator", { entity: "A" }]]);
  assert.equal(fields("V", state, TWO).find((item) => item.key === "outer.additional_behavior")?.required, false);
  assert.deepEqual(problems("V", state, TWO), {});
  assert.deepEqual(buildSlots("V", state, TWO).additional_violator, undefined);
  const behavior = getCodebook("V.v9")!.cells.find((cell) => cell.id === "additional_behavior")!;
  const labels = behavior.options!.map((option) => option.label);
  assert.ok(!labels.includes("không giảm tốc độ qua giao lộ"));
  assert.ok(!labels.includes("vượt xe sai quy định"));
  assert.ok(!labels.includes("không chấp hành biển báo, vạch kẻ đường"));
  assert.ok(labels.includes("quay đầu sai quy định"));
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
  assert.deepEqual(errorText("O", "missing_cell", "Slot answer: cell signs is required for a collision level"),
    { message: "Chưa chọn ô \"Dấu hiệu nhìn thấy rõ\".", cellId: "signs" });
  assert.match(errorText("O", "level_mismatch", "Slot answer: every sign must be a sign of level level.minor (found level.severe)").message,
    /thuộc mức độ đã chọn/);
});

test("stored slots compare equal whatever their key order", async () => {
  const { sameSlots } = await import("./form.ts");
  assert.ok(sameSlots({ b: { option: "x" }, a: [{ y: 1, x: 2 }] }, { a: [{ x: 2, y: 1 }], b: { option: "x" } }));
  assert.ok(!sameSlots({ a: { option: "x" } }, { a: { option: "y" } }));
  assert.ok(sameSlots(null, undefined));
});

test("E.v6 is current: the E.v5 cells without the clothing colour (features/o-level-first)", () => {
  assert.equal(currentVersion("E"), "E.v6");
  const e6 = getCodebook("E.v6")!;
  assert.deepEqual(e6.cells.map((cell) => cell.id), ["type", "dashcam", "vehicle_color"]);
  assert.equal(e6.max_entities, 2);
  const ids = (cells: Record<string, string>) => entityCells(entity("A", cells).cells).map((cell) => [cell.id, cell.required]);
  assert.deepEqual(ids({ type: "type.motorbike" }), [["type", true], ["vehicle_color", true]]);
  assert.deepEqual(ids({ type: "type.car", dashcam: "dashcam.no" }), [["type", true], ["dashcam", true], ["vehicle_color", true]]);
  assert.deepEqual(ids({ type: "type.pedestrian" }), [["type", true]]);
  assert.deepEqual(entityProblems([entity("A", { type: "type.motorbike", vehicle_color: "vehicle_color.red" }),
    entity("B", { type: "type.pedestrian" })]), {});
  // a stored E.v5 pedestrian keeps its clothing colour in the database; the form sends only E.v6 cells
  assert.deepEqual(buildEntityCells(entity("B", { type: "type.pedestrian", clothing_color: "clothing_color.red" }).cells),
    { type: { option: "type.pedestrian" } });
  assert.equal(entityLabel(entity("B", { type: "type.motorbike", vehicle_color: "vehicle_color.red" })), "B · xe máy màu đỏ");
});
