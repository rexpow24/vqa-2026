// Verifies E.v5 (features/two-entity-subject-rules/acceptance.md) and E.v6
// (features/e-v6-no-colors/acceptance.md) through the real routes and the local
// database: E takes at most the two main parties, a vehicle colour and no clothing
// colour (E.v6 as revised by features/o-level-first),
// the route saves E with the current book whatever an old page sends, a stored
// legacy list of three stays as stored, and C fills its object from the other
// party.
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
//   SUPABASE_SECRET_KEY=... TEST_BASE_URL=http://localhost:3007 node scripts/verify-entities.mjs
//
// Local Supabase only: the script refuses to start when either URL is not a local
// host. It creates one disposable annotator and one video, removed in `finally`.

import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { loadEnv, refuseUnlessLocal } from "./lib/env.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
refuseUnlessLocal("TEST_BASE_URL", env.TEST_BASE_URL);
const base = env.TEST_BASE_URL.replace(/\/$/, "");

const { privilegedClient, signIn, request } = await import("./lib/session.mjs");
const { GROUP_CODES } = await import("./lib/qgroups.mjs");

const privileged = privilegedClient();
const tag = `entities-${crypto.randomUUID().slice(0, 8)}`;
const failures = [];
const must = ({ data, error }) => { if (error) throw error; return data; };
function check(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else { failures.push(name); console.log(`FAIL ${name}: ${JSON.stringify(detail)}`); }
}

const opt = (option) => ({ option });
const A = { key: "A", cells: { type: opt("type.car"), dashcam: opt("dashcam.yes") } };
const B = { key: "B", cells: { type: opt("type.motorbike"), vehicle_color: opt("vehicle_color.red") } };
const C = { key: "C", cells: { type: opt("type.pedestrian") } };
const SHIRT = { key: "B", cells: { type: opt("type.pedestrian"), clothing_color: opt("clothing_color.red") } };
const CURRENT = "E.v6";

let userId;
let videoId;

async function storedEntities() {
  return must(await privileged.from("video_entities").select("entity_key,codebook_version")
    .eq("video_id", videoId).eq("annotator_id", userId).order("entity_key"));
}

try {
  const email = `${tag}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const created = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  must(await privileged.from("user_profiles").insert({ id: userId, email, name: tag, role: "annotator", enabled: true }));
  // Group C is saved only after the C training (features/c-training-gate); this test is not about the C/E gates.
  must(await privileged.from("training_completions").insert([{ annotator_id: userId, training: "C-v1" },
    { annotator_id: userId, training: "E-v1" }]));
  const user = await signIn(email, password);

  const video = must(await privileged.from("videos").insert({
    drive_file_id: tag, filename: `zzz-${tag}.mp4`, duration_s: 10, agreement_sample: false,
  }).select("id,seq").single());
  videoId = video.id;
  const drafts = Object.fromEntries(must(await privileged.from("video_drafts").insert(GROUP_CODES.map((group) => ({
    video_id: video.id, qgroup: group, group_name: group, question: `Q ${group}`, answer: `A ${group}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))).select("id,qgroup")).map((draft) => [draft.qgroup, draft.id]));
  must(await privileged.from("video_assignments").insert({ video_id: video.id, annotator_id: userId, status: "pending",
    answer_format: "slots" }));
  const put = (entities, version = CURRENT) =>
    request(base, `/api/videos/${video.id}/entities`, user.cookie, "PUT", { codebook_version: version, entities });

  const three = await put([A, B, C]);
  check("three parties are refused with 422 too_many_entities and nothing is stored",
    three.status === 422 && three.data?.code === "too_many_entities" && (await storedEntities()).length === 0, three);

  const oldPage = await put([A, B, C], "E.v4");
  check("an old page sending E.v4 with three parties is refused too", oldPage.status === 422
    && oldPage.data?.code === "too_many_entities", oldPage);

  const two = await put([A, B], "E.v4");
  const rows = await storedEntities();
  check("two parties save, as the current E even when the client sent E.v4", two.status === 200
    && isDeepStrictEqual(rows, [{ entity_key: "A", codebook_version: CURRENT }, { entity_key: "B", codebook_version: CURRENT }]), { two, rows });
  const cellsB = must(await privileged.from("video_entities").select("cells").eq("video_id", video.id)
    .eq("annotator_id", userId).eq("entity_key", "B").single()).cells;
  check("the vehicle colour is stored under E.v6", isDeepStrictEqual(cellsB, B.cells), cellsB);
  const eAnswer = must(await privileged.from("qa_annotations").select("codebook_version,edited_answer").eq("draft_id", drafts.E)
    .eq("annotator_id", userId).single());
  check("the E answer is stored under the current E, named with the vehicle colour", eAnswer.codebook_version === CURRENT
    && eAnswer.edited_answer === "Xe ô tô (có camera hành trình), xe máy màu đỏ.", eAnswer);
  const shirt = await put([A, SHIRT], "E.v5");
  const cellsShirt = must(await privileged.from("video_entities").select("cells").eq("video_id", video.id)
    .eq("annotator_id", userId).eq("entity_key", "B").single()).cells;
  check("an old page's clothing colour is dropped, not refused (E.v6)", shirt.status === 200
    && isDeepStrictEqual(cellsShirt, { type: opt("type.pedestrian") }), { shirt, cellsShirt });
  const noColour = await put([A, { key: "B", cells: { type: opt("type.motorbike") } }]);
  check("a motorbike without a vehicle colour is refused", noColour.status === 422, noColour);

  const one = await put([A]);
  check("one party (single-vehicle event) saves", one.status === 200 && (await storedEntities()).length === 1, one);

  const direct = await user.client.rpc("save_video_entities", { target_video: video.id, version: CURRENT,
    entities: [A, C, { key: "D", cells: { type: opt("type.bicycle") } }], e_answer: "x" });
  check("the database refuses three parties under the current E when the route is bypassed", direct.error?.hint === "too_many_entities",
    direct.error);
  const colour = await user.client.rpc("save_video_entities", { target_video: video.id, version: CURRENT,
    entities: [A, SHIRT], e_answer: "x" });
  check("the database refuses a clothing colour under E.v6 when the route is bypassed", Boolean(colour.error), colour);
  const bare = await user.client.rpc("save_video_entities", { target_video: video.id, version: CURRENT,
    entities: [A, { key: "B", cells: { type: opt("type.motorbike") } }], e_answer: "x" });
  check("the database refuses a motorbike without a vehicle colour under E.v6", bare.error?.hint === "missing_cell", bare.error);

  // A legacy list: three E.v4 parties stored before E.v5 existed.
  must(await privileged.from("video_entities").delete().eq("video_id", videoId).eq("annotator_id", userId));
  must(await privileged.from("video_entities").insert([A, B, C].map((entity) => ({ video_id: videoId, annotator_id: userId,
    entity_key: entity.key, cells: entity.cells, codebook_version: "E.v4" }))));
  must(await privileged.from("video_entities").update({ updated_at: new Date().toISOString() })
    .eq("video_id", videoId).eq("annotator_id", userId).eq("entity_key", "C"));
  const legacy = await storedEntities();
  check("a stored legacy list of three E.v4 parties stays valid and readable", legacy.length === 3
    && legacy.every((row) => row.codebook_version === "E.v4"), legacy);
  const resave = await put([A, B]);
  check("re-saving that video as two parties replaces the legacy list with the current E", resave.status === 200
    && isDeepStrictEqual((await storedEntities()).map((row) => row.codebook_version), [CURRENT, CURRENT]), resave);

  // A stored E.v5 list with colours stays as stored, and C on that video names the vehicle colour.
  must(await privileged.from("video_entities").delete().eq("video_id", videoId).eq("annotator_id", userId));
  must(await privileged.from("video_entities").insert([A, B].map((entity) => ({ video_id: videoId, annotator_id: userId,
    entity_key: entity.key, cells: entity.cells, codebook_version: "E.v5" }))));
  check("a stored E.v5 list with a vehicle colour stays valid", isDeepStrictEqual(
    (await storedEntities()).map((row) => row.codebook_version), ["E.v5", "E.v5"]), await storedEntities());
  const cause = await request(base, `/api/drafts/${drafts.C}/annotation`, user.cookie, "POST", { verdict: "SLOTS",
    codebook_version: "C.v4", slots: { event_type: opt("event_type.collision"), subject: { entity: "B" }, object: { entity: "A" },
      conflict_type: opt("conflict_type.k04"), action: opt("action.k04.lane_change_left") }, human_keyframes_s: [1, 3] });
  check("C on a video with stored coloured parties names the vehicle colour", cause.status === 200
    && cause.data?.edited_answer?.startsWith("Xe máy màu đỏ chuyển sang làn bên trái"), cause);
} finally {
  if (userId) {
    const { error } = await privileged.auth.admin.deleteUser(userId);
    if (error) console.log(`FAIL cleanup user: ${error.message}`);
  }
  if (videoId) must(await privileged.from("videos").delete().eq("id", videoId));
  const left = must(await privileged.from("videos").select("id").like("filename", `zzz-${tag}%`));
  check("cleanup removes the fixture", left.length === 0, left);
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll E.v5/E.v6 checks passed");
