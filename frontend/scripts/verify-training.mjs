// Verifies the mandatory group C training (features/c-training-gate/requirements.md)
// through the real routes and the local database: C cannot be saved until the
// caller completed C-v1, completing it is recorded for the caller only, and the
// admin dashboard sees it.
//
//   TEST_BASE_URL=http://localhost:3006 node scripts/verify-training.mjs
//
// Local Supabase only. Creates two annotators, one admin and one video, removed in `finally`.

import crypto from "node:crypto";
import { loadEnv, refuseUnlessLocal } from "./lib/env.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
refuseUnlessLocal("TEST_BASE_URL", env.TEST_BASE_URL);
const base = env.TEST_BASE_URL.replace(/\/$/, "");
const { privilegedClient, signIn, request } = await import("./lib/session.mjs");
const { GROUP_CODES } = await import("./lib/qgroups.mjs");

const privileged = privilegedClient();
const tag = `training-${crypto.randomUUID().slice(0, 8)}`;
const failures = [];
const must = ({ data, error }) => { if (error) throw error; return data; };
function check(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else { failures.push(name); console.log(`FAIL ${name}: ${JSON.stringify(detail)}`); }
}
const created = [];
let videoId;
async function makeUser(suffix, role) {
  const email = `${tag}-${suffix}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const result = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error) throw result.error;
  created.push(result.data.user.id);
  must(await privileged.from("user_profiles").insert({ id: result.data.user.id, email, name: `${tag}-${suffix}`, role, enabled: true }));
  return { id: result.data.user.id, ...(await signIn(email, password)) };
}
const opt = (option) => ({ option });

try {
  const one = await makeUser("a", "annotator");
  const two = await makeUser("b", "annotator");
  const admin = await makeUser("admin", "admin");
  const video = must(await privileged.from("videos").insert({ drive_file_id: tag, filename: `zzz-${tag}.mp4`, duration_s: 10,
    agreement_sample: false }).select("id").single());
  videoId = video.id;
  const drafts = Object.fromEntries(must(await privileged.from("video_drafts").insert(GROUP_CODES.map((group) => ({
    video_id: video.id, qgroup: group, group_name: group, question: `Q ${group}`, answer: `A ${group}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))).select("id,qgroup")).map((draft) => [draft.qgroup, draft.id]));
  must(await privileged.from("video_assignments").insert({ video_id: video.id, annotator_id: one.id, status: "pending",
    answer_format: "slots" }));
  const E_PARTIES = [
    { key: "A", cells: { type: opt("type.car"), dashcam: opt("dashcam.yes") } },
    { key: "B", cells: { type: opt("type.motorbike"), vehicle_color: opt("vehicle_color.red") } }];
  const earlyE = await request(base, `/api/videos/${video.id}/entities`, one.cookie, "PUT", { entities: E_PARTIES });
  check("E cannot be saved before the E training is completed", earlyE.status === 403 && earlyE.data?.code === "training_required", earlyE);
  const doneE = await request(base, "/api/trainings/E-v1/complete", one.cookie, "POST", {});
  check("completing E-v1 is recorded", doneE.status === 200, doneE);
  const entities = await request(base, `/api/videos/${video.id}/entities`, one.cookie, "PUT", { codebook_version: "E.v6", entities: E_PARTIES });
  if (entities.status !== 200) throw new Error(`entities: ${JSON.stringify(entities)}`);
  const saveC = () => request(base, `/api/drafts/${drafts.C}/annotation`, one.cookie, "POST", { verdict: "SLOTS", codebook_version: "C.v4",
    slots: { event_type: opt("event_type.collision"), subject: { entity: "B" }, object: { entity: "A" },
      conflict_type: opt("conflict_type.k04"), action: opt("action.k04.lane_change_left") }, human_keyframes_s: [1, 3] });

  const early = await saveC();
  check("C cannot be saved before the C training is completed", early.status === 403 && early.data?.code === "training_required", early);
  const other = await request(base, `/api/drafts/${drafts.S}/annotation`, one.cookie, "POST", { verdict: "SLOTS", codebook_version: "S.v3",
    slots: {} });
  check("other groups are not locked by the C training", other.data?.code !== "training_required", other);

  const clip = await fetch(`${base}/api/references/C-training-full/stream`, { headers: { Range: "bytes=0-1023", Cookie: one.cookie } });
  check("the training video streams to a signed-in annotator", clip.status === 206, clip.status);
  await clip.body?.cancel().catch(() => undefined);

  const unknown = await request(base, "/api/trainings/C-v0/complete", one.cookie, "POST", {});
  check("an unknown training id is refused", unknown.status === 422, unknown);
  const done = await request(base, "/api/trainings/C-v1/complete", one.cookie, "POST", {});
  const again = await request(base, "/api/trainings/C-v1/complete", one.cookie, "POST", {});
  check("completing C-v1 is recorded, and recording it twice is harmless", done.status === 200 && again.status === 200, { done, again });

  const saved = await saveC();
  check("once trained, C saves", saved.status === 200, saved);

  const peek = await two.client.from("training_completions").select("training").eq("annotator_id", one.id);
  check("another annotator cannot read that completion", !peek.error && peek.data.length === 0, peek);
  const forged = await two.client.from("training_completions").insert({ annotator_id: one.id, training: "C-v1" });
  check("an annotator cannot record a completion for someone else", Boolean(forged.error), forged.error);

  const stats = await admin.client.rpc("reference_view_stats");
  const rowOne = stats.data?.find((row) => row.annotator_id === one.id);
  const rowTwo = stats.data?.find((row) => row.annotator_id === two.id);
  check("the admin sees who completed the C training", !stats.error && Boolean(rowOne?.training_c_completed_at)
    && Boolean(rowOne?.training_e_completed_at) && rowTwo && rowTwo.training_c_completed_at === null
    && rowTwo.training_e_completed_at === null, { error: stats.error, rowOne, rowTwo });
} finally {
  if (videoId) await privileged.from("videos").delete().eq("id", videoId);
  for (const id of created) {
    const { error } = await privileged.auth.admin.deleteUser(id);
    if (error) console.log(`cleanup: ${error.message}`);
  }
}

if (failures.length) { console.log(`\n${failures.length} check(s) failed.`); process.exit(1); }
console.log("\nAll training checks passed.");
