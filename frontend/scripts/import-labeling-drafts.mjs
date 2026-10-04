import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { REPO_ROOT } from "./lib/env.mjs";
import { privilegedClient } from "./lib/session.mjs";
import { GROUP_CODES as groups, GROUP_NAMES as names } from "./lib/qgroups.mjs";

const root = REPO_ROOT;
const admin = privilegedClient();
const db = new DatabaseSync(path.join(root, "annotations.db"), { readOnly: true });
const clips = [
  { clip: "0aD5Bbh_GgU_097200_166733", driveId: "1g9rg1kiw_35L4ibBrcj5r56YTu1pGM0u" },
  { clip: "0aD5Bbh_GgU_238100_278566", driveId: "1zkqvBqi6Xvm1pcvckDmpf_t3PvUIP7pC" },
];

for (const { clip, driveId } of clips) {
  const filename = `${clip}_t01.mp4`;
  const videoPath = path.join(root, "work", "0aD5Bbh_GgU", "trimmed", filename);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(videoPath)).digest("hex");
  const rows = db.prepare(`select * from qa_drafts where clip_id = ? and shot = 1
    and prompt_version = (select max(prompt_version) from qa_drafts where clip_id = ? and shot = 1)`)
    .all(clip, clip);
  if (rows.length !== 9 || new Set(rows.map((row) => row.qgroup)).size !== 9 ||
      rows.some((row) => row.source_sha256 !== hash)) {
    throw new Error(`Nine verified latest drafts are unavailable for ${clip}`);
  }
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "json", videoPath], { encoding: "utf8" }));
  const duration = Number(Number(probe.format.duration).toFixed(3));
  const { data: existing, error: lookupError } = await admin.from("videos")
    .select("id").eq("drive_file_id", driveId).maybeSingle();
  if (lookupError) throw lookupError;
  const videoResult = existing
    ? await admin.from("videos").update({ filename, duration_s: duration, available: true, status: "active" })
      .eq("id", existing.id).select("id").single()
    : await admin.from("videos").insert({ drive_file_id: driveId, filename, duration_s: duration })
      .select("id").single();
  if (videoResult.error || !videoResult.data) throw videoResult.error ?? new Error("Video import failed");
  const videoId = videoResult.data.id;
  for (const group of groups) {
    const row = rows.find((item) => item.qgroup === group);
    const payload = {
      video_id: videoId, qgroup: group, group_name: names[group], question: row.question,
      answer: row.answer, source_sha256: hash, prompt_version: row.prompt_version,
      predicted_keyframes_s: JSON.parse(row.keyframes_s || "[]"),
      frame_times_s: JSON.parse(row.frame_times_s || "[]"),
      truncated: !!row.truncated, completion_tokens: row.completion_tokens, latency_ms: row.latency_ms,
    };
    const { data: draft, error: draftLookupError } = await admin.from("video_drafts")
      .select("id").eq("video_id", videoId).eq("qgroup", group).maybeSingle();
    if (draftLookupError) throw draftLookupError;
    const result = draft
      ? await admin.from("video_drafts").update(payload).eq("id", draft.id)
      : await admin.from("video_drafts").insert(payload);
    if (result.error) throw result.error;
  }
  console.log(`Imported ${clip}: 9 latest drafts, H.264 video, SHA-256 verified`);
}
db.close();
