// Create disposable accounts for recording the report and peer-help tutorial.
// This script only connects to the local Supabase stack.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, refuseUnlessLocal, REPO_ROOT } from "./lib/env.mjs";
import { privilegedClient } from "./lib/session.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
const db = privilegedClient();
const outDir = path.join(REPO_ROOT, "annotator-guidelines", "report-help-video", "output");
const file = path.join(outDir, "fixture.json");
if (fs.existsSync(file)) {
  console.log(`Tutorial fixture already exists: ${file}`);
  process.exit(0);
}

const welcome = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "annotator-guidelines", "welcome-video", "output", "fixture.json"), "utf8"));
const sourceVideoId = welcome.videos.near_miss;
const { data: sourceVideo, error: sourceError } = await db.from("videos").select("id,duration_s").eq("id", sourceVideoId).single();
if (sourceError || !sourceVideo) throw new Error("The local welcome demo video is missing. Recreate it before recording this tutorial.");
const { data: sourceDrafts, error: draftsError } = await db.from("video_drafts")
  .select("qgroup,group_name,question,answer,source_sha256,source_kind,prompt_version").eq("video_id", sourceVideoId);
if (draftsError || !sourceDrafts?.length) throw new Error("The local welcome demo drafts are missing.");
const stamp = Date.now();
const { data: video, error: videoError } = await db.from("videos").insert({
  drive_file_id: `report-help-demo-${stamp}`,
  filename: `report-help-demo-${stamp}.mp4`,
  duration_s: sourceVideo.duration_s,
  agreement_sample: false,
}).select("id,seq,filename").single();
if (videoError || !video) throw videoError ?? new Error("Could not create tutorial video");
const { error: copyError } = await db.from("video_drafts").insert(sourceDrafts.map((draft) => ({ ...draft, video_id: video.id })));
if (copyError) throw copyError;
const videoId = video.id;

const users = {};
for (const [key, name, role] of [
  ["reporter", "Demo Người báo cáo", "annotator"],
  ["peerOne", "Demo Người hỗ trợ 1", "annotator"],
  ["peerTwo", "Demo Người hỗ trợ 2", "annotator"],
  ["admin", "Demo Admin phân xử", "admin"],
]) {
  const email = `report-help-${key}-${Date.now()}@local.test`;
  const password = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { error: profileError } = await db.from("user_profiles").upsert({
    id: data.user.id, email, name, role, enabled: true,
  });
  if (profileError) throw profileError;
  users[key] = { id: data.user.id, email, password };
}

const { error: assignmentError } = await db.from("video_assignments").insert({
  video_id: videoId, annotator_id: users.reporter.id, status: "pending", answer_format: "slots",
});
if (assignmentError) throw assignmentError;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(file, JSON.stringify({ video, users }, null, 2), { mode: 0o600 });
console.log(`Created local tutorial fixture for video #${video.seq} with four disposable users.`);
