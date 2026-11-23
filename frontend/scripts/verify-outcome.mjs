// Verifies O.v2 (features/o-codebook-v2/acceptance.md) through the real routes
// and the local database: O is derived from the caller's C (a near miss fixes the
// level; on a collision the level is the highest level of the ticked signs,
// features/o-signs-max-grouped), the database refuses an inconsistent O.v2, O.v1 rows
// stay valid, and a video whose O contradicts C cannot be completed.
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
//   SUPABASE_SECRET_KEY=... TEST_BASE_URL=http://localhost:3006 node scripts/verify-outcome.mjs
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
const tag = `outcome-${crypto.randomUUID().slice(0, 8)}`;
const failures = [];
const must = ({ data, error }) => { if (error) throw error; return data; };
function check(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else { failures.push(name); console.log(`FAIL ${name}: ${JSON.stringify(detail)}`); }
}

const opt = (option) => ({ option });
const ent = (entity) => ({ entity });
const ENTITIES = [
  { key: "A", cells: { type: opt("type.car"), dashcam: opt("dashcam.yes") } },
  { key: "B", cells: { type: opt("type.motorbike"), vehicle_color: opt("vehicle_color.red") } }, // E.v6 asks the vehicle colour
];
const C_COLLISION = { event_type: opt("event_type.collision"), subject: ent("B"), object: ent("A"),
  conflict_type: opt("conflict_type.k04"), action: opt("action.k04.lane_change_left") };
const C_NEAR_MISS = { ...C_COLLISION, event_type: opt("event_type.near_miss") };
const NONE_SENTENCE = "Không quan sát thấy va chạm hoặc hư hỏng phương tiện.";

let userId;
let videoId;

async function stored(draftId) {
  return must(await privileged.from("qa_annotations").select("slots,codebook_version,edited_answer")
    .eq("draft_id", draftId).eq("annotator_id", userId).maybeSingle());
}

try {
  const email = `${tag}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const created = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  must(await privileged.from("user_profiles").insert({ id: userId, email, name: tag, role: "annotator", enabled: true }));
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
  const entities = await request(base, `/api/videos/${video.id}/entities`, user.cookie, "PUT",
    { codebook_version: "E.v4", entities: ENTITIES });
  if (entities.status !== 200) throw new Error(`entities: ${JSON.stringify(entities)}`);
  const save = (group, slots, version = `${group}.v${group === "O" ? 2 : 4}`) =>
    request(base, `/api/drafts/${drafts[group]}/annotation`, user.cookie, "POST",
      { verdict: "SLOTS", codebook_version: version, slots, human_keyframes_s: group === "C" ? [1, 3] : [] });

  const early = await save("O", { level: opt("level.severe"), signs: { options: ["sign.overturned"] } });
  check("O before C is refused with cause_missing", early.status === 422 && early.data?.code === "cause_missing"
    && (await stored(drafts.O)) === null, early);

  const nearMiss = await save("C", C_NEAR_MISS);
  const derived = await stored(drafts.O);
  check("saving a near-miss C writes O.v2 'không va chạm' in the same call", nearMiss.status === 200
    && nearMiss.data.also?.some((row) => row.draft_id === drafts.O)
    && derived?.codebook_version === "O.v2" && isDeepStrictEqual(derived.slots, { level: opt("level.none") })
    && derived.edited_answer === NONE_SENTENCE, { status: nearMiss.status, derived });

  const collision = await save("C", C_COLLISION);
  const stale = await stored(drafts.O);
  check("changing C to a collision leaves O for the annotator (no signs invented)", collision.status === 200
    && isDeepStrictEqual(stale.slots, { level: opt("level.none") }), stale);
  const blocked = await request(base, `/api/videos/${video.id}/complete`, user.cookie, "POST");
  check("completing while O.v2 contradicts C is refused", blocked.status === 422 && blocked.data?.code === "outcome_conflict", blocked);

  const noSign = await save("O", { level: opt("level.severe") });
  check("a collision O without a sign is refused", noSign.status === 422 && noSign.data?.code === "missing_cell", noSign);
  const noneOnCollision = await save("O", { level: opt("level.none") });
  check("a collision O with 'không va chạm' and no sign is refused", noneOnCollision.status === 422
    && noneOnCollision.data?.code === "missing_cell", noneOnCollision);

  // features/o-signs-max-grouped: the level is the highest of the signs; the client's level and version are ignored.
  const ticked = await save("O", { level: opt("level.minor"), parties: [ent("B"), ent("A")],
    signs: { options: ["sign.person_thrown", "sign.person_fell", "sign.overturned"] } }, "O.v1");
  const answer = await stored(drafts.O);
  check("O stores the highest sign level and every sign, in codebook order, as O.v2 whatever level and version the client sent",
    ticked.status === 200 && answer.codebook_version === "O.v2" && isDeepStrictEqual(answer.slots, {
      level: opt("level.severe"), signs: { options: ["sign.person_fell", "sign.overturned", "sign.person_thrown"] },
      parties: [ent("B"), ent("A")],
    }) && answer.edited_answer
      === "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm mạnh, người ngã tại chỗ, bị lật, người bị hất văng khỏi xe.",
    { status: ticked.status, data: ticked.data, answer });
  const allowed = await request(base, `/api/videos/${video.id}/complete`, user.cookie, "POST");
  check("once O agrees with C, completion is not refused for O", allowed.data?.code !== "outcome_conflict", allowed);
  must(await privileged.from("video_assignments").update({ status: "in_progress", completed_at: null })
    .eq("video_id", video.id).eq("annotator_id", userId));

  const back = await save("C", C_NEAR_MISS);
  const backO = await stored(drafts.O);
  check("C back to a near miss re-derives O as 'không va chạm'", back.status === 200
    && isDeepStrictEqual(backO.slots, { level: opt("level.none") }), backO);

  must(await privileged.from("qa_annotations").delete().eq("draft_id", drafts.O).eq("annotator_id", userId));
  const synced = await request(base, `/api/videos/${video.id}/derive-prev`, user.cookie, "POST");
  const syncedO = await stored(drafts.O);
  check("page sync writes O for a C saved before O existed", synced.status === 200
    && synced.data.rows?.some((row) => row.draft_id === drafts.O)
    && isDeepStrictEqual(syncedO?.slots, { level: opt("level.none") }), { synced, syncedO });

  const legacy = await privileged.from("qa_annotations").upsert({ draft_id: drafts.O, annotator_id: userId, verdict: "SLOTS",
    codebook_version: "O.v1", slots: { level: opt("level.unclear") }, edited_answer: "Không thể xác định.", human_keyframes_s: [] },
  { onConflict: "draft_id,annotator_id" });
  check("an O.v1 row (level.unclear) still validates", !legacy.error, legacy.error);
  const inconsistent = await user.client.from("qa_annotations").upsert({ draft_id: drafts.O, annotator_id: userId, verdict: "SLOTS",
    codebook_version: "O.v2", slots: { level: opt("level.minor"), signs: { options: ["sign.overturned"] } },
    edited_answer: "x", human_keyframes_s: [] }, { onConflict: "draft_id,annotator_id" });
  check("the database refuses an O.v2 level below its highest sign", inconsistent.error?.hint === "level_mismatch",
    inconsistent.error);
  const above = await user.client.from("qa_annotations").upsert({ draft_id: drafts.O, annotator_id: userId, verdict: "SLOTS",
    codebook_version: "O.v2", slots: { level: opt("level.severe"), signs: { options: ["sign.vehicle_fell"] } },
    edited_answer: "x", human_keyframes_s: [] }, { onConflict: "draft_id,annotator_id" });
  check("the database refuses an O.v2 level above its highest sign", above.error?.hint === "level_mismatch", above.error);
  const mixed = await user.client.from("qa_annotations").upsert({ draft_id: drafts.O, annotator_id: userId, verdict: "SLOTS",
    codebook_version: "O.v2", slots: { level: opt("level.severe"), signs: { options: ["sign.vehicle_fell", "sign.overturned"] } },
    edited_answer: "x", human_keyframes_s: [] }, { onConflict: "draft_id,annotator_id" });
  check("the database accepts a moderate and a severe sign as severe", !mixed.error, mixed.error);
  const secondary = await user.client.from("qa_annotations").upsert({ draft_id: drafts.O, annotator_id: userId, verdict: "SLOTS",
    codebook_version: "O.v2", slots: { level: opt("level.severe"), signs: { options: ["sign.secondary_collision"] } },
    edited_answer: "x", human_keyframes_s: [] }, { onConflict: "draft_id,annotator_id" });
  check("the database refuses the removed sign 'va chạm thứ cấp'", Boolean(secondary.error), secondary.error);

  // features/o-v2-sign-revision: "không đánh giá" merged into "không va chạm"; car body damage is moderate.
  const notAssessed = await user.client.from("qa_annotations").upsert({ draft_id: drafts.O, annotator_id: userId, verdict: "SLOTS",
    codebook_version: "O.v2", slots: { level: opt("level.not_assessed") }, edited_answer: "x", human_keyframes_s: [] },
  { onConflict: "draft_id,annotator_id" });
  check("the database refuses the removed level 'không đánh giá'", Boolean(notAssessed.error), notAssessed.error);
  must(await privileged.from("qa_annotations").delete().eq("draft_id", drafts.O).eq("annotator_id", userId));
  await save("C", C_COLLISION);
  const body = await save("O", { level: opt("level.moderate"), signs: { options: ["sign.visible_body_damage"] } });
  const bodyO = await stored(drafts.O);
  check("the car body-damage sign alone is stored as 'va chạm vừa'", body.status === 200 && isDeepStrictEqual(bodyO?.slots, {
    level: opt("level.moderate"), signs: { options: ["sign.visible_body_damage"] }, parties: [ent("B"), ent("A")],
  }) && bodyO.edited_answer === "Xe máy màu đỏ và xe ô tô (có camera hành trình) va chạm vừa, có hư hỏng nhìn thấy được ở thân xe (ô tô).",
  { status: body.status, data: body.data, bodyO });
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
console.log("\nAll O.v2 checks passed.");
