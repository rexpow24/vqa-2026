// Verifies P2, slot answers (features/slot-data-model/acceptance.md): codebook
// rows, the answer format of an assignment, slot answers and entities checked
// by the database, and slot assignments kept out of difficulty, adjudication
// and agreement. Every check prints PASS or FAIL with its criterion number.
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
//   SUPABASE_SECRET_KEY=... TEST_BASE_URL=http://localhost:3006 node scripts/verify-slots.mjs
//
// Local Supabase only. The fixture creates users and videos, so the script
// refuses to start, before any network call, when the Supabase URL or
// TEST_BASE_URL is not a local host. The fixture is removed in the finally block.

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { loadEnv, refuseUnlessLocal, REPO_ROOT } from "./lib/env.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
refuseUnlessLocal("TEST_BASE_URL", env.TEST_BASE_URL);
const base = env.TEST_BASE_URL.replace(/\/$/, "");

// Imported only after the host check: session.mjs builds clients at import time.
const { privilegedClient, signIn, request } = await import("./lib/session.mjs");
const { GROUP_CODES, KEYFRAME_GROUPS } = await import("./lib/qgroups.mjs");
// The same module the routes compose with (Node runs the TypeScript directly).
const { compose } = await import("../src/lib/codebook/compose.ts");

const privileged = privilegedClient();
const tag = `slots-${crypto.randomUUID().slice(0, 8)}`;
const failures = [];

function check(criterion, condition, name, detail) {
  if (condition) {
    console.log(`PASS ${criterion} ${name}`);
  } else {
    failures.push(criterion);
    console.log(`FAIL ${criterion} ${name}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
const must = ({ data, error }) => { if (error) throw error; return data; };

const userIds = [];
const videoIds = [];

async function makeUser(label, role) {
  const email = `${tag}-${label.toLowerCase()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  must(await privileged.from("user_profiles").insert({ id: data.user.id, email, name: `${tag} ${label}`, role, enabled: true }));
  return { id: data.user.id, email, ...(await signIn(email, password)) };
}

// Attr has been a slot group since codebook v2 (features/codebook-v2); N is the one text group.
const SLOT_GROUPS = ["S", "E", "C", "V", "O", "R", "Attr", "Prev"];
// Every frozen codebook: the seven v1 of P2, codebook v2, E.v2, and V.v3 multiselect.
const CODEBOOK_IDS = ["S.v1", "E.v1", "C.v1", "V.v1", "O.v1", "R.v1", "Prev.v1", "S.v2", "C.v2", "V.v2", "V.v3", "Attr.v1", "E.v2"];

/** A1, A4, AC1 (codebook v2): one read-only row per frozen codebook file, equal to the file. */
async function checkCodebooks(t) {
  const rows = must(await t.client.from("codebook_versions").select("id,qgroup,version,content,sha256,frozen_on").order("id"));
  check("AC1", rows.length === CODEBOOK_IDS.length && CODEBOOK_IDS.every((id) => rows.some((row) => row.id === id)),
    "codebook_versions holds the seven v1 codebooks plus S.v2, C.v2, V.v2, V.v3, Attr.v1, E.v2", rows.map((row) => row.id));
  for (const id of CODEBOOK_IDS) {
    const bytes = fs.readFileSync(path.join(REPO_ROOT, "codebook", `${id}.json`));
    const file = JSON.parse(bytes.toString("utf8"));
    const row = rows.find((candidate) => candidate.id === id);
    const sha = crypto.createHash("sha256").update(bytes).digest("hex");
    check(id.endsWith(".v1") && id !== "Attr.v1" ? "A1" : "AC1",
      row && isDeepStrictEqual(row.content, file) && row.sha256 === sha && row.qgroup === file.group
      && row.version === file.version && row.frozen_on === file.frozen_on,
    `${id} equals codebook/${id}.json (content and sha256)`, row ? { sha256: row.sha256, file: sha } : "missing");
  }
  const insert = await t.client.from("codebook_versions")
    .insert({ id: "S.v9", qgroup: "S", version: 9, content: {}, sha256: "x", frozen_on: "2026-11-16" });
  const update = await t.client.from("codebook_versions").update({ sha256: "tampered" }).eq("id", "S.v1").select("id");
  const remove = await t.client.from("codebook_versions").delete().eq("id", "S.v1").select("id");
  const after = must(await privileged.from("codebook_versions").select("id,sha256").order("id"));
  check("A4", Boolean(insert.error) && (Boolean(update.error) || update.data.length === 0)
    && (Boolean(remove.error) || remove.data.length === 0)
    && after.length === CODEBOOK_IDS.length && !after.some((row) => row.sha256 === "tampered"),
  "an annotator cannot insert, update or delete codebook rows",
  { insert: insert.error?.code, update: update.error?.code ?? update.data, delete: remove.error?.code ?? remove.data, rows: after.length });
}

/** Read one stored answer with the service role, bypassing RLS. */
async function stored(draftId, annotatorId) {
  const { data, error } = await privileged.from("qa_annotations")
    .select("verdict,reason_code,reason_note,edited_answer,slots,codebook_version,human_keyframes_s")
    .eq("draft_id", draftId).eq("annotator_id", annotatorId).maybeSingle();
  if (error) throw error;
  return data;
}

const S_SLOTS = {
  weather: { option: "weather.sunny" }, light: { option: "light.day" }, road_type: { option: "road_type.one_way" },
  segment: { option: "segment.straight" }, surface: { option: "surface.dry" }, density: { option: "density.sparse" },
};

/** A8: a slot answer goes through the route and is stored with its composed sentence. */
async function checkSlotAnswer(lead, video) {
  const saved = await request(base, `/api/drafts/${video.drafts.S}/annotation`, lead.cookie, "POST",
    { verdict: "SLOTS", codebook_version: "S.v1", slots: S_SLOTS, human_keyframes_s: [] });
  const row = await stored(video.drafts.S, lead.id);
  check("A8", saved.status === 200 && row?.verdict === "SLOTS" && row.reason_code === null && row.reason_note === null
    && isDeepStrictEqual(row.slots, S_SLOTS) && row.codebook_version === "S.v1"
    && row.edited_answer === "Trời nắng, ban ngày, một chiều tại thẳng, mặt đường khô, mật độ xe thưa.",
  "Lead saves an S slot answer through the route; the server composes the sentence", { status: saved.status, data: saved.data, row });
}

/** A6, A7: only an admin changes an answer format, and only before any work exists. */
async function checkAnswerFormat(lead, t, agreed, regular) {
  const own = await t.client.from("video_assignments").update({ answer_format: "slots" })
    .eq("video_id", regular.id).eq("annotator_id", t.id).select("answer_format");
  const after = must(await privileged.from("video_assignments").select("answer_format")
    .eq("video_id", regular.id).eq("annotator_id", t.id).single());
  check("A6", Boolean(own.error) && after.answer_format === "text",
    "an annotator cannot change the answer format of their own assignment", { error: own.error?.message, after });

  const extra = await makeVideo("lead-extra", { agreement: false });
  must(await privileged.from("video_assignments").insert({ video_id: extra.id, annotator_id: lead.id, status: "pending" }));
  const range = { annotator: lead.id, seq_from: agreed.seq, seq_to: extra.seq };
  const byT = await t.client.rpc("set_answer_format", { ...range, format: "text" });
  const formats = async () => Object.fromEntries((must(await privileged.from("video_assignments").select("video_id,answer_format")
    .eq("annotator_id", lead.id))).map((row) => [row.video_id, row.answer_format]));
  const untouched = await formats();
  check("A7", Boolean(byT.error) && untouched[agreed.id] === "slots" && untouched[extra.id] === "text",
    "set_answer_format called by an annotator is refused", { error: byT.error?.message, untouched });

  const toText = await lead.client.rpc("set_answer_format", { ...range, format: "text" });
  const toSlots = await lead.client.rpc("set_answer_format", { ...range, format: "slots" });
  const final = await formats();
  check("A7", !toText.error && toText.data?.changed === 0 && toText.data?.skipped_started === 1
    && !toSlots.error && toSlots.data?.changed === 1 && toSlots.data?.skipped_started === 0
    && final[agreed.id] === "slots" && final[extra.id] === "slots",
  "an admin switches an untouched assignment and skips, and reports, one that has answers",
  { toText: toText.data ?? toText.error?.message, toSlots: toSlots.data ?? toSlots.error?.message, final });
  return extra;
}

/**
 * F4 (features/slot-form/requirements.md): the admin switch on /admin/assignments
 * goes through POST /api/admin/assignments/format, a thin wrapper over
 * set_answer_format. Anonymous callers get 401, annotators 403, and an admin
 * changes the format of one person's range and gets the RPC's counts back.
 */
async function checkFormatRoute(lead, t) {
  const video = await makeVideo("format-route", { agreement: false });
  must(await privileged.from("video_assignments").insert({ video_id: video.id, annotator_id: t.id, status: "pending" }));
  const body = { annotator_id: t.id, from: video.seq, to: video.seq, format: "slots" };
  const format = async () => must(await privileged.from("video_assignments").select("answer_format")
    .eq("video_id", video.id).eq("annotator_id", t.id).single()).answer_format;

  const anonymous = await request(base, "/api/admin/assignments/format", "", "POST", body);
  const byAnnotator = await request(base, "/api/admin/assignments/format", t.cookie, "POST", body);
  const untouched = await format();
  check("F4", anonymous.status === 401 && byAnnotator.status === 403 && untouched === "text",
    "the format route answers 401 without a session and 403 to an annotator, and changes nothing",
    { anonymous: anonymous.status, annotator: byAnnotator.status, untouched });

  const invalid = await request(base, "/api/admin/assignments/format", lead.cookie, "POST", { ...body, format: "free" });
  const reversed = await request(base, "/api/admin/assignments/format", lead.cookie, "POST", { ...body, from: video.seq + 1 });
  check("F4", invalid.status === 422 && reversed.status === 422 && await format() === "text",
    "the format route refuses an unknown format and a reversed range with 422", { invalid, reversed });

  const toSlots = await request(base, "/api/admin/assignments/format", lead.cookie, "POST", body);
  const switched = await format();
  const again = await request(base, "/api/admin/assignments/format", lead.cookie, "POST", body);
  const back = await request(base, "/api/admin/assignments/format", lead.cookie, "POST", { ...body, format: "text" });
  check("F4", toSlots.status === 200 && isDeepStrictEqual(toSlots.data, { changed: 1, already: 0, skipped_started: 0 })
    && switched === "slots" && again.status === 200 && again.data?.already === 1 && again.data?.changed === 0
    && back.status === 200 && back.data?.changed === 1 && await format() === "text",
  "an admin switches one annotator's range to slots and back through the route, with the RPC's counts",
  { toSlots, switched, again: again.data, back: back.data });

  const overview = await request(base, "/admin/assignments", lead.cookie);
  check("F4", overview.status === 200 && typeof overview.data === "string" && overview.data.includes("Dạng trả lời"),
    "/admin/assignments renders the answer format switch", { status: overview.status });
}

const ENTITIES = [
  { key: "A", cells: { type: { option: "type.car" }, dashcam: { option: "dashcam.yes" } } },
  { key: "B", cells: { type: { option: "type.motorbike" }, vehicle_color: { option: "vehicle_color.red" },
    clothing_color: { option: "clothing_color.blue_green" }, riders: { option: "riders.one" } } },
  { key: "C", cells: { type: { option: "type.pedestrian" }, clothing_color: { option: "clothing_color.white" } } },
];

async function entityRows(videoId, annotatorId) {
  return must(await privileged.from("video_entities").select("entity_key,cells,codebook_version")
    .eq("video_id", videoId).eq("annotator_id", annotatorId).order("entity_key"));
}

/** A15-A17, A7 (entities): entities are saved only through the RPC; the E row is their snapshot. */
async function checkEntities(lead, agreed, extra) {
  const saved = await request(base, `/api/videos/${agreed.id}/entities`, lead.cookie, "PUT",
    { codebook_version: "E.v1", entities: [ENTITIES[2], ENTITIES[0], ENTITIES[1]] });
  const rows = await entityRows(agreed.id, lead.id);
  const eRow = await stored(agreed.drafts.E, lead.id);
  const sentence = compose("E", { entities: ENTITIES });
  check("A15", saved.status === 200 && rows.length === 3 && rows.every((row, i) => row.entity_key === ENTITIES[i].key
      && isDeepStrictEqual(row.cells, ENTITIES[i].cells) && row.codebook_version === "E.v1")
    && eRow?.verdict === "SLOTS" && eRow.codebook_version === "E.v1" && isDeepStrictEqual(eRow.slots, { entities: ENTITIES })
    && eRow.edited_answer === sentence
    && sentence === "Xe ô tô (có camera hành trình), xe máy màu đỏ do người mặc áo xanh điều khiển, người đi bộ mặc áo trắng.",
  "PUT entities stores three entities and the E row as their snapshot with the composed sentence",
  { status: saved.status, data: saved.data, rows, eRow, sentence });

  const forged = await lead.client.from("qa_annotations").upsert({
    draft_id: agreed.drafts.E, annotator_id: lead.id, verdict: "SLOTS", codebook_version: "E.v1",
    slots: { entities: [{ key: "Z", cells: { type: { option: "type.animal" } } }] }, edited_answer: sentence, human_keyframes_s: [],
  }, { onConflict: "draft_id,annotator_id" });
  check("A16", !forged.error && isDeepStrictEqual((await stored(agreed.drafts.E, lead.id)).slots, { entities: ENTITIES }),
    "an E row sent straight through REST keeps the snapshot of video_entities, not what was sent", forged.error?.message ?? "");

  const insert = await lead.client.from("video_entities").insert({ video_id: agreed.id, annotator_id: lead.id,
    entity_key: "D", cells: { type: { option: "type.animal" } }, codebook_version: "E.v1" });
  const update = await lead.client.from("video_entities").update({ cells: { type: { option: "type.animal" } } })
    .eq("video_id", agreed.id).eq("annotator_id", lead.id).select("entity_key");
  const remove = await lead.client.from("video_entities").delete()
    .eq("video_id", agreed.id).eq("annotator_id", lead.id).select("entity_key");
  const after = await entityRows(agreed.id, lead.id);
  check("A17", Boolean(insert.error) && (Boolean(update.error) || update.data.length === 0)
    && (Boolean(remove.error) || remove.data.length === 0) && isDeepStrictEqual(after, rows),
  "insert, update and delete straight on video_entities are refused",
  { insert: insert.error?.code, update: update.error?.code ?? update.data, delete: remove.error?.code ?? remove.data });

  // An assignment that owns only entities (no answer row yet) has started too.
  must(await privileged.from("video_entities").insert({ video_id: extra.id, annotator_id: lead.id, entity_key: "A",
    cells: ENTITIES[0].cells, codebook_version: "E.v1" }));
  const toText = await lead.client.rpc("set_answer_format",
    { annotator: lead.id, seq_from: extra.seq, seq_to: extra.seq, format: "text" });
  const format = must(await privileged.from("video_assignments").select("answer_format")
    .eq("video_id", extra.id).eq("annotator_id", lead.id).single());
  check("A7", !toText.error && toText.data?.skipped_started === 1 && toText.data?.changed === 0 && format.answer_format === "slots",
    "set_answer_format skips an assignment that has only entities", { result: toText.data ?? toText.error?.message, format });
}

const opt = (option) => ({ option });
const ent = (entity) => ({ entity });
const C_B_TO_A = { event_type: opt("event_type.collision"), subject: ent("B"), object: ent("A"),
  conflict_type: opt("conflict_type.k04"), action: opt("action.k04.lane_change_left") };
const V_B = { result: opt("result.yes"), violator: ent("B"), behavior: opt("behavior.wrong_lane") };
const PREV_B = { parties: [{ party: ent("B"), main_action: opt("main_action.observe_and_yield") }] };
const R_YES = { has_aftermath: opt("has_aftermath.yes"), subject: opt("subject.stopped"), bystanders: opt("bystanders.helped") };

/** Lead's answers on the agreement video, minus the save time, to prove a refusal changed nothing. */
async function leadAnswers(lead, video) {
  const rows = must(await privileged.from("qa_annotations")
    .select("draft_id,verdict,reason_code,reason_note,edited_answer,slots,codebook_version,human_keyframes_s")
    .eq("annotator_id", lead.id).in("draft_id", Object.values(video.drafts)).order("draft_id"));
  return rows;
}

function saveThroughRoute(lead, video, group, slots, extra = {}) {
  return request(base, `/api/drafts/${video.drafts[group]}/annotation`, lead.cookie, "POST", {
    verdict: "SLOTS", codebook_version: `${group}.v1`, slots,
    human_keyframes_s: KEYFRAME_GROUPS.includes(group) ? [2, 5.5] : [], ...extra,
  });
}

/** A10-A12, A18: the database refuses wrong cells; the route answers 422 with a code. */
async function checkCellRules(lead, video) {
  const routeSaves = [
    ["A12", "C", { event_type: opt("event_type.collision"), subject: ent("B"), conflict_type: opt("conflict_type.unclear") },
      "C with an unclear conflict type and no action saves"],
    ["A12", "O", { level: opt("level.unclear") }, "O with an unclear level and no sign saves"],
    ["A18", "C", C_B_TO_A, "C with subject B and object A saves"],
    ["A10", "V", V_B, "a valid V answer saves (baseline for the refusals)"],
    ["A10", "Prev", PREV_B, "a valid Prev answer saves (baseline for the refusals)"],
  ];
  for (const [criterion, group, slots, name] of routeSaves) {
    const saved = await saveThroughRoute(lead, video, group, slots);
    const row = await stored(video.drafts[group], lead.id);
    check(criterion, saved.status === 200 && row?.verdict === "SLOTS" && isDeepStrictEqual(row.slots, slots)
      && row.edited_answer === compose(group, slots, { entities: ENTITIES }), name, { status: saved.status, data: saved.data, row });
  }
  // A valid R row straight through REST, so the refusals below have a row to leave unchanged.
  must(await lead.client.from("qa_annotations").upsert({ draft_id: video.drafts.R, annotator_id: lead.id, verdict: "SLOTS",
    codebook_version: "R.v1", slots: R_YES, edited_answer: "R baseline", human_keyframes_s: [] }, { onConflict: "draft_id,annotator_id" }));

  const before = await leadAnswers(lead, video);
  const longText = "x".repeat(201);
  const cases = [
    ["S", { slots: { ...S_SLOTS, weather: opt("weather.snow") } }, "unknown_option", "an option that is not in the codebook"],
    ["S", { slots: { ...S_SLOTS, mood: opt("mood.calm") } }, "unknown_cell", "a cell key that is not in the codebook"],
    ["S", { slots: Object.fromEntries(Object.entries(S_SLOTS).filter(([key]) => key !== "weather")) }, "missing_cell", "S without weather"],
    ["C", { slots: { ...C_B_TO_A, conflict_type: opt("conflict_type.k01") } }, "wrong_parent", "C action k04 under conflict type k01"],
    ["O", { slots: { level: opt("level.minor"), sign: opt("sign.overturned") } }, "wrong_parent", "O sign overturned under a minor level"],
    ["C", { slots: { ...C_B_TO_A, subject: ent("D") } }, "unknown_entity", "C subject D, which Lead never declared"],
    ["S", { slots: { ...S_SLOTS, weather: { option: "weather.sunny", text: "nắng gắt" } } }, "unexpected_text", "text on an option without free_text"],
    ["V", { slots: { ...V_B, behavior: opt("behavior.other") } }, "missing_text", "behavior.other without text"],
    ["V", { slots: { ...V_B, behavior: { option: "behavior.other", text: longText } } }, "text_too_long", "a 201-character text"],
    ["Prev", { slots: { parties: [{ party: ent("B"), main_action: opt("main_action.slow_down"), extra_action: opt("extra_action.slow_down") }] } },
      "must_differ", "Prev extra_action equal to main_action"],
    ["V", { slots: { result: opt("result.yes"), violator: ent("B") } }, "missing_cell", "V result yes without behavior"],
    ["V", { slots: { result: opt("result.none_observed"), violator: ent("B") } }, "conditional_cell", "V none observed with a violator"],
    ["R", { slots: { has_aftermath: opt("has_aftermath.no"), subject: opt("subject.stopped") } }, "conditional_cell", "R without aftermath but with a subject"],
    ["S", { slots: S_SLOTS, codebook_version: "C.v1" }, "codebook_version", "codebook C.v1 on the S draft"],
    ["S", { slots: null }, "missing_slots", "SLOTS without slots"],
    ["S", { slots: S_SLOTS, reason_code: "khác", reason_note: "x" }, "reason", "SLOTS with a reason"],
  ];
  for (const [group, override, hint, name] of cases) {
    const { error } = await lead.client.from("qa_annotations").upsert({
      draft_id: video.drafts[group], annotator_id: lead.id, verdict: "SLOTS", codebook_version: `${group}.v1`,
      edited_answer: "Câu bất kỳ.", human_keyframes_s: KEYFRAME_GROUPS.includes(group) ? [2, 5.5] : [], ...override,
    }, { onConflict: "draft_id,annotator_id" });
    check("A10", error?.hint === hint, `the database refuses ${name}`, { expected: hint, got: error ? `${error.hint}: ${error.message}` : "saved" });
  }
  check("A10", isDeepStrictEqual(await leadAnswers(lead, video), before), "no refused save changed or added a row", "");

  for (const [slots, code, name] of [
    [{ ...C_B_TO_A, conflict_type: opt("conflict_type.k99") }, "unknown_option", "an unknown option"],
    [{ ...C_B_TO_A, conflict_type: opt("conflict_type.k01") }, "wrong_parent", "an action under the wrong conflict type"],
    [{ ...C_B_TO_A, subject: ent("D") }, "unknown_entity", "an undeclared entity"],
  ]) {
    const refused = await saveThroughRoute(lead, video, "C", slots);
    check("A11", refused.status === 422 && refused.data?.code === code, `the route answers 422 ${code} for ${name}`, refused);
  }
  check("A11", isDeepStrictEqual(await leadAnswers(lead, video), before), "no refused route save changed a row", "");
}

async function revisionCount(draftId, annotatorId) {
  const { count, error } = await privileged.from("qa_annotation_revisions").select("id", { count: "exact", head: true })
    .eq("draft_id", draftId).eq("annotator_id", annotatorId);
  if (error) throw error;
  return count;
}

/** A19, A20: an entity another group points at cannot be removed or changed; an unused one can. */
async function checkReferencedEntities(lead, video) {
  const put = (entities) => request(base, `/api/videos/${video.id}/entities`, lead.cookie, "PUT", { codebook_version: "E.v1", entities });
  const before = { rows: await entityRows(video.id, lead.id), e: await stored(video.drafts.E, lead.id) };
  const recolored = { key: "B", cells: { ...ENTITIES[1].cells, vehicle_color: opt("vehicle_color.black") } };
  for (const [entities, name] of [
    [[ENTITIES[0], ENTITIES[2]], "removing B"],
    [[ENTITIES[0], recolored, ENTITIES[2]], "changing the colour of B"],
  ]) {
    const refused = await put(entities);
    const after = { rows: await entityRows(video.id, lead.id), e: await stored(video.drafts.E, lead.id) };
    check("A19", refused.status === 409 && refused.data?.code === "entity_referenced" && refused.data?.entity === "B"
      && refused.data?.groups?.includes("C") && isDeepStrictEqual(after, before),
    `${name} while C points at B answers 409 entity_referenced naming B and C, and changes nothing`, { refused, changed: !isDeepStrictEqual(after, before) });
  }

  const revisions = await revisionCount(video.drafts.E, lead.id);
  const kept = [ENTITIES[0], ENTITIES[1]];
  const saved = await put(kept);
  const rows = await entityRows(video.id, lead.id);
  const e = await stored(video.drafts.E, lead.id);
  check("A20", saved.status === 200 && rows.map((row) => row.entity_key).join() === "A,B"
    && e.edited_answer === compose("E", { entities: kept }) && isDeepStrictEqual(e.slots, { entities: kept })
    && await revisionCount(video.drafts.E, lead.id) === revisions + 1,
  "removing C, which nobody points at, keeps A and B, re-composes the E sentence and adds one revision",
  { status: saved.status, data: saved.data, rows, e, revisions });
}

// A21 drives two real database sessions of Lead at once, through psql in the
// local database container (the script only ever runs against local).
const DB_CONTAINER = "supabase_db_localdb";

/** One psql session as Lead: statements go in on stdin, each followed by a marker to know when it finished. */
class LeadSession {
  constructor(leadId) {
    this.out = "";
    this.err = "";
    this.marks = 0;
    this.proc = spawn("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-X", "-q", "-A", "-t"]);
    this.proc.stdout.setEncoding("utf8").on("data", (chunk) => { this.out += chunk; });
    this.proc.stderr.setEncoding("utf8").on("data", (chunk) => { this.err += chunk; });
    this.ready = this.run(`begin;
set local role authenticated;
select set_config('request.jwt.claims', '${JSON.stringify({ sub: leadId, role: "authenticated" })}', true);`);
  }

  /** Sends SQL; resolves true when it finished within `wait` ms, false when it is still running. */
  run(sql, wait = 15000) {
    const mark = `__done_${++this.marks}__`;
    this.proc.stdin.write(`${sql}\n\\echo ${mark}\n`);
    return this.until(mark, wait);
  }

  until(mark, wait) {
    return new Promise((resolve) => {
      const started = Date.now();
      const poll = () => {
        if (this.out.includes(mark)) resolve(true);
        else if (Date.now() - started > wait) resolve(false);
        else setTimeout(poll, 50);
      };
      poll();
    });
  }

  async finish(sql) {
    await this.run(sql);
    this.proc.stdin.end("\\q\n");
    await new Promise((resolve) => this.proc.once("exit", resolve));
  }
}

/** Sessions currently waiting on a lock while running a statement that contains `fragment`. */
function lockWaiters(fragment) {
  const sql = `select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%${fragment}%'`;
  const result = spawnSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-X", "-A", "-t", "-c", sql], { encoding: "utf8" });
  return Number(result.stdout.trim());
}

const sqlJson = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

/**
 * A21: two tabs of the same annotator, one removing B, the other pointing C at
 * B. Whichever transaction comes second waits for the first, then is refused,
 * so no answer ever points at an entity that is gone.
 */
async function checkConcurrentTabs(lead, video) {
  const entitiesNow = async () => (await entityRows(video.id, lead.id)).map((row) => row.entity_key).join();
  const cOnA = { event_type: opt("event_type.collision"), subject: ent("A"), conflict_type: opt("conflict_type.unclear") };
  const cRow = (slots) => [{ draft_id: video.drafts.C, codebook_version: "C.v1", slots, edited_answer: "Câu C.", human_keyframes_s: [2, 5.5] }];
  const saveC = (slots) => `select 1 from public.save_slot_answers(${sqlJson(cRow(slots))});`;
  const saveEntities = (entities) =>
    `select 1 from public.save_video_entities('${video.id}', 'E.v1', ${sqlJson(entities)}, 'Câu E.');`;
  const scenarios = [
    { name: "C pointing at B first, then removing B", first: saveC(C_B_TO_A), second: saveEntities([ENTITIES[0]]),
      waitsOn: "save_video_entities", refusal: "entity B is used by C" },
    { name: "removing B first, then C pointing at B", first: saveEntities([ENTITIES[0]]), second: saveC(C_B_TO_A),
      waitsOn: "save_slot_answers", refusal: "entity B is not declared in E" },
  ];
  // Only C may point at B in this scenario: V and Prev move to A for good.
  for (const [group, slots] of [["V", { ...V_B, violator: ent("A") }],
    ["Prev", { parties: [{ party: ent("A"), main_action: opt("main_action.observe_and_yield") }] }]]) {
    const moved = await saveThroughRoute(lead, video, group, slots);
    if (moved.status !== 200) throw new Error(`A21 setup failed for ${group}: ${moved.status}`);
  }
  for (const scenario of scenarios) {
    // Start from A and B declared, C pointing at A only.
    const reset = await request(base, `/api/videos/${video.id}/entities`, lead.cookie, "PUT",
      { codebook_version: "E.v1", entities: [ENTITIES[0], ENTITIES[1]] });
    const pointed = await saveThroughRoute(lead, video, "C", cOnA);
    if (reset.status !== 200 || pointed.status !== 200) throw new Error(`A21 setup failed: ${reset.status} ${pointed.status}`);
    const one = new LeadSession(lead.id);
    const two = new LeadSession(lead.id);
    await Promise.all([one.ready, two.ready]);
    const firstDone = await one.run(scenario.first);
    const secondDone = await two.run(scenario.second, 1500);
    const waiting = lockWaiters(scenario.waitsOn);
    await one.finish("commit;");
    const secondEnded = secondDone || await two.until(`__done_${two.marks}__`, 15000);
    await two.finish("commit;");
    const entities = await entitiesNow();
    const c = await stored(video.drafts.C, lead.id);
    check("A21", firstDone && !secondDone && waiting === 1 && secondEnded && two.err.includes(scenario.refusal)
      && one.err === "" && isDeepStrictEqual(c.slots, C_B_TO_A) === (scenario.first === saveC(C_B_TO_A))
      && entities === (scenario.first === saveC(C_B_TO_A) ? "A,B" : "A"),
    `two tabs, ${scenario.name}: the second waits for the first, then is refused`,
    { firstDone, secondWaited: !secondDone, waiting, secondEnded, first: one.err, second: two.err, entities, c: c.slots });
  }
}

/** A47: "khác" of E type and of the Prev actions takes a short text, which the sentence uses. */
async function checkOtherText(lead, video) {
  const books = Object.fromEntries(must(await lead.client.from("codebook_versions").select("id,content")
    .in("id", ["E.v1", "Prev.v1"])).map((row) => [row.id, row.content]));
  const flag = (book, cell, option) => books[book].cells.find((c) => c.id === cell).options.find((o) => o.id === option).free_text;
  check("A47", flag("E.v1", "type", "type.other") === true && flag("Prev.v1", "main_action", "main_action.other") === true
    && flag("Prev.v1", "extra_action", "extra_action.other") === true,
  "the seeded E and Prev codebooks flag their \"khác\" options free_text", "");

  const put = (entities) => request(base, `/api/videos/${video.id}/entities`, lead.cookie, "PUT", { codebook_version: "E.v1", entities });
  const roller = { key: "C", cells: { type: { option: "type.other", text: "xe lu" } } };
  const saved = await put([ENTITIES[0], ENTITIES[1], roller]);
  const e = await stored(video.drafts.E, lead.id);
  check("A47", saved.status === 200 && e.edited_answer.endsWith(", xe lu.") && !e.edited_answer.includes("khác")
    && e.edited_answer === compose("E", { entities: [ENTITIES[0], ENTITIES[1], roller] }),
  "E type.other with the text \"xe lu\" saves, and the E sentence says \"xe lu\"", { status: saved.status, data: saved.data, e: e?.edited_answer });

  const before = await entityRows(video.id, lead.id);
  const bare = await put([ENTITIES[0], ENTITIES[1], { key: "C", cells: { type: { option: "type.other" } } }]);
  check("A47", bare.status === 422 && bare.data?.code === "missing_text" && isDeepStrictEqual(await entityRows(video.id, lead.id), before),
    "E type.other without text answers 422 missing_text and changes no entity", bare);

  const prev = { parties: [{ party: ent("A"), main_action: { option: "main_action.other", text: "bật đèn cảnh báo" } }] };
  const prevSaved = await saveThroughRoute(lead, video, "Prev", prev);
  const prevRow = await stored(video.drafts.Prev, lead.id);
  check("A47", prevSaved.status === 200 && isDeepStrictEqual(prevRow.slots, prev) && prevRow.edited_answer.includes("nên bật đèn cảnh báo")
    && prevRow.edited_answer === compose("Prev", prev, { entities: [ENTITIES[0], ENTITIES[1], roller] }),
  "Prev main_action.other with a text saves, and the Prev sentence uses the text", { status: prevSaved.status, data: prevSaved.data, row: prevRow });

  const { error } = await lead.client.from("qa_annotations").upsert({
    draft_id: video.drafts.Prev, annotator_id: lead.id, verdict: "SLOTS", codebook_version: "Prev.v1", edited_answer: "Câu bất kỳ.",
    slots: { parties: [{ party: ent("A"), main_action: opt("main_action.slow_down"), extra_action: opt("extra_action.other") }] },
    human_keyframes_s: [],
  }, { onConflict: "draft_id,annotator_id" });
  check("A47", error?.hint === "missing_text" && isDeepStrictEqual(await stored(video.drafts.Prev, lead.id), prevRow),
    "the database refuses Prev extra_action.other without text", { got: error ? `${error.hint}: ${error.message}` : "saved" });
}

/** A48: Prev "không rõ" is one party with no action, and its sentence cannot be determined. */
async function checkPrevUnclear(lead, video) {
  const unclear = { parties: [{ party: opt("party.unclear") }] };
  const saved = await saveThroughRoute(lead, video, "Prev", unclear);
  const row = await stored(video.drafts.Prev, lead.id);
  check("A48", saved.status === 200 && isDeepStrictEqual(row?.slots, unclear) && row.edited_answer === "Không thể xác định.",
    "Prev party.unclear saves with the sentence \"Không thể xác định.\"", { status: saved.status, data: saved.data, row });
  for (const [slots, hint, reason, name] of [
    [{ parties: [{ party: opt("party.unclear"), main_action: opt("main_action.slow_down") }] }, "conditional_cell", "main_action",
      "party.unclear with a main action"],
    [{ parties: [{ party: opt("party.unclear") }, { party: ent("A"), main_action: opt("main_action.slow_down") }] }, "parties",
      "party.unclear", "party.unclear beside a second party"],
    [{ parties: [{ party: opt("party.both"), main_action: opt("main_action.slow_down") }] }, "parties", "party.both",
      "party.both stored as itself"],
  ]) {
    const { error } = await lead.client.from("qa_annotations").upsert({
      draft_id: video.drafts.Prev, annotator_id: lead.id, verdict: "SLOTS", codebook_version: "Prev.v1",
      edited_answer: "Câu bất kỳ.", slots, human_keyframes_s: [],
    }, { onConflict: "draft_id,annotator_id" });
    check("A48", error?.hint === hint && error.message.includes(reason) && isDeepStrictEqual(await stored(video.drafts.Prev, lead.id), row),
      `the database refuses ${name}, and the row stays`, { expected: hint, got: error ? `${error.hint}: ${error.message}` : "saved" });
  }
}

const C_BOTH = { event_type: opt("event_type.collision"), subject: opt("subject.both"), conflict_type: opt("conflict_type.k11"),
  parties: [{ party: ent("A"), action: opt("action.k11.left_to_right") }, { party: ent("B"), action: opt("action.k11.right_to_left") }] };

/** A49: C "cả hai bên" holds one action per party and reads "Cả A và B". */
async function checkCBothParties(lead, video) {
  const entities = (await entityRows(video.id, lead.id)).map((row) => ({ key: row.entity_key, cells: row.cells }));
  const saved = await saveThroughRoute(lead, video, "C", C_BOTH);
  const row = await stored(video.drafts.C, lead.id);
  check("A49", saved.status === 200 && isDeepStrictEqual(row?.slots, C_BOTH) && row.edited_answer === compose("C", C_BOTH, { entities })
    && row.edited_answer.includes(", đồng thời ") && row.edited_answer.includes("đi vào đường đi của nhau")
    && row.edited_answer.endsWith("dẫn đến va chạm."),
  "C subject.both with one action per party saves, in the \"Cả A và B\" pattern", { status: saved.status, data: saved.data, row });

  const [a, b] = C_BOTH.parties;
  const refusals = [
    [{ ...C_BOTH, action: opt("action.k11.left_to_right") }, "per_party", "subject.both with an action outside the parties"],
    [{ ...C_BOTH, parties: [a] }, "parties", "subject.both with one party"],
    [{ ...C_BOTH, parties: [a, { ...b, party: ent("A") }] }, "parties", "two parties with the same entity"],
    [{ ...C_BOTH, parties: [a, { ...b, action: opt("action.k04.lane_change_left") }] }, "wrong_parent", "a party action under another conflict type"],
    [{ ...C_BOTH, parties: [a, { ...b, party: ent("D") }] }, "unknown_entity", "a party Lead never declared"],
    [{ ...C_BOTH, object: ent("B") }, "conditional_cell", "subject.both with an object"],
    [{ ...C_BOTH, speed: opt("speed.accelerate") }, "conditional_cell", "subject.both with a speed"],
    [{ ...C_B_TO_A, parties: C_BOTH.parties }, "per_party", "a subject entity with parties"],
  ];
  for (const [slots, hint, name] of refusals) {
    const { error } = await lead.client.from("qa_annotations").upsert({
      draft_id: video.drafts.C, annotator_id: lead.id, verdict: "SLOTS", codebook_version: "C.v1",
      edited_answer: "Câu bất kỳ.", slots, human_keyframes_s: [2, 5.5],
    }, { onConflict: "draft_id,annotator_id" });
    check("A49", error?.hint === hint && isDeepStrictEqual(await stored(video.drafts.C, lead.id), row),
      `the database refuses ${name}, and the row stays`, { expected: hint, got: error ? `${error.hint}: ${error.message}` : "saved" });
  }
  const one = await saveThroughRoute(lead, video, "C", { ...C_BOTH, parties: [a] });
  check("A49", one.status === 422 && Boolean(one.data?.code) && isDeepStrictEqual(await stored(video.drafts.C, lead.id), row),
    "the route answers 422 with a code for subject.both with one party", one);

  const withoutB = entities.filter((entity) => entity.key !== "B");
  const others = must(await privileged.from("qa_annotations").select("draft_id,slots").eq("annotator_id", lead.id)
    .in("draft_id", Object.entries(video.drafts).filter(([group]) => !["C", "E"].includes(group)).map(([, id]) => id)));
  const removed = await request(base, `/api/videos/${video.id}/entities`, lead.cookie, "PUT", { codebook_version: "E.v1", entities: withoutB });
  check("A49", !JSON.stringify(others).includes('"entity":"B"') && removed.status === 409 && removed.data?.code === "entity_referenced"
    && removed.data?.entity === "B" && isDeepStrictEqual(removed.data?.groups, ["C"])
    && (await entityRows(video.id, lead.id)).length === entities.length,
  "removing B, pointed at only from the parties of C, answers 409 entity_referenced naming B and C", removed);
}

/** A22: slot answers of C and V keep the start/end evidence frames; other groups store none. */
async function checkSlotKeyframes(lead, video) {
  const upsert = (group, slots, marks) => lead.client.from("qa_annotations").upsert({
    draft_id: video.drafts[group], annotator_id: lead.id, verdict: "SLOTS", codebook_version: `${group}.v1`,
    edited_answer: "Câu bất kỳ.", slots, human_keyframes_s: marks,
  }, { onConflict: "draft_id,annotator_id" });
  const before = await stored(video.drafts.C, lead.id);
  for (const marks of [[], [5.5, 2]]) {
    const { error } = await upsert("C", C_BOTH, marks);
    check("A22", error?.message === "Mark exactly two evidence frames: start before end"
      && isDeepStrictEqual(await stored(video.drafts.C, lead.id), before),
    `the database refuses a C slot answer with frames ${JSON.stringify(marks)}`, error?.message ?? "saved");
  }
  const v = await saveThroughRoute(lead, video, "V", { result: opt("result.none_observed") }, { human_keyframes_s: [2.0, 5.5] });
  check("A22", v.status === 200 && isDeepStrictEqual((await stored(video.drafts.V, lead.id)).human_keyframes_s, [2, 5.5]),
    "a V slot answer with frames [2.0, 5.5] saves them", v);
  const { error } = await upsert("S", S_SLOTS, [1, 2]);
  check("A22", !error && isDeepStrictEqual((await stored(video.drafts.S, lead.id)).human_keyframes_s, []),
    "an S slot answer sent with frames stores none", error?.message ?? "");
}

/**
 * A9, A50, A51: R takes its subject and object from the caller's C answer, and
 * saving C re-composes an existing R in the same call.
 */
async function checkAftermath(lead, video, extra) {
  const entities = (await entityRows(video.id, lead.id)).map((row) => ({ key: row.entity_key, cells: row.cells }));
  const early = await saveThroughRoute(lead, extra, "R", { has_aftermath: opt("has_aftermath.no") });
  check("A9", early.status === 422 && early.data?.code === "cause_missing" && !(await stored(extra.drafts.R, lead.id)),
    "R before any C answer answers 422 cause_missing", early);

  const none = { has_aftermath: opt("has_aftermath.no") };
  const saved = await saveThroughRoute(lead, video, "R", none);
  const row = await stored(video.drafts.R, lead.id);
  check("A9", saved.status === 200 && row?.verdict === "SLOTS" && isDeepStrictEqual(row.slots, none)
    && row.edited_answer === DRAFT_ANSWERS.R,
  "R without aftermath saves as SLOTS with the sentence equal to the draft word for word", { status: saved.status, data: saved.data, row });

  const reversed = { ...C_BOTH, parties: [C_BOTH.parties[1], C_BOTH.parties[0]] };
  const cSaved = await saveThroughRoute(lead, video, "C", reversed);
  const rYes = { has_aftermath: opt("has_aftermath.yes"), subject: opt("subject.stopped"), object: opt("object.left"),
    bystanders: opt("bystanders.helped") };
  const rSaved = await saveThroughRoute(lead, video, "R", rYes);
  const r = await stored(video.drafts.R, lead.id);
  check("A50", cSaved.status === 200 && rSaved.status === 200
    && r.edited_answer === compose("R", rYes, { entities, cause: reversed })
    && r.edited_answer === "Xe ô tô (có camera hành trình) dừng lại, xe máy màu đỏ tiếp tục di chuyển, rời đi, "
      + "người và xe xung quanh dừng lại hoặc đến hỗ trợ.",
  "R after C subject.both with parties [B, A] puts A in the subject and B in the object", { c: cSaved.status, r: rSaved, row: r?.edited_answer });

  const same = { ...rYes, object: opt("object.stopped") };
  const sameSaved = await saveThroughRoute(lead, video, "R", same);
  check("A50", sameSaved.status === 200 && (await stored(video.drafts.R, lead.id)).edited_answer === "Các bên dừng lại.",
    "both parties stopping reads \"Các bên dừng lại.\"", sameSaved);

  const revisions = await revisionCount(video.drafts.R, lead.id);
  const unclear = { event_type: opt("event_type.collision"), subject: opt("subject.unclear"), conflict_type: opt("conflict_type.unclear") };
  const cUnclear = await saveThroughRoute(lead, video, "C", unclear);
  const rAfter = await stored(video.drafts.R, lead.id);
  check("A51", cUnclear.status === 200 && rAfter.edited_answer === "Không thể xác định." && isDeepStrictEqual(rAfter.slots, same)
    && await revisionCount(video.drafts.R, lead.id) === revisions + 1,
  "saving C as subject.unclear re-composes R to \"Không thể xác định.\" in the same call, one new R revision",
  { status: cUnclear.status, data: cUnclear.data, r: rAfter, revisions });
  const fresh = { ...rYes, bystanders: opt("bystanders.nobody_stopped") };
  const freshSaved = await saveThroughRoute(lead, video, "R", fresh);
  check("A51", freshSaved.status === 200 && (await stored(video.drafts.R, lead.id)).edited_answer === "Không thể xác định.",
    "a new R while C is subject.unclear also reads \"Không thể xác định.\"", freshSaved);
}

/** A13, A14: changing only cells adds one revision that carries them; re-saving the same adds none. */
async function checkSlotRevisions(lead, video) {
  const cause = await saveThroughRoute(lead, video, "C", C_B_TO_A);
  const unclear = { has_aftermath: opt("has_aftermath.yes"), subject: opt("subject.stopped"), bystanders: opt("bystanders.unclear") };
  const first = await saveThroughRoute(lead, video, "R", unclear);
  const sentence = (await stored(video.drafts.R, lead.id)).edited_answer;
  const count = await revisionCount(video.drafts.R, lead.id);
  const nobody = { ...unclear, bystanders: opt("bystanders.nobody_stopped") };
  const changed = await saveThroughRoute(lead, video, "R", nobody);
  const after = await stored(video.drafts.R, lead.id);
  const latest = must(await privileged.from("qa_annotation_revisions").select("*")
    .eq("draft_id", video.drafts.R).eq("annotator_id", lead.id).order("id", { ascending: false }).limit(1))[0];
  check("A13", cause.status === 200 && first.status === 200 && changed.status === 200
    && sentence === "Xe máy màu đỏ dừng lại." && after.edited_answer === sentence
    && await revisionCount(video.drafts.R, lead.id) === count + 1
    && isDeepStrictEqual(latest?.slots, nobody) && latest?.codebook_version === "R.v1",
  "R bystanders unclear to nobody_stopped keeps the sentence and adds one revision carrying the new cells",
  { sentence, after: after.edited_answer, count, now: await revisionCount(video.drafts.R, lead.id), latest });
  const again = await saveThroughRoute(lead, video, "R", nobody);
  check("A14", again.status === 200 && await revisionCount(video.drafts.R, lead.id) === count + 1,
    "saving the same cells again adds no revision", { status: again.status, count: await revisionCount(video.drafts.R, lead.id) });
}

/**
 * A23-A26: a row's form follows its assignment both ways. A stale text page
 * cannot overwrite a slot answer, a text assignment never takes cells, N of a
 * slot assignment stays text (Attr is a slot group since codebook v2, AC5),
 * and AGREE still carries no edited answer.
 */
async function checkFormBoundary(lead, t, agreed, regular) {
  const leadS = await stored(agreed.drafts.S, lead.id);
  const stale = await lead.client.from("qa_annotations").upsert({ draft_id: agreed.drafts.S, annotator_id: lead.id,
    verdict: "DISAGREE", reason_code: "sai diễn đạt", edited_answer: "Trời mưa, ban đêm.", human_keyframes_s: [] },
  { onConflict: "draft_id,annotator_id" });
  check("A23", Boolean(stale.error) && isDeepStrictEqual(await stored(agreed.drafts.S, lead.id), leadS) && leadS.verdict === "SLOTS",
    "a text upsert of the old route on Lead's S slot answer is refused, and the row keeps its cells", stale.error?.message ?? "saved");

  const textRow = { draft_id: regular.drafts.S, annotator_id: t.id, verdict: "DISAGREE", reason_code: "sai diễn đạt",
    edited_answer: "Trời mưa, ban đêm.", human_keyframes_s: [] };
  const slotsOnText = await t.client.from("qa_annotations").upsert({ ...textRow, verdict: "SLOTS", reason_code: null,
    slots: S_SLOTS, codebook_version: "S.v1" }, { onConflict: "draft_id,annotator_id" });
  const cellsOnText = await t.client.from("qa_annotations").upsert({ ...textRow, slots: S_SLOTS, codebook_version: "S.v1" },
    { onConflict: "draft_id,annotator_id" });
  const routeCells = await request(base, `/api/drafts/${regular.drafts.S}/annotation`, t.cookie, "POST",
    { verdict: "DISAGREE", reason_code: "sai diễn đạt", edited_answer: "Trời mưa, ban đêm.", slots: S_SLOTS, human_keyframes_s: [] });
  const afterRefusals = await stored(regular.drafts.S, t.id);
  const plain = await request(base, `/api/drafts/${regular.drafts.S}/annotation`, t.cookie, "POST",
    { verdict: "DISAGREE", reason_code: "sai diễn đạt", edited_answer: "Trời mưa, ban đêm.", human_keyframes_s: [] });
  const tRow = await stored(regular.drafts.S, t.id);
  check("A24", slotsOnText.error?.hint === "text_group" && cellsOnText.error?.hint === "unexpected_slots" && afterRefusals === null
    && routeCells.status === 422 && Boolean(routeCells.data?.code)
    && plain.status === 200 && tRow?.verdict === "DISAGREE" && tRow.slots === null && tRow.codebook_version === null,
  "on a text assignment SLOTS and cells are refused (REST and route), and a text answer still saves without cells",
  { slots: slotsOnText.error?.message ?? "saved", cells: cellsOnText.error?.message ?? "saved", route: routeCells, plain: plain.status, tRow });

  const textSaves = [
    ["N", { verdict: "AGREE" }],
    ["N", { verdict: "DISAGREE", reason_code: "sai diễn đạt", edited_answer: "Câu khác draft." }],
    ["N", { verdict: "NOT_ANSWERABLE" }],
  ];
  for (const [group, body] of textSaves) {
    const saved = await request(base, `/api/drafts/${agreed.drafts[group]}/annotation`, lead.cookie, "POST",
      { human_keyframes_s: [], ...body });
    const row = await stored(agreed.drafts[group], lead.id);
    check("A25", saved.status === 200 && row?.verdict === body.verdict && row.slots === null,
      `${group} of Lead's slot assignment saves the text answer ${body.verdict}`, { status: saved.status, data: saved.data, row });
  }
  const leadN = await stored(agreed.drafts.N, lead.id);
  const nSlots = await lead.client.from("qa_annotations").upsert({ draft_id: agreed.drafts.N, annotator_id: lead.id,
    verdict: "SLOTS", edited_answer: "Câu bất kỳ.", slots: {}, codebook_version: "S.v1", human_keyframes_s: [] },
  { onConflict: "draft_id,annotator_id" });
  const nRoute = await saveThroughRoute(lead, agreed, "N", {});
  check("A25", nSlots.error?.hint === "text_group" && nRoute.status === 422 && isDeepStrictEqual(await stored(agreed.drafts.N, lead.id), leadN),
    "SLOTS for N is refused by the database and by the route", { rest: nSlots.error?.message ?? "saved", route: nRoute });

  const agree = await t.client.from("qa_annotations").upsert({ draft_id: regular.drafts.N, annotator_id: t.id,
    verdict: "AGREE", edited_answer: "Một câu khác draft.", human_keyframes_s: [] }, { onConflict: "draft_id,annotator_id" });
  check("A26", agree.error?.message === "Only a disagreement can carry an edited answer",
    "AGREE with an edited answer is still refused on a text assignment", agree.error?.message ?? "saved");
}


// ---------------------------------------------------------------- codebook v2

/** Saves a slot answer through the route with an explicit codebook version. */
function saveVersion(lead, video, group, version, slots, marks) {
  return request(base, `/api/drafts/${video.drafts[group]}/annotation`, lead.cookie, "POST", {
    verdict: "SLOTS", codebook_version: version, slots,
    human_keyframes_s: marks ?? (KEYFRAME_GROUPS.includes(group) ? [2, 5.5] : []),
  });
}

/** A refused REST upsert of a slot answer; the row must stay as it was. */
async function refuseSlots(lead, video, group, version, slots, hint, name, marks) {
  const before = await stored(video.drafts[group], lead.id);
  const { error } = await lead.client.from("qa_annotations").upsert({
    draft_id: video.drafts[group], annotator_id: lead.id, verdict: "SLOTS", codebook_version: version,
    edited_answer: "Câu bất kỳ.", slots, human_keyframes_s: marks ?? (KEYFRAME_GROUPS.includes(group) ? [2, 5.5] : []),
  }, { onConflict: "draft_id,annotator_id" });
  check("AC3", error?.hint === hint && isDeepStrictEqual(await stored(video.drafts[group], lead.id), before),
    `the database refuses ${name}, and the row stays`, { expected: hint, got: error ? `${error.hint}: ${error.message}` : "saved" });
}

const S2_SLOTS = { ...S_SLOTS, weather: opt("weather.no_rain"), surface_material: opt("surface_material.asphalt") };
const V2_BOTH = { result: opt("result.yes"), violator: opt("violator.both"),
  parties: [{ party: ent("A"), behavior: opt("behavior.wrong_lane") }, { party: ent("B"), behavior: opt("behavior.no_slowdown_intersection") }] };

/**
 * AC2-AC5 of codebook v2: v1 answers stay readable and still save; v2 refuses
 * what it removed; V takes "cả hai bên" with one behaviour per party; Attr is
 * a slot group with one or two parties or "không rõ", and start/end frames.
 */
async function checkCodebookV2(lead, video) {
  const entities = (await entityRows(video.id, lead.id)).map((row) => ({ key: row.entity_key, cells: row.cells }));

  // AC2: an S answer stored with S.v1 (A8) is still there as stored, and re-saving moves it to S.v2.
  const v1Row = await stored(video.drafts.S, lead.id);
  const v1Again = await saveVersion(lead, video, "S", "S.v1", S_SLOTS);
  check("AC2", v1Row?.codebook_version === "S.v1" && v1Again.status === 200
    && (await stored(video.drafts.S, lead.id)).edited_answer === compose("S", S_SLOTS, { version: "S.v1" }),
  "an S answer stored with S.v1 reads back as stored, and S.v1 still saves", { v1Row, status: v1Again.status });
  const v2Saved = await saveVersion(lead, video, "S", "S.v2", S2_SLOTS);
  const v2Row = await stored(video.drafts.S, lead.id);
  check("AC2", v2Saved.status === 200 && v2Row.codebook_version === "S.v2" && isDeepStrictEqual(v2Row.slots, S2_SLOTS)
    && v2Row.edited_answer === "Trời tạnh ráo, ban ngày, đường một chiều tại đoạn đường thẳng, mặt đường nhựa khô, mật độ xe thưa.",
  "the same S saved with S.v2 stores S.v2 and the v2 sentence", { status: v2Saved.status, data: v2Saved.data, v2Row });

  // ED (sentence edit, 2026-11-16): the composed sentence may be edited by adding words only.
  const composedS = v2Row.edited_answer;
  const sendS = (edited) => request(base, `/api/drafts/${video.drafts.S}/annotation`, lead.cookie, "POST", {
    verdict: "SLOTS", codebook_version: "S.v2", slots: S2_SLOTS, human_keyframes_s: [], edited_answer: edited });
  const added = "Hôm đó trời tạnh ráo và là ban ngày, xe đi trên đường một chiều tại đoạn đường thẳng, mặt đường nhựa khô, mật độ xe thưa.";
  const addedSaved = await sendS(added);
  check("ED", addedSaved.status === 200 && (await stored(video.drafts.S, lead.id)).edited_answer === added,
    "an edit that only adds words to the composed sentence is stored", { status: addedSaved.status, data: addedSaved.data });
  const changed = await sendS(composedS.replace("khô", "ướt"));
  check("ED", changed.status === 422 && changed.data?.code === "sentence_edit"
    && (await stored(video.drafts.S, lead.id)).edited_answer === added,
  "an edit that changes a word of the composed sentence is refused, and the row stays", { status: changed.status, data: changed.data });
  const reordered = await sendS("Mật độ xe thưa, trời tạnh ráo, ban ngày, đường một chiều tại đoạn đường thẳng, mặt đường nhựa khô.");
  check("ED", reordered.status === 422 && reordered.data?.code === "sentence_edit",
    "an edit that reorders the composed sentence is refused", { status: reordered.status, data: reordered.data });
  const reset = await saveVersion(lead, video, "S", "S.v2", S2_SLOTS);
  check("ED", reset.status === 200 && (await stored(video.drafts.S, lead.id)).edited_answer === composedS,
    "saving without an edit stores the composed sentence again", { status: reset.status });

  // AC3: what v2 removed is refused under v2.
  await refuseSlots(lead, video, "S", "S.v2", { ...S2_SLOTS, weather: opt("weather.overcast") }, "unknown_option",
    "weather.overcast under S.v2");
  const noMaterial = Object.fromEntries(Object.entries(S2_SLOTS).filter(([key]) => key !== "surface_material"));
  await refuseSlots(lead, video, "S", "S.v2", noMaterial, "missing_cell", "S.v2 without surface_material");
  const c2 = { event_type: opt("event_type.near_miss"), subject: ent("B"), object: ent("A"),
    conflict_type: opt("conflict_type.k04"), action: opt("action.k04.lane_change_left"), speed: opt("speed.high") };
  await refuseSlots(lead, video, "C", "C.v2", { ...c2, evader: ent("A") }, "unknown_cell", "the evader cell under C.v2");
  await refuseSlots(lead, video, "C", "C.v2", { ...c2, evasion: opt("evasion.hard_brake") }, "unknown_cell", "the evasion cell under C.v2");
  await refuseSlots(lead, video, "C", "C.v2", { ...c2, evasion_result: opt("evasion_result.avoided") }, "unknown_cell",
    "the evasion_result cell under C.v2");
  await refuseSlots(lead, video, "C", "C.v1", c2, "unknown_option", "speed.high under C.v1");
  const cSaved = await saveVersion(lead, video, "C", "C.v2", c2);
  const cRow = await stored(video.drafts.C, lead.id);
  check("AC3", cSaved.status === 200 && cRow.codebook_version === "C.v2" && isDeepStrictEqual(cRow.slots, c2)
    && cRow.edited_answer === compose("C", c2, { entities }) && cRow.edited_answer.endsWith("suýt xảy ra va chạm.")
    && cRow.edited_answer.includes("chạy tốc độ cao"),
  "a C.v2 near miss with \"tốc độ cao\" and no evasion saves", { status: cSaved.status, data: cSaved.data, cRow });

  // AC4: V "cả hai bên", one behaviour per party.
  const vSaved = await saveVersion(lead, video, "V", "V.v2", V2_BOTH);
  const vRow = await stored(video.drafts.V, lead.id);
  check("AC4", vSaved.status === 200 && vRow.codebook_version === "V.v2" && isDeepStrictEqual(vRow.slots, V2_BOTH)
    && vRow.edited_answer === compose("V", V2_BOTH, { entities }) && vRow.edited_answer.includes(", đồng thời "),
  "V.v2 with violator.both and one behaviour per party saves", { status: vSaved.status, data: vSaved.data, vRow });
  const [va, vb] = V2_BOTH.parties;
  for (const [slots, hint, name] of [
    [{ ...V2_BOTH, behavior: opt("behavior.wrong_lane") }, "per_party", "violator.both with a behaviour outside the parties"],
    [{ ...V2_BOTH, parties: [va] }, "parties", "violator.both with one party"],
    [{ ...V2_BOTH, parties: [va, { ...vb, party: ent("A") }] }, "parties", "violator.both with the same entity twice"],
    [{ ...V2_BOTH, parties: [va, { party: ent("B") }] }, "missing_cell", "a party without a behaviour"],
    [{ ...V2_BOTH, result: opt("result.none_observed") }, "conditional_cell", "violator.both without a violation"],
    [{ result: opt("result.yes"), violator: ent("B"), behavior: opt("behavior.wrong_lane"), parties: V2_BOTH.parties },
      "per_party", "an entity violator with parties"],
    [{ ...V2_BOTH, parties: [va, { ...vb, party: ent("D") }] }, "unknown_entity", "a party Lead never declared"],
  ]) await refuseSlots(lead, video, "V", "V.v2", slots, hint, name);
  // V.v1 has neither "parties" nor violator.both: the first unknown key is refused.
  await refuseSlots(lead, video, "V", "V.v1", V2_BOTH, "unknown_cell", "violator.both with parties under V.v1");
  await refuseSlots(lead, video, "V", "V.v1", { result: opt("result.yes"), violator: opt("violator.both"), behavior: opt("behavior.wrong_lane") }, "unknown_option", "violator.both under V.v1");
  const vOne = { result: opt("result.yes"), violator: ent("B"), behavior: opt("behavior.no_slowdown_intersection") };
  await refuseSlots(lead, video, "V", "V.v1", vOne, "unknown_option", "behavior.no_slowdown_intersection under V.v1");
  const oneSaved = await saveVersion(lead, video, "V", "V.v2", vOne);
  check("AC4", oneSaved.status === 200 && (await stored(video.drafts.V, lead.id)).edited_answer === compose("V", vOne, { entities }),
    "V.v2 with one violator and \"không giảm tốc độ qua giao lộ\" saves", oneSaved);

  // AC5: Attr is a slot group with frames.
  const textAttr = await request(base, `/api/drafts/${video.drafts.Attr}/annotation`, lead.cookie, "POST",
    { verdict: "AGREE", human_keyframes_s: [2, 5.5] });
  const restText = await lead.client.from("qa_annotations").upsert({ draft_id: video.drafts.Attr, annotator_id: lead.id,
    verdict: "AGREE", human_keyframes_s: [2, 5.5] }, { onConflict: "draft_id,annotator_id" });
  check("AC5", textAttr.status === 422 && restText.error?.hint === "slot_group" && !(await stored(video.drafts.Attr, lead.id)),
    "a text answer to Attr of a slot assignment is refused (route and database)", { route: textAttr, rest: restText.error?.message });
  for (const [slots, sentence, name] of [
    [{ parties: [ent("B")] }, compose("Attr", { parties: [ent("B")] }, { entities }), "one party"],
    [{ parties: [ent("B"), ent("A")] }, compose("Attr", { parties: [ent("A"), ent("B")] }, { entities }), "two parties"],
    [{ parties: opt("parties.unclear") }, "Không thể xác định.", "\"không rõ\""],
  ]) {
    const saved = await saveVersion(lead, video, "Attr", "Attr.v1", slots, [1.25, 4]);
    const row = await stored(video.drafts.Attr, lead.id);
    check("AC5", saved.status === 200 && row.verdict === "SLOTS" && isDeepStrictEqual(row.slots, slots)
      && row.edited_answer === sentence && isDeepStrictEqual(row.human_keyframes_s, [1.25, 4]),
    `Attr saves ${name} with start and end`, { status: saved.status, data: saved.data, row });
  }
  check("AC5", compose("Attr", { parties: [ent("B"), ent("A")] }, { entities }).startsWith("Cả "),
    "two parties read \"Cả [A] và [B].\"", "");
  for (const [slots, hint, name, marks] of [
    [{ parties: [ent("A"), ent("A")] }, "parties", "Attr with the same party twice"],
    [{ parties: [ent("A"), ent("B"), ent("C")] }, "parties", "Attr with three parties"],
    [{ parties: [ent("D")] }, "unknown_entity", "Attr with a party Lead never declared"],
    [{}, "missing_cell", "Attr without a party"],
    [{ parties: opt("parties.both") }, "unknown_option", "Attr with an option it does not have"],
  ]) await refuseSlots(lead, video, "Attr", "Attr.v1", slots, hint, name, marks);
  const before = await stored(video.drafts.Attr, lead.id);
  const { error: noMarks } = await lead.client.from("qa_annotations").upsert({ draft_id: video.drafts.Attr, annotator_id: lead.id,
    verdict: "SLOTS", codebook_version: "Attr.v1", edited_answer: "Câu bất kỳ.", slots: { parties: [ent("A")] }, human_keyframes_s: [] },
  { onConflict: "draft_id,annotator_id" });
  check("AC5", noMarks?.message === "Mark exactly two evidence frames: start before end"
    && isDeepStrictEqual(await stored(video.drafts.Attr, lead.id), before),
  "Attr without start and end is refused", noMarks?.message ?? "saved");
}

/** One statement as postgres in the local database container; returns its unaligned output. */
function psql(sql) {
  const result = spawnSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-X", "-A", "-t", "-c", sql], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr}`);
  return result.stdout.replace(/\r?\n$/, "");
}

/** A27, A28: a slot answer's effective answer is its sentence, and Lead completes a slot assignment. */
async function checkCompletion(lead, video) {
  const effective = psql("select public.effective_answer('SLOTS', '  Trời  nắng. ', 'x')");
  check("A27", effective === "Trời nắng.", "effective_answer of SLOTS is the normalized sentence", effective);

  const rows = await leadAnswers(lead, video);
  const verdicts = Object.fromEntries(Object.entries(video.drafts)
    .map(([group, id]) => [group, rows.find((row) => row.draft_id === id)?.verdict]));
  const slotGroups = SLOT_GROUPS.filter((group) => verdicts[group] === "SLOTS");
  const label = await request(base, `/api/videos/${video.id}/label`, lead.cookie, "POST", { event_label: "near-miss" });
  const completed = await request(base, `/api/videos/${video.id}/complete`, lead.cookie, "POST");
  const assignment = must(await privileged.from("video_assignments").select("status,answer_format")
    .eq("video_id", video.id).eq("annotator_id", lead.id).single());
  check("A28", rows.length === 9 && slotGroups.length === 8 && ["AGREE", "NOT_ANSWERABLE", "DISAGREE"].includes(verdicts.N)
    && verdicts.Attr === "SLOTS" && label.status === 200
    && completed.status === 200 && assignment.status === "completed" && assignment.answer_format === "slots",
  "Lead with eight slot answers (Attr included), N as text and an event label completes the slot assignment",
  { verdicts, label: label.status, completed, assignment });
}

/**
 * A29, A30: Lead's completed slot assignment stays out of derived difficulty,
 * final answers, final event labels and the adjudication CSV. Read as admin.
 */
async function checkOutsideAgreement(admin, lead, video) {
  const videoDifficulty = must(await admin.client.from("video_difficulty").select("annotators,model_errors,difficulty")
    .eq("video_id", video.id));
  const leadDifficulty = must(await admin.client.from("annotator_difficulty").select("video_id")
    .eq("video_id", video.id).eq("annotator_id", lead.id));
  check("A29", videoDifficulty.length === 1 && videoDifficulty[0].annotators === 2 && Number(videoDifficulty[0].model_errors) === 0
    && videoDifficulty[0].difficulty === "easy" && leadDifficulty.length === 0,
  "video_difficulty still counts X and Y only (0.00, easy), and annotator_difficulty has no row for Lead",
  { videoDifficulty, leadDifficulty: leadDifficulty.length });

  const answers = must(await admin.client.from("final_answers").select("qgroup,source,annotators").eq("video_id", video.id));
  const labels = must(await admin.client.from("final_video_labels").select("source,annotators,event_label").eq("video_id", video.id));
  const exported = must(await admin.client.rpc("adjudication_export"));
  const leadLabel = must(await privileged.from("video_labels").select("event_label").eq("video_id", video.id).eq("annotator_id", lead.id).single());
  check("A30", answers.length === 9 && answers.every((row) => row.source === "consensus" && row.annotators === 2),
    "final_answers still has nine consensus rows of two annotators", answers);
  check("A30", leadLabel.event_label === "near-miss" && labels.length === 1 && labels[0].source === "consensus"
    && labels[0].event_label === "accident" && labels[0].annotators === 2,
  "final_video_labels stays consensus although Lead chose another event label", { labels, lead: leadLabel.event_label });
  check("A30", !exported.some((row) => row.video_id === video.id),
    "adjudication_export has no row of the fixture video", exported.filter((row) => row.video_id === video.id));
}

/** A31: the answers export includes the multiple-choice cells and codebook version. */
async function checkExport(admin, lead, x, y, video) {
  const rows = must(await admin.client.rpc("answers_export", { only_agreement: true, seq_from: null, seq_to: null }))
    .filter((row) => row.video_id === video.id);
  const formats = (annotator) => [...new Set(rows.filter((row) => row.annotator_id === annotator.id).map((row) => row.answer_format))];
  check("A31", rows.length === 27 && rows.every((row) => "answer_format" in row)
    && rows.every((row) => "slots" in row && "codebook_version" in row)
    && isDeepStrictEqual(formats(lead), ["slots"]) && isDeepStrictEqual(formats(x), ["text"]) && isDeepStrictEqual(formats(y), ["text"]),
  "answers_export carries format, slot cells and codebook version for slot answers",
  { rows: rows.length, lead: formats(lead), x: formats(x), y: formats(y), keys: rows[0] && Object.keys(rows[0]) });
  const leadScene = rows.find((row) => row.annotator_id === lead.id && row.qgroup === "S");
  check("A31", leadScene?.codebook_version === "S.v2" && isDeepStrictEqual(leadScene?.slots, S2_SLOTS),
    "answers_export returns the saved S.v2 choices as JSON",
    { version: leadScene?.codebook_version, slots: leadScene?.slots });

  const csv = await request(base, "/api/admin/answers/export?scope=agreement", admin.cookie);
  const header = String(csv.data).replace(/^﻿/, "").split(/\r\n/)[0].split(",");
  const lines = String(csv.data).split(/\r\n/).filter((line) => line.includes(video.id));
  check("A31", csv.status === 200 && header.indexOf("answer_format") === header.indexOf("batch") + 1
    && header.indexOf("codebook_version") === header.indexOf("answer_format") + 1
    && header.indexOf("slots") === header.indexOf("codebook_version") + 1
    && lines.length === 27 && lines.some((line) => line.includes("S.v2") && line.includes("weather.no_rain")),
  "the CSV export includes codebook_version and JSON choice data",
  { status: csv.status, header, lines: lines.length, hasChoice: String(csv.data).includes("weather.no_rain") });
}

/** A34: annotator-report reads a completed slot assignment without false alarms. */
function checkAnnotatorReport(lead) {
  const script = path.join(REPO_ROOT, "frontend", "scripts", "annotator-report.mjs");
  const run = spawnSync(process.execPath, [script, lead.email], { encoding: "utf8", env: process.env });
  const out = run.stdout ?? "";
  check("A34", run.status === 0 && out.includes("1 completed, 0 with problems") && !out.includes("answer rewritten under SLOTS")
    && !out.includes("difficulty counts") && !out.includes("missing from annotator_difficulty"),
  "annotator-report for Lead finds no problem: no rewritten SLOTS answer, no difficulty mismatch",
  { status: run.status, out: out.split(/\r?\n/).filter((line) => /FAIL|!|videos,/.test(line)), err: run.stderr });
}

/** Everything one annotator owns on one video, read with the service role. */
async function ownedWork(videoId, annotatorId, drafts) {
  const count = async (query) => { const { count: n, error } = await query; if (error) throw error; return n; };
  return {
    answers: await count(privileged.from("qa_annotations").select("draft_id", { count: "exact", head: true })
      .eq("annotator_id", annotatorId).in("draft_id", Object.values(drafts))),
    entities: await count(privileged.from("video_entities").select("entity_key", { count: "exact", head: true })
      .eq("video_id", videoId).eq("annotator_id", annotatorId)),
    labels: await count(privileged.from("video_labels").select("video_id", { count: "exact", head: true })
      .eq("video_id", videoId).eq("annotator_id", annotatorId)),
    assignments: await count(privileged.from("video_assignments").select("id", { count: "exact", head: true })
      .eq("video_id", videoId).eq("annotator_id", annotatorId)),
  };
}

/**
 * A35-A37: taking an assignment back takes its entities with it, after the
 * answers that point at them, and an assignment that owns only entities has started.
 */
async function checkUnassign(admin, lead, agreed, extra) {
  const before = await ownedWork(extra.id, lead.id, extra.drafts);
  const kept = await admin.client.rpc("unassign_range", { annotator: lead.id, seq_from: extra.seq, seq_to: extra.seq, delete_work: false });
  const after = await ownedWork(extra.id, lead.id, extra.drafts);
  check("A37", before.answers === 0 && before.entities === 1 && !kept.error && kept.data?.removed === 0
    && kept.data?.kept_started === 1 && isDeepStrictEqual(after, before),
  "unassigning without deleting work keeps a slot assignment that owns only an entity", { before, result: kept.data ?? kept.error?.message, after });

  const lead2 = await makeUser("Lead2", "annotator");
  const video = await makeVideo("lead2", { agreement: false });
  must(await privileged.from("video_assignments").insert({ video_id: video.id, annotator_id: lead2.id, status: "pending", answer_format: "slots" }));
  const declared = await request(base, `/api/videos/${video.id}/entities`, lead2.cookie, "PUT",
    { codebook_version: "E.v1", entities: [ENTITIES[0], ENTITIES[1]] });
  const cause = await saveThroughRoute(lead2, video, "C", C_B_TO_A);
  const started = await ownedWork(video.id, lead2.id, video.drafts);
  const range = await admin.client.rpc("unassign_range", { annotator: lead2.id, seq_from: video.seq, seq_to: video.seq, delete_work: true });
  const gone = await ownedWork(video.id, lead2.id, video.drafts);
  check("A36", declared.status === 200 && cause.status === 200 && started.answers === 2 && started.entities === 2
    && !range.error && range.data?.removed === 1 && range.data?.deleted_answers === 2
    && isDeepStrictEqual(gone, { answers: 0, entities: 0, labels: 0, assignments: 0 }),
  "unassign_range with delete_work removes a regular slot assignment whose C points at its entities, entities included",
  { declared: declared.status, cause: cause.status, started, result: range.data ?? range.error?.message, gone });

  const owned = await ownedWork(agreed.id, lead.id, agreed.drafts);
  const round = await admin.client.rpc("unassign_agreement_group", { annotators: [lead.id], seq_from: agreed.seq, seq_to: agreed.seq, delete_work: true });
  const left = await ownedWork(agreed.id, lead.id, agreed.drafts);
  const others = must(await privileged.from("video_assignments").select("annotator_id,status").eq("video_id", agreed.id));
  check("A35", owned.answers === 9 && owned.entities > 0 && owned.labels === 1 && !round.error && round.data?.removed === 1
    && isDeepStrictEqual(left, { answers: 0, entities: 0, labels: 0, assignments: 0 })
    && others.length === 2 && others.every((row) => row.status === "completed"),
  "unassign_agreement_group with delete_work removes Lead's answers, entities, label and assignment, and leaves X and Y",
  { owned, result: round.data ?? round.error?.message, left, others });
}

const DRAFT_ANSWERS = { R: "Không thể xác định." };

async function makeVideo(label, { agreement }) {
  const video = must(await privileged.from("videos").insert({
    drive_file_id: `${tag}-${label}`, filename: `zzz-${tag}-${label}.mp4`, duration_s: 10, agreement_sample: agreement,
  }).select("id,seq").single());
  videoIds.push(video.id);
  const drafts = must(await privileged.from("video_drafts").insert(GROUP_CODES.map((group) => ({
    video_id: video.id, qgroup: group, group_name: group, question: `Q ${group}`, answer: DRAFT_ANSWERS[group] ?? `A ${group}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))).select("id,qgroup"));
  return { ...video, drafts: Object.fromEntries(drafts.map((draft) => [draft.qgroup, draft.id])) };
}

/** X and Y agree with all nine drafts and complete the video, as two trained annotators would. */
async function completeAgreeing(user, video) {
  must(await privileged.from("video_assignments").insert({ video_id: video.id, annotator_id: user.id, status: "pending", batch: "agreement" }));
  must(await privileged.from("qa_annotations").insert(GROUP_CODES.map((group) => ({
    draft_id: video.drafts[group], annotator_id: user.id, verdict: "AGREE",
    human_keyframes_s: KEYFRAME_GROUPS.includes(group) ? [1, 2] : [],
  }))));
  must(await privileged.from("video_labels").insert({ video_id: video.id, annotator_id: user.id, event_label: "accident" }));
  must(await privileged.from("video_assignments").update({ status: "completed" })
    .eq("video_id", video.id).eq("annotator_id", user.id));
}

async function cleanup() {
  // Users first: their rows must cascade away cleanly (A38), then the videos.
  for (const id of userIds) {
    const { error } = await privileged.auth.admin.deleteUser(id);
    if (error) throw new Error(`Fixture user cleanup failed: ${error.message}`);
  }
  if (videoIds.length) {
    const { error } = await privileged.from("videos").delete().in("id", videoIds);
    if (error) throw new Error(`Fixture video cleanup failed: ${error.message}`);
  }
  const leftUsers = must(await privileged.from("user_profiles").select("id").like("email", `${tag}-%`));
  const leftVideos = must(await privileged.from("videos").select("id").like("filename", `zzz-${tag}-%`));
  // Only the fixture's own videos: other local data (e.g. a trial seed) may legitimately hold entities.
  let entities = 0;
  if (videoIds.length) {
    const { count, error } = await privileged.from("video_entities")
      .select("video_id", { count: "exact", head: true }).in("video_id", videoIds);
    if (error) throw error;
    entities = count;
  }
  check("A38", leftUsers.length === 0 && leftVideos.length === 0 && entities === 0,
    "cleanup removes every fixture user and video, and no entity is left", { users: leftUsers.length, videos: leftVideos.length, entities });
}

try {
  console.log(`Fixture ${tag}:`);
  const [lead, x, y, t] = [await makeUser("Lead", "admin"), await makeUser("X", "annotator"),
    await makeUser("Y", "annotator"), await makeUser("T", "annotator")];
  const agreed = await makeVideo("agreement", { agreement: true });
  const regular = await makeVideo("regular", { agreement: false });
  await completeAgreeing(x, agreed);
  await completeAgreeing(y, agreed);
  // Inserted as slots: once an assignment exists only an admin session may change its format (T5).
  must(await privileged.from("video_assignments").insert({ video_id: agreed.id, annotator_id: lead.id, status: "pending", batch: "agreement", answer_format: "slots" }));
  must(await privileged.from("video_assignments").insert({ video_id: regular.id, annotator_id: t.id, status: "pending" }));
  const done = must(await privileged.from("video_assignments").select("annotator_id,status").eq("video_id", agreed.id));
  check("fixture", done.filter((row) => row.status === "completed").length === 2 && done.length === 3,
    "X and Y completed the agreement video, Lead holds it too", done);

  console.log("Codebooks:");
  await checkCodebooks(t);

  console.log("Slot answers:");
  await checkSlotAnswer(lead, agreed);

  console.log("Answer format:");
  const extra = await checkAnswerFormat(lead, t, agreed, regular);

  console.log("Admin format switch:");
  await checkFormatRoute(lead, t);

  console.log("Entities:");
  await checkEntities(lead, agreed, extra);

  console.log("Cell rules:");
  await checkCellRules(lead, agreed);

  console.log("Referenced entities:");
  await checkReferencedEntities(lead, agreed);

  console.log("Two tabs:");
  await checkConcurrentTabs(lead, agreed);

  console.log("Free text of \"khác\":");
  await checkOtherText(lead, agreed);

  console.log("Prev unclear:");
  await checkPrevUnclear(lead, agreed);

  console.log("C both parties:");
  await checkCBothParties(lead, agreed);

  console.log("Evidence frames:");
  await checkSlotKeyframes(lead, agreed);

  console.log("Aftermath from the cause:");
  await checkAftermath(lead, agreed, extra);

  console.log("Revisions:");
  await checkSlotRevisions(lead, agreed);

  console.log("Codebook v2:");
  await checkCodebookV2(lead, agreed);

  console.log("Text and slot forms:");
  await checkFormBoundary(lead, t, agreed, regular);

  console.log("Completion:");
  await checkCompletion(lead, agreed);

  console.log("Outside difficulty and adjudication:");
  await checkOutsideAgreement(lead, lead, agreed);

  console.log("Answers export:");
  await checkExport(lead, lead, x, y, agreed);

  console.log("Annotator report:");
  checkAnnotatorReport(lead);

  console.log("Unassigning:");
  await checkUnassign(lead, lead, agreed, extra);
} catch (error) {
  failures.push("fixture");
  console.log(`FAIL fixture: ${error.message ?? error}`);
} finally {
  try { await cleanup(); } catch (error) { failures.push("cleanup"); console.log(`FAIL cleanup: ${error.message}`); }
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll slot checks passed.");
