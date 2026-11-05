// Verifies derived difficulty: the count of Gemini drafts an annotator did not
// agree with, mapped to a level, and the mean over two annotators.
//
//   cd frontend && node scripts/verify-difficulty.mjs
//   TEST_BASE_URL=https://vqa-vn-traffic-labeling.vercel.app node scripts/verify-difficulty.mjs
//
// The HTTP half (saving an event label without a difficulty) needs a hosted
// server; without TEST_BASE_URL it is skipped. Creates two temporary
// annotators and one temporary video, and removes them in the finally block.

import crypto from "node:crypto";
import { privilegedClient, signIn, request } from "./lib/session.mjs";
import { GROUP_CODES, KEYFRAME_GROUPS } from "./lib/qgroups.mjs";

const privileged = privilegedClient();
const base = process.env.TEST_BASE_URL;

function check(condition, name, detail) {
  if (!condition) throw new Error(`${name} failed: ${detail}`);
  console.log(`  OK  ${name}`);
}

async function makeAnnotator(label) {
  const email = `difficulty-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { error: profileError } = await privileged.from("user_profiles").insert({
    id: data.user.id, email, name: label, role: "annotator", enabled: true,
  });
  if (profileError) throw profileError;
  const { client, cookie } = await signIn(email, password);
  return { id: data.user.id, client, cookie };
}

// The worked example: A rejects N, C, Attr and cannot answer O (4 errors);
// B rejects E, N, C (3 errors). Both are medium, the video mean is 3.5.
const VERDICTS = {
  A: { N: "DISAGREE", C: "DISAGREE", Attr: "DISAGREE", O: "NOT_ANSWERABLE" },
  B: { E: "DISAGREE", N: "DISAGREE", C: "DISAGREE" },
};

let videoId;
const users = [];
try {
  const { data: video, error: videoError } = await privileged.from("videos").insert({
    drive_file_id: `difficulty-test-${crypto.randomUUID()}`,
    filename: `zzz-difficulty-test-${crypto.randomUUID()}.mp4`, duration_s: 10,
  }).select("id").single();
  if (videoError) throw videoError;
  videoId = video.id;
  const { data: drafts, error: draftError } = await privileged.from("video_drafts").insert(
    GROUP_CODES.map((group) => ({
      video_id: videoId, qgroup: group, group_name: group, question: `Q ${group}`, answer: `A ${group}`,
      source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
    }))).select("id,qgroup");
  if (draftError) throw draftError;

  for (const name of ["A", "B"]) {
    const user = await makeAnnotator(`Difficulty Test ${name}`);
    users.push(user);
    const { error: claimError } = await user.client.from("video_assignments")
      .insert({ video_id: videoId, annotator_id: user.id, status: "pending" });
    if (claimError) throw claimError;
    const { error: labelError } = await user.client.from("video_labels")
      .insert({ video_id: videoId, annotator_id: user.id, event_label: "accident" });
    check(!labelError, `${name}: event label saves without a difficulty`, labelError?.message);
    const { error: answerError } = await user.client.from("qa_annotations").insert(drafts.map((draft) => {
      const verdict = VERDICTS[name][draft.qgroup] ?? "AGREE";
      return {
        draft_id: draft.id, annotator_id: user.id, verdict,
        reason_code: verdict === "DISAGREE" ? "sai nhân quả" : null,
        human_keyframes_s: KEYFRAME_GROUPS.includes(draft.qgroup) ? [1] : [],
      };
    }));
    if (answerError) throw answerError;
    const { error: completeError } = await user.client.from("video_assignments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("video_id", videoId).eq("annotator_id", user.id);
    check(!completeError, `${name}: completes without a difficulty`, completeError?.message);
  }
  const [alice, bob] = users;

  console.log("Per annotator:");
  const { data: own, error: ownError } = await alice.client.from("annotator_difficulty")
    .select("annotator_id,disagree_count,not_answerable_count,model_errors,difficulty").eq("video_id", videoId);
  if (ownError) throw ownError;
  check(own.length === 1 && own[0].annotator_id === alice.id,
    "an annotator sees only their own row", JSON.stringify(own));
  check(Number(own[0].disagree_count) === 3 && Number(own[0].not_answerable_count) === 1,
    "disagree and not-answerable are counted apart", JSON.stringify(own[0]));
  check(Number(own[0].model_errors) === 4 && own[0].difficulty === "medium",
    "A: 4 errors is medium", JSON.stringify(own[0]));
  const { data: bobRow } = await privileged.from("annotator_difficulty")
    .select("model_errors,difficulty").eq("video_id", videoId).eq("annotator_id", bob.id).single();
  check(Number(bobRow.model_errors) === 3 && bobRow.difficulty === "medium",
    "B: 3 errors is medium", JSON.stringify(bobRow));

  console.log("Per video:");
  const { data: videoRow } = await privileged.from("video_difficulty")
    .select("annotators,model_errors,difficulty").eq("video_id", videoId).single();
  check(Number(videoRow.annotators) === 2 && Number(videoRow.model_errors) === 3.5 && videoRow.difficulty === "medium",
    "the video takes the mean of both annotators", JSON.stringify(videoRow));

  console.log("Thresholds:");
  for (const [errors, level] of [[0, "easy"], [2, "easy"], [2.5, "easy"], [3, "medium"], [5.5, "medium"], [6, "high"], [9, "high"]]) {
    const { data, error } = await alice.client.rpc("difficulty_level", { model_errors: errors });
    if (error) throw error;
    check(data === level, `${errors} errors is ${level}`, data);
  }

  if (!base) {
    console.log("\nTEST_BASE_URL not set -- skipped the HTTP half (label endpoint).");
  } else {
    console.log(`Through HTTP at ${base}:`);
    const saved = await request(base, `/api/videos/${videoId}/label`, alice.cookie, "POST", { event_label: "near-miss" });
    check(saved.status === 200 && saved.data.event_label === "near-miss",
      "label endpoint takes the event label alone", `${saved.status} ${JSON.stringify(saved.data)}`);
  }
  console.log("\nAll difficulty checks passed.");
} finally {
  if (videoId) {
    const { error } = await privileged.from("videos").delete().eq("id", videoId);
    if (error) throw new Error(`Test video cleanup failed: ${error.message}`);
  }
  for (const user of users) {
    const { error } = await privileged.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Test user cleanup failed: ${error.message}`);
  }
}
