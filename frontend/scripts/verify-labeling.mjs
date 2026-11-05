import crypto from "node:crypto";
import { adminCredentials } from "./lib/env.mjs";
import { privilegedClient, signIn, request as httpRequest } from "./lib/session.mjs";
import { GROUP_CODES, KEYFRAME_GROUPS } from "./lib/qgroups.mjs";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const privileged = privilegedClient();
const { email: adminEmail, password: adminPassword } = adminCredentials();
const request = (pathname, cookie, method, body) => httpRequest(base, pathname, cookie, method, body);

function expect(result, status, name) {
  if (result.status !== status) throw new Error(`${name}: expected ${status}, got ${result.status}: ${JSON.stringify(result.data).slice(0, 300)}`);
}
const admin = await signIn(adminEmail, adminPassword);
const tempEmail = `qa-test-${crypto.randomUUID()}@example.com`;
const tempPassword = crypto.randomBytes(24).toString("base64url");
let videoId;
let testUserId;
try {
  const { data: video, error: videoError } = await privileged.from("videos").insert({
    drive_file_id: `test-${crypto.randomUUID()}`, filename: "temporary-labeling-test.mp4", duration_s: 5.9,
  }).select("id").single();
  if (videoError || !video) throw videoError ?? new Error("Test video creation failed");
  videoId = video.id;
  const groups = GROUP_CODES;
  const header = "video_id,qgroup,question,answer,difficulty,event_label";
  const lines = groups.map((group) => `${videoId},${group},Question ${group},Answer ${group},medium,near-miss`);
  const form = new FormData();
  form.set("file", new File([[header, ...lines].join("\n")], "labeling.csv", { type: "text/csv" }));
  expect(await request(`/api/admin/videos/${videoId}/drafts`, admin.cookie, "POST", form), 200, "CSV upload");
  const { data: drafts, error: draftError } = await admin.client.from("video_drafts")
    .select("id,qgroup").eq("video_id", videoId);
  if (draftError || drafts.length !== 9) throw new Error("CSV did not create nine drafts");
  console.log("Admin CSV import: OK");

  const created = await request("/api/admin/users", admin.cookie, "POST", {
    email: tempEmail, name: "QA Test", password: tempPassword, role: "annotator",
  });
  expect(created, 201, "User creation");
  testUserId = created.data.id;
  const annotator = await signIn(tempEmail, tempPassword);
  const { data: references, error: referenceError } = await annotator.client.from("video_reference_labels")
    .select("video_id").eq("video_id", videoId);
  if (!referenceError && references.length) throw new Error("Annotator can read hidden reference label");
  expect(await request(`/annotate/${videoId}`, annotator.cookie), 200, "Labeling page");
  expect(await request(`/api/videos/${videoId}/claim`, annotator.cookie, "POST", {}), 201, "Claim video");
  expect(await request(`/api/videos/${videoId}/label`, annotator.cookie, "POST",
    { difficulty: "easy", event_label: "accident" }), 200, "Independent video label");
  // Evidence frames only where the answer rests on one moment: C, V, Attr.
  const groupDraft = (code) => drafts.find((draft) => draft.qgroup === code);
  for (const code of KEYFRAME_GROUPS) {
    expect(await request(`/api/drafts/${groupDraft(code).id}/annotation`, annotator.cookie, "POST",
      { verdict: "AGREE", human_keyframes_s: [] }), 422, `Reject ${code} without evidence`);
  }
  const { error: triggerError } = await annotator.client.from("qa_annotations").insert({
    draft_id: groupDraft("C").id, annotator_id: testUserId, verdict: "AGREE", human_keyframes_s: [],
  });
  if (!triggerError) throw new Error("Database accepted C without evidence");
  expect(await request(`/api/drafts/${groupDraft("S").id}/annotation`, annotator.cookie, "POST",
    { verdict: "AGREE", human_keyframes_s: [] }), 200, "Save S without evidence");
  for (const draft of drafts.filter((item) => item.qgroup !== "S")) {
    expect(await request(`/api/drafts/${draft.id}/annotation`, annotator.cookie, "POST",
      { verdict: "AGREE", human_keyframes_s: [0.5] }), 200, `Save ${draft.qgroup}`);
  }
  const { data: savedMarks } = await annotator.client.from("qa_annotations")
    .select("draft_id,human_keyframes_s").eq("annotator_id", testUserId);
  for (const draft of drafts) {
    const marks = savedMarks.find((row) => row.draft_id === draft.id)?.human_keyframes_s ?? [];
    const expected = KEYFRAME_GROUPS.includes(draft.qgroup) ? 1 : 0;
    if (marks.length !== expected) throw new Error(`${draft.qgroup} stored ${marks.length} evidence frames, expected ${expected}`);
  }
  expect(await request(`/api/videos/${videoId}/complete`, annotator.cookie, "POST", {}), 200, "Complete nine drafts");
  const { data: ownLabel } = await annotator.client.from("video_labels").select("difficulty,event_label")
    .eq("video_id", videoId).single();
  if (ownLabel?.difficulty !== "easy" || ownLabel?.event_label !== "accident") {
    throw new Error("Independent annotation label was altered by reference CSV");
  }
  const secondForm = new FormData();
  secondForm.set("file", new File([[header, ...lines].join("\n")], "labeling.csv", { type: "text/csv" }));
  expect(await request(`/api/admin/videos/${videoId}/drafts`, admin.cookie, "POST", secondForm), 422,
    "Reject replacement after labeling");
  expect(await request("/admin/users", annotator.cookie), 307, "Admin page denied");
  expect(await request(`/api/admin/users/${testUserId}`, annotator.cookie, "DELETE"), 403, "Delete denied");
  expect(await request(`/api/admin/users/${testUserId}`, admin.cookie, "DELETE"), 200, "Admin user delete");
  testUserId = undefined;
  console.log("Annotator labeling, evidence only for C/V/Attr, hidden reference, completion, role guard, and admin delete: OK");
} finally {
  if (testUserId) {
    const { error } = await privileged.auth.admin.deleteUser(testUserId);
    if (error) throw new Error(`Test user cleanup failed: ${error.message}`);
  }
  if (videoId) {
    const { error } = await privileged.from("videos").delete().eq("id", videoId);
    if (error) throw new Error(`Test video cleanup failed: ${error.message}`);
  }
}
