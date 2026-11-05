// Verifies the annotator work queue end to end: a completed video leaves the
// caller's queue, progress counts it, another annotator still sees it (which
// is what keeps agreement between two annotators measurable), and finishing a
// video hands back the next one so the annotator never returns to the list.
//
//   cd frontend && node scripts/verify-annotator-queue.mjs
//   TEST_BASE_URL=http://localhost:3001 node scripts/verify-annotator-queue.mjs
//
// The HTTP half needs a server running in hosted mode; without one it is
// skipped and only the RPC half runs. Creates temporary annotators and videos,
// and removes them in the finally block.

import crypto from "node:crypto";
import { privilegedClient, signIn, request } from "./lib/session.mjs";
import { GROUP_CODES } from "./lib/qgroups.mjs";

const privileged = privilegedClient();
const base = process.env.TEST_BASE_URL;

function check(condition, name, detail) {
  if (!condition) throw new Error(`${name} failed: ${detail}`);
  console.log(`  OK  ${name}`);
}

async function makeAnnotator(label) {
  const email = `queue-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await privileged.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const { error: profileError } = await privileged.from("user_profiles").insert({
    id: data.user.id, email, name: label, role: "annotator", enabled: true,
  });
  if (profileError) throw profileError;
  const { client, cookie } = await signIn(email, password);
  return { id: data.user.id, client, cookie };
}

const groups = GROUP_CODES;
const videoIds = [];
const users = [];

// A ready video: nine drafts, so it is labelable and the queue will show it.
async function makeVideo(agreementSample) {
  const { data: video, error: videoError } = await privileged.from("videos").insert({
    drive_file_id: `queue-test-${crypto.randomUUID()}`,
    filename: `zzz-queue-test-${crypto.randomUUID()}.mp4`,
    duration_s: 10,
    agreement_sample: agreementSample,
  }).select("id").single();
  if (videoError) throw videoError;
  videoIds.push(video.id);
  const { error: draftError } = await privileged.from("video_drafts").insert(
    groups.map((group) => ({
      video_id: video.id, qgroup: group, group_name: group,
      question: `Q ${group}`, answer: `A ${group}`,
      source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
    })));
  if (draftError) throw draftError;
  return video.id;
}

// Claim, own label, nine verdicts, complete.
async function finish(user, id) {
  const { error: claimError } = await user.client.from("video_assignments")
    .insert({ video_id: id, annotator_id: user.id, status: "pending" });
  if (claimError) throw claimError;
  const { error: labelError } = await user.client.from("video_labels")
    .insert({ video_id: id, annotator_id: user.id, difficulty: "easy", event_label: "accident" });
  if (labelError) throw labelError;
  const { data: drafts, error: draftReadError } = await user.client.from("video_drafts")
    .select("id").eq("video_id", id);
  if (draftReadError) throw draftReadError;
  const { error: answerError } = await user.client.from("qa_annotations").insert(
    drafts.map((draft) => ({
      draft_id: draft.id, annotator_id: user.id, verdict: "AGREE", human_keyframes_s: [1.0],
    })));
  if (answerError) throw answerError;
  const { error: completeError } = await user.client.from("video_assignments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("video_id", id).eq("annotator_id", user.id);
  if (completeError) throw completeError;
}

try {
  const videoId = await makeVideo(true);
  const untouchedSample = await makeVideo(true);
  const soloDone = await makeVideo(false);
  const soloClaimed = await makeVideo(false);
  const soloFree = await makeVideo(false);
  const httpVideo = await makeVideo(false);

  const alice = await makeAnnotator("Queue Test Alice");
  users.push(alice);
  const bob = await makeAnnotator("Queue Test Bob");
  users.push(bob);
  const carol = await makeAnnotator("Queue Test Carol");
  users.push(carol);

  // The whole queue, not one page: the test videos sort after ~1500 real ones.
  const queueOf = async (user) => {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await user.client.rpc("annotator_queue", { page_size: 100, page_offset: offset });
      if (error) throw error;
      rows.push(...data);
      if (data.length < 100) return rows;
    }
  };
  const progressOf = async (user) => {
    const { data, error } = await user.client.rpc("annotator_progress");
    if (error) throw error;
    return data[0];
  };

  console.log("Before completion:");
  const beforeQueue = await queueOf(alice);
  const beforeRow = beforeQueue.find((row) => row.video_id === videoId);
  check(beforeRow !== undefined, "ready video appears in the queue", "not present");
  check(beforeRow.assignment_status === "available",
    "unclaimed video reports available", beforeRow.assignment_status);
  check(Number(beforeRow.answered) === 0, "answered starts at zero", beforeRow.answered);
  const beforeProgress = await progressOf(alice);
  check(Number(beforeProgress.completed) === 0,
    "progress starts with zero completed", beforeProgress.completed);
  check(Number(beforeProgress.total) >= 1,
    "progress total counts ready videos", beforeProgress.total);

  await finish(alice, videoId);

  console.log("After Alice completes it:");
  const afterQueue = await queueOf(alice);
  check(afterQueue.every((row) => row.video_id !== videoId),
    "completed video leaves the annotator's own queue", "still present");
  const afterProgress = await progressOf(alice);
  check(Number(afterProgress.completed) === 1,
    "progress counts the completed video", afterProgress.completed);
  check(Number(afterProgress.total) === Number(beforeProgress.total),
    "progress total does not shrink as work is done", afterProgress.total);

  console.log("Seen from a second annotator:");
  const bobQueue = await queueOf(bob);
  const bobRow = bobQueue.find((row) => row.video_id === videoId);
  check(bobRow !== undefined,
    "another annotator still sees it, so a second opinion stays possible", "missing");
  check(Number(bobRow.coverage) === 1,
    "coverage reflects the one finished annotator", bobRow.coverage);

  const { data: sampleRows, error: sampleError } = await privileged.from("videos")
    .select("id").eq("agreement_sample", true);
  if (sampleError) throw sampleError;
  // Real annotators work on this database too, so a sample video they already
  // took twice is past its target and rightly sorts last.
  const { data: taken, error: takenError } = await privileged.from("video_assignments")
    .select("video_id").neq("annotator_id", bob.id);
  if (takenError) throw takenError;
  const takenCount = new Map();
  for (const row of taken) takenCount.set(row.video_id, (takenCount.get(row.video_id) ?? 0) + 1);
  const sample = new Set(sampleRows.map((row) => row.id)
    .filter((id) => (takenCount.get(id) ?? 0) < 2));
  const position = (queue, id) => queue.findIndex((row) => row.video_id === id);

  console.log("Agreement ordering:");
  check(position(bobQueue, videoId) < position(bobQueue, untouchedSample),
    "an open pair comes before an untouched sample video",
    `${position(bobQueue, videoId)} vs ${position(bobQueue, untouchedSample)}`);
  const firstSolo = bobQueue.findIndex((row) => !sample.has(row.video_id));
  check(bobQueue.slice(firstSolo).every((row) => !sample.has(row.video_id)),
    "every sample video needing a label comes before every other video", `first other at ${firstSolo}`);

  await finish(bob, videoId);
  await finish(alice, soloDone);
  await bob.client.from("video_assignments")
    .insert({ video_id: soloClaimed, annotator_id: bob.id, status: "pending" });

  const carolQueue = await queueOf(carol);
  check(position(carolQueue, videoId) > position(carolQueue, soloFree),
    "a sample video with its pair drops behind unlabelled videos",
    `${position(carolQueue, videoId)} vs ${position(carolQueue, soloFree)}`);
  check(position(carolQueue, soloDone) > position(carolQueue, soloFree),
    "a single-label video someone finished drops behind unlabelled ones",
    `${position(carolQueue, soloDone)} vs ${position(carolQueue, soloFree)}`);
  check(position(carolQueue, soloClaimed) > position(carolQueue, soloFree),
    "a single-label video someone claimed drops behind unlabelled ones",
    `${position(carolQueue, soloClaimed)} vs ${position(carolQueue, soloFree)}`);
  check(position(carolQueue, videoId) >= 0,
    "a video past its target is still reachable", "missing");
  const bobAfter = await queueOf(bob);
  check(bobAfter[0].video_id === soloClaimed,
    "the caller's own open claim comes first", bobAfter[0].video_id);

  const started = performance.now();
  await carol.client.rpc("annotator_queue", { page_size: 12, page_offset: 0 });
  console.log(`      one queue page took ${Math.round(performance.now() - started)} ms`);

  if (!base) {
    console.log("\nTEST_BASE_URL not set -- skipped the HTTP half (queue page, next-video handoff).");
  } else {
    console.log(`Through HTTP at ${base}:`);
    const page = await request(base, "/annotate", bob.cookie);
    check(page.status === 200, "queue page renders for an annotator", page.status);
    check(typeof page.data === "string" && page.data.includes("Bạn đã gán nhãn"),
      "queue page shows the annotator's own progress", "progress text missing");

    // Bob finishes a video through the real endpoints, and the completion
    // response must point at something else to work on.
    await request(base, `/api/videos/${httpVideo}/claim`, bob.cookie, "POST");
    const { error: bobLabelError } = await bob.client.from("video_labels")
      .insert({ video_id: httpVideo, annotator_id: bob.id, difficulty: "medium", event_label: "near-miss" });
    if (bobLabelError) throw bobLabelError;
    const { data: bobDrafts } = await bob.client.from("video_drafts").select("id").eq("video_id", httpVideo);
    const { error: bobAnswerError } = await bob.client.from("qa_annotations").insert(
      bobDrafts.map((draft) => ({
        draft_id: draft.id, annotator_id: bob.id, verdict: "AGREE", human_keyframes_s: [2.0],
      })));
    if (bobAnswerError) throw bobAnswerError;

    const completed = await request(base, `/api/videos/${httpVideo}/complete`, bob.cookie, "POST");
    check(completed.status === 200, "complete endpoint succeeds", completed.status);
    check(completed.data.status === "completed", "assignment is marked completed", completed.data.status);
    check(completed.data.next_video_id !== httpVideo,
      "the next video is never the one just finished", completed.data.next_video_id);
    check("next_video_id" in completed.data,
      "complete reports where to go next so the list is not needed", "field missing");
    console.log(`      next video handed back: ${completed.data.next_filename ?? "(none left)"}`);
  }

  console.log("\nAll annotator queue checks passed.");
} finally {
  if (videoIds.length) {
    const { error } = await privileged.from("videos").delete().in("id", videoIds);
    if (error) throw new Error(`Test video cleanup failed: ${error.message}`);
  }
  for (const user of users) {
    const { error } = await privileged.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Test user cleanup failed: ${error.message}`);
  }
}
