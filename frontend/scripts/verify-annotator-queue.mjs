// Verifies the annotator work queue end to end: a completed video leaves the
// caller's queue, progress counts it, another annotator still sees it (which
// is what keeps agreement between two annotators measurable), and finishing a
// video hands back the next one so the annotator never returns to the list.
//
//   cd frontend && node scripts/verify-annotator-queue.mjs
//   TEST_BASE_URL=http://localhost:3001 node scripts/verify-annotator-queue.mjs
//
// The HTTP half needs a server running in hosted mode; without one it is
// skipped and only the RPC half runs. Creates two temporary annotators and one
// temporary video, and removes all three in the finally block.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env.local"), "utf8")
  .replace(/^﻿/, "").split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => { const equal = line.indexOf("="); return [line.slice(0, equal), line.slice(equal + 1).trim()]; }));

const privileged = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

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
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // A second, cookie-backed session so the same account can also drive the
  // Next.js routes the way a browser does.
  const jar = new Map();
  const browser = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
  const { error: cookieSignInError } = await browser.auth.signInWithPassword({ email, password });
  if (cookieSignInError) throw cookieSignInError;
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return { id: data.user.id, client, cookie };
}

const base = process.env.TEST_BASE_URL;
async function request(pathname, cookie, method = "GET") {
  const response = await fetch(base + pathname, {
    method, cache: "no-store", redirect: "manual",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
    body: method === "POST" ? "{}" : undefined,
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data };
}

const groups = ["S", "E", "N", "C", "V", "O", "R", "Attr", "Prev"];
let videoId;
const users = [];

try {
  // A ready video: nine drafts, so it is labelable and the queue will show it.
  const { data: video, error: videoError } = await privileged.from("videos").insert({
    drive_file_id: `queue-test-${crypto.randomUUID()}`,
    filename: `zzz-queue-test-${crypto.randomUUID()}.mp4`,
    duration_s: 10,
  }).select("id").single();
  if (videoError) throw videoError;
  videoId = video.id;
  const { error: draftError } = await privileged.from("video_drafts").insert(
    groups.map((group) => ({
      video_id: videoId, qgroup: group, group_name: group,
      question: `Q ${group}`, answer: `A ${group}`,
      source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
    })));
  if (draftError) throw draftError;

  const alice = await makeAnnotator("Queue Test Alice");
  users.push(alice);
  const bob = await makeAnnotator("Queue Test Bob");
  users.push(bob);

  const queueOf = async (user) => {
    const { data, error } = await user.client.rpc("annotator_queue", { page_size: 100, page_offset: 0 });
    if (error) throw error;
    return data;
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

  // Alice does the whole video: claim, own label, nine verdicts, complete.
  const { error: claimError } = await alice.client.from("video_assignments")
    .insert({ video_id: videoId, annotator_id: alice.id, status: "pending" });
  if (claimError) throw claimError;
  const { error: labelError } = await alice.client.from("video_labels")
    .insert({ video_id: videoId, annotator_id: alice.id, difficulty: "easy", event_label: "accident" });
  if (labelError) throw labelError;
  const { data: drafts, error: draftReadError } = await alice.client.from("video_drafts")
    .select("id").eq("video_id", videoId);
  if (draftReadError) throw draftReadError;
  const { error: answerError } = await alice.client.from("qa_annotations").insert(
    drafts.map((draft) => ({
      draft_id: draft.id, annotator_id: alice.id, verdict: "AGREE", human_keyframes_s: [1.0],
    })));
  if (answerError) throw answerError;
  const { error: completeError } = await alice.client.from("video_assignments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("video_id", videoId).eq("annotator_id", alice.id);
  if (completeError) throw completeError;

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

  // Coverage ordering is what stops every annotator from piling onto the same
  // first page while the tail of the dataset never gets labelled.
  const coverages = bobQueue.map((row) => Number(row.coverage));
  check(coverages.every((value, index) => index === 0 || coverages[index - 1] <= value),
    "queue is ordered by coverage ascending", coverages.join(","));

  if (!base) {
    console.log("\nTEST_BASE_URL not set -- skipped the HTTP half (queue page, next-video handoff).");
  } else {
    console.log(`Through HTTP at ${base}:`);
    const page = await request("/annotate", bob.cookie);
    check(page.status === 200, "queue page renders for an annotator", page.status);
    check(typeof page.data === "string" && page.data.includes("Bạn đã gán nhãn"),
      "queue page shows the annotator's own progress", "progress text missing");

    // Bob finishes the test video through the real endpoints, and the
    // completion response must point at something else to work on.
    await request(`/api/videos/${videoId}/claim`, bob.cookie, "POST");
    const { error: bobLabelError } = await bob.client.from("video_labels")
      .insert({ video_id: videoId, annotator_id: bob.id, difficulty: "medium", event_label: "near-miss" });
    if (bobLabelError) throw bobLabelError;
    const { data: bobDrafts } = await bob.client.from("video_drafts").select("id").eq("video_id", videoId);
    const { error: bobAnswerError } = await bob.client.from("qa_annotations").insert(
      bobDrafts.map((draft) => ({
        draft_id: draft.id, annotator_id: bob.id, verdict: "AGREE", human_keyframes_s: [2.0],
      })));
    if (bobAnswerError) throw bobAnswerError;

    const completed = await request(`/api/videos/${videoId}/complete`, bob.cookie, "POST");
    check(completed.status === 200, "complete endpoint succeeds", completed.status);
    check(completed.data.status === "completed", "assignment is marked completed", completed.data.status);
    check(completed.data.next_video_id !== videoId,
      "the next video is never the one just finished", completed.data.next_video_id);
    check("next_video_id" in completed.data,
      "complete reports where to go next so the list is not needed", "field missing");
    console.log(`      next video handed back: ${completed.data.next_filename ?? "(none left)"}`);
  }

  console.log("\nAll annotator queue checks passed.");
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
