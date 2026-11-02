// One-off bulk import of csvs/vqa_output.csv into videos + video_drafts.
// The admin form takes one video per upload, which does not scale to 1496.
// Idempotent: safe to re-run. Pass --apply to write; default is a dry run.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { REPO_ROOT } from "./lib/env.mjs";
import { privilegedClient } from "./lib/session.mjs";
import { GROUP_CODES as groups, GROUP_NAMES as names } from "./lib/qgroups.mjs";

const apply = process.argv.includes("--apply");
const admin = privilegedClient();
const read = (name) => parse(fs.readFileSync(path.join(REPO_ROOT, "csvs", name)), { columns: true, bom: true });

async function selectAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const manifest = [...read("videos.csv"), ...read("videos-quyen.csv")];
const manifestIds = new Set(manifest.map((row) => row.drive_file_id));
const answers = new Map();
for (const row of read("vqa_output.csv")) {
  if (!answers.has(row.id)) answers.set(row.id, new Map());
  answers.get(row.id).set(row.question_group, row);
}
if (manifest.length !== 1496 || manifestIds.size !== 1496 || answers.size !== 1496 ||
    [...answers.values()].some((byGroup) => groups.some((group) => !byGroup.has(group)))) {
  throw new Error("Sources are not 1496 videos with nine groups each");
}

// Filename is unique in the database, so a clip whose name is taken has two cases:
// the holder is outside the manifest (stale row: repoint it to the manifest's Drive
// file), or inside it (a second cut under the same name: insert with a suffix).
const stored = await selectAll("videos", "id,drive_file_id,filename");
const byDrive = new Map(stored.map((video) => [video.drive_file_id, video]));
const byName = new Map(stored.map((video) => [video.filename, video]));
const inserts = [];
const repoints = [];
for (const row of manifest) {
  if (byDrive.has(row.drive_file_id)) continue;
  const holder = byName.get(row.filename);
  if (holder && !manifestIds.has(holder.drive_file_id)) repoints.push({ row, holder });
  else inserts.push({
    drive_file_id: row.drive_file_id,
    filename: holder ? row.filename.replace(/\.mp4$/, "_v2.mp4") : row.filename,
    duration_s: Number(row.duration_s), status: "active", available: true,
  });
}
console.log("stored", stored.length, "| insert", inserts, "| repoint", repoints.map(({ row, holder }) =>
  `${row.filename}: ${holder.drive_file_id} -> ${row.drive_file_id}`));
const repointed = new Set(repoints.map(({ holder }) => holder.id));
const extra = stored.filter((video) => !manifestIds.has(video.drive_file_id) && !repointed.has(video.id));
if (extra.length) throw new Error(`Videos outside the manifest: ${extra.map((video) => video.filename)}`);
if (!apply) { console.log("Dry run. Re-run with --apply."); process.exit(0); }

for (const { row, holder } of repoints) {
  const { error } = await admin.from("videos")
    .update({ drive_file_id: row.drive_file_id, duration_s: Number(row.duration_s) }).eq("id", holder.id);
  if (error) throw error;
}
if (inserts.length) {
  const { error } = await admin.from("videos").insert(inserts);
  if (error) throw error;
}

const videos = await selectAll("videos", "id,drive_file_id,filename,status");
const idOfDrive = new Map(videos.map((video) => [video.drive_file_id, video.id]));
const drafts = manifest.flatMap((row) => {
  const hash = crypto.createHash("sha256").update(JSON.stringify(groups.map((group) => {
    const { question, answer } = answers.get(row.drive_file_id).get(group);
    return [group, question, answer];
  }))).digest("hex");
  return groups.map((group) => {
    const { question, answer } = answers.get(row.drive_file_id).get(group);
    return { video_id: idOfDrive.get(row.drive_file_id), qgroup: group, group_name: names[group],
      question: question.trim(), answer: answer.trim(), source_sha256: hash, source_kind: "admin_csv", prompt_version: 0 };
  });
});
for (let from = 0; from < drafts.length; from += 500) {
  const { error } = await admin.from("video_drafts")
    .upsert(drafts.slice(from, from + 500), { onConflict: "video_id,qgroup" });
  if (error) throw error;
}

// Read back and compare against the source, not against what was just sent.
const saved = await selectAll("video_drafts", "video_id,qgroup,question,answer");
const driveOfId = new Map(videos.map((video) => [video.id, video.drive_file_id]));
const wrong = saved.filter((draft) => {
  const source = answers.get(driveOfId.get(draft.video_id))?.get(draft.qgroup);
  return !source || source.question.trim() !== draft.question || source.answer.trim() !== draft.answer;
});
const active = videos.filter((video) => video.status === "active").length;
console.log({ videos: videos.length, active, drafts: saved.length, wrong: wrong.length });
if (videos.length !== 1496 || active !== 1496 || saved.length !== 13464 || wrong.length) process.exit(1);

// The earlier export carried generated UUIDs; rewrite it with the real ones.
const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const lines = ["video_id,qgroup,question,answer,difficulty,event_label", ...drafts.map((draft) =>
  [draft.video_id, draft.qgroup, draft.question, draft.answer, "", ""].map(cell).join(","))];
fs.writeFileSync(path.join(REPO_ROOT, "csvs", "labeling_all.csv"), `﻿${lines.join("\r\n")}\r\n`);
fs.rmSync(path.join(REPO_ROOT, "csvs", "labeling_video_map.csv"), { force: true });
console.log("Rewrote csvs/labeling_all.csv with database UUIDs");
