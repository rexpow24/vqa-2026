// Verifies qa_annotation_revisions: every saved version of an answer is kept,
// unchanged re-saves add nothing, a delete is recorded, and annotators can
// read only their own history and never write it.
//
//   cd frontend && node scripts/verify-revisions.mjs
//   TEST_BASE_URL=https://vqa-vn-traffic-labeling.vercel.app node scripts/verify-revisions.mjs
//
// The HTTP half (two saves through the annotation API) needs a hosted server;
// without TEST_BASE_URL it is skipped. Creates two temporary annotators and one
// temporary video, and removes them in the finally block.

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
  const email = `revisions-test-${crypto.randomUUID()}@example.com`;
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

async function history(draftId, annotatorId) {
  const { data, error } = await privileged.from("qa_annotation_revisions")
    .select("id,op,verdict,reason_code,edited_answer,human_keyframes_s,revised_at")
    .eq("draft_id", draftId).eq("annotator_id", annotatorId).order("id");
  if (error) throw error;
  return data;
}

let videoId;
const users = [];
try {
  const { data: video, error: videoError } = await privileged.from("videos").insert({
    drive_file_id: `revisions-test-${crypto.randomUUID()}`,
    filename: `zzz-revisions-test-${crypto.randomUUID()}.mp4`, duration_s: 10, agreement_sample: true,
  }).select("id").single();
  if (videoError) throw videoError;
  videoId = video.id;
  const { data: drafts, error: draftError } = await privileged.from("video_drafts").insert(
    GROUP_CODES.map((group) => ({
      video_id: videoId, qgroup: group, group_name: group, question: `Q ${group}`, answer: `A ${group}`,
      source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
    }))).select("id,qgroup");
  if (draftError) throw draftError;
  const s = drafts.find((draft) => draft.qgroup === "S");
  const c = drafts.find((draft) => draft.qgroup === "C");

  for (const name of ["A", "B"]) {
    const user = await makeAnnotator(`Revisions Test ${name}`);
    users.push(user);
    const { error } = await privileged.from("video_assignments")
      .insert({ video_id: videoId, annotator_id: user.id, status: "pending" });
    if (error) throw error;
  }
  const [alice, bob] = users;
  const upsert = (user, row) => user.client.from("qa_annotations")
    .upsert({ draft_id: s.id, annotator_id: user.id, human_keyframes_s: [], ...row }, { onConflict: "draft_id,annotator_id" });

  console.log("Versions:");
  if ((await upsert(alice, { verdict: "AGREE" })).error) throw new Error("first save failed");
  let rows = await history(s.id, alice.id);
  check(rows.length === 1 && rows[0].op === "INSERT" && rows[0].verdict === "AGREE",
    "the first save is revision 1", JSON.stringify(rows));

  if ((await upsert(alice, { verdict: "DISAGREE", reason_code: "sai nhân quả", edited_answer: "Fixed" })).error) {
    throw new Error("second save failed");
  }
  rows = await history(s.id, alice.id);
  check(rows.length === 2 && rows[0].verdict === "AGREE" && rows[1].op === "UPDATE" &&
    rows[1].verdict === "DISAGREE" && rows[1].edited_answer === "Fixed",
    "an edit adds revision 2 and keeps revision 1 as it was", JSON.stringify(rows));

  if ((await upsert(alice, { verdict: "DISAGREE", reason_code: "sai nhân quả", edited_answer: "Fixed" })).error) {
    throw new Error("unchanged save failed");
  }
  check((await history(s.id, alice.id)).length === 2, "an unchanged re-save adds nothing", "");

  if ((await upsert(bob, { verdict: "NOT_ANSWERABLE" })).error) throw new Error("bob save failed");
  check((await history(s.id, alice.id)).length === 2 && (await history(s.id, bob.id)).length === 1,
    "two annotators on one question keep separate histories", "");

  const { error: frameError } = await alice.client.from("qa_annotations")
    .insert({ draft_id: c.id, annotator_id: alice.id, verdict: "AGREE", human_keyframes_s: [1, 2.5] });
  if (frameError) throw frameError;
  rows = await history(c.id, alice.id);
  check(rows.length === 1 && rows[0].human_keyframes_s.map(Number).join() === "1,2.5",
    "keyframes are kept in the revision", JSON.stringify(rows));

  const { error: deleteError } = await alice.client.from("qa_annotations").delete()
    .eq("draft_id", c.id).eq("annotator_id", alice.id);
  if (deleteError) throw deleteError;
  rows = await history(c.id, alice.id);
  check(rows.length === 2 && rows[1].op === "DELETE" && rows[1].verdict === "AGREE",
    "a delete is recorded with the last values", JSON.stringify(rows));

  console.log("Access:");
  const { data: own, error: ownError } = await alice.client.from("qa_annotation_revisions")
    .select("annotator_id").eq("draft_id", s.id);
  if (ownError) throw ownError;
  check(own.length === 2 && own.every((row) => row.annotator_id === alice.id),
    "an annotator reads only their own history", JSON.stringify(own));
  const forged = await alice.client.from("qa_annotation_revisions")
    .insert({ draft_id: s.id, annotator_id: alice.id, op: "INSERT", verdict: "AGREE", human_keyframes_s: [] });
  check(Boolean(forged.error), "an annotator cannot write history directly", JSON.stringify(forged));
  await alice.client.from("qa_annotation_revisions").delete().eq("draft_id", s.id);
  await alice.client.from("qa_annotation_revisions").update({ verdict: "AGREE" }).eq("draft_id", s.id);
  rows = await history(s.id, alice.id);
  check(rows.length === 2 && rows[1].verdict === "DISAGREE",
    "an annotator cannot change or delete history", JSON.stringify(rows));

  if (!base) {
    console.log("\nTEST_BASE_URL not set -- skipped the HTTP half (annotation endpoint).");
  } else {
    console.log(`Through HTTP at ${base}:`);
    const e = drafts.find((draft) => draft.qgroup === "E");
    for (const verdict of ["AGREE", "NOT_ANSWERABLE"]) {
      const saved = await request(base, `/api/drafts/${e.id}/annotation`, bob.cookie, "POST",
        { verdict, human_keyframes_s: [] });
      if (saved.status !== 200) throw new Error(`save failed: ${saved.status} ${JSON.stringify(saved.data)}`);
    }
    rows = await history(e.id, bob.id);
    check(rows.map((row) => row.verdict).join() === "AGREE,NOT_ANSWERABLE",
      "two saves through the API leave two revisions", JSON.stringify(rows));
  }
  console.log("\nAll revision checks passed.");
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
