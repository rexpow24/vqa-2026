// Create a disposable local annotator for the welcome recording.
// Existing accounts and their answers are left untouched.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, refuseUnlessLocal, FRONTEND_DIR, REPO_ROOT } from "./lib/env.mjs";
import { privilegedClient } from "./lib/session.mjs";
import { GROUP_NAMES } from "./lib/qgroups.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
const db = privilegedClient();
const out = path.join(REPO_ROOT, "annotator-guidelines", "welcome-video", "output");
const fixtures = JSON.parse(fs.readFileSync(path.join(FRONTEND_DIR, "scripts", "fixtures", "review-fixtures.json"), "utf8"));
fs.mkdirSync(out, { recursive: true });
const credentials = path.join(out, "fixture.json");
if (fs.existsSync(credentials)) {
  console.log(`Fixture already exists: ${credentials}`);
  process.exit(0);
}
const email = `welcome-video-${Date.now()}@local.test`;
const password = crypto.randomBytes(24).toString("base64url");
const { data: user, error: userError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (userError) throw userError;
const { error: profileError } = await db.from("user_profiles").upsert({
  id: user.user.id, email, name: "Welcome Video Demo", role: "annotator", enabled: true,
});
if (profileError) throw profileError;
const videos = {};
for (const name of ["near_miss", "k18"]) {
  const fixture = fixtures.find((item) => item.case === name);
  const { data: video, error: videoError } = await db.from("videos").insert({
    drive_file_id: `welcome-demo-${name}-${Date.now()}`,
    filename: `welcome-demo-${name}-${Date.now()}.mp4`,
    duration_s: fixture.duration_s, agreement_sample: false,
  }).select("id,filename").single();
  if (videoError) throw videoError;
  const groups = ["S", "E", "N", "C", "O", "R", "Attr", "Prev"];
  const { error: draftError } = await db.from("video_drafts").insert(groups.map((qgroup) => ({
    video_id: video.id, qgroup, group_name: GROUP_NAMES[qgroup],
    question: fixture.drafts[qgroup].question, answer: fixture.drafts[qgroup].answer,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  })));
  if (draftError) throw draftError;
  const { error: assignmentError } = await db.from("video_assignments").insert({
    video_id: video.id, annotator_id: user.user.id, status: "pending", answer_format: "slots",
  });
  if (assignmentError) throw assignmentError;
  videos[name] = video.id;
}
fs.writeFileSync(credentials, JSON.stringify({ email, password, videos }, null, 2));
console.log("Created disposable local annotator with near-miss and follow-up videos.");
