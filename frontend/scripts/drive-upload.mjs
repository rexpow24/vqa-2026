// Uploads every finished/*.mp4 into the configured Drive folder and writes
// videos.csv -- the metadata CSV the bulk importer consumes.
//
//   cd frontend && node scripts/drive-upload.mjs [--out ../videos.csv] [--limit N]
//
// Run scripts/drive-auth.mjs once first.
//
// Resumable by design: the output CSV is both the result and the ledger. A
// filename already present in it is skipped, so an interrupted run continues
// where it stopped instead of uploading duplicates. This also means the
// drive.file scope is enough -- the script never has to list the folder, and
// therefore never needs read access to the rest of your Drive.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { OAuth2Client } from "google-auth-library";
import { drive_v3 } from "@googleapis/drive";

const root = process.cwd();
const repoRoot = path.resolve(root, "..");
const args = process.argv.slice(2);
// indexOf returns -1 when a flag is absent, and -1 + 1 indexes the first
// argument -- so a bare `--limit 2` would silently be read as the --out value.
function flag(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}
const outPath = path.resolve(repoRoot, flag("--out", "videos.csv"));
const limitRaw = flag("--limit", null);
const limit = limitRaw === null ? Infinity : Number(limitRaw);
if (!Number.isFinite(limit) || limit <= 0) throw new Error(`--limit needs a positive number, got ${limitRaw}`);

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8")
    .replace(/^﻿/, "").split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
}
const env = { ...readEnv(path.join(repoRoot, ".env")), ...readEnv(path.join(root, ".env.local")) };
const tokenPath = path.join(root, ".drive-token.json");
if (!fs.existsSync(tokenPath)) throw new Error("No .drive-token.json -- run: node scripts/drive-auth.mjs");
// Accept either a bare id or a pasted Drive URL. Copying the folder link out
// of the browser is the obvious way to get this value, and a pasted URL would
// otherwise fail deep inside the API with an unhelpful 404.
function folderIdFrom(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  const fromUrl = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  const id = fromUrl ? fromUrl[1] : trimmed;
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
}
const folderId = folderIdFrom(env.GOOGLE_DRIVE_FOLDER_ID);
if (!folderId) {
  throw new Error(`GOOGLE_DRIVE_FOLDER_ID in frontend/.env.local is missing or unreadable.
Paste either the folder id or the whole folder URL, for example:
  GOOGLE_DRIVE_FOLDER_ID=1zhu74upu6MK4ZDwHWqd7HbKmGOJE_e1V
  GOOGLE_DRIVE_FOLDER_ID=https://drive.google.com/drive/folders/1zhu74upu6MK4ZDwHWqd7HbKmGOJE_e1V`);
}

const auth = new OAuth2Client({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET });
auth.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf8")));
const drive = new drive_v3.Drive({ auth });

const finishedDir = path.join(repoRoot, "finished");
if (!fs.existsSync(finishedDir)) throw new Error(`No such folder: ${finishedDir}`);
const files = fs.readdirSync(finishedDir).filter((name) => name.toLowerCase().endsWith(".mp4")).sort();

// Existing rows are the resume ledger; keep them verbatim so a partial CSV is
// never rewritten or reordered under the user.
const HEADER = "filename,drive_file_id,duration_s";
const existing = new Map();
if (fs.existsSync(outPath)) {
  for (const line of fs.readFileSync(outPath, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("filename,")) continue;
    const [filename, driveFileId, duration] = line.split(",");
    existing.set(filename, { driveFileId, duration });
  }
}
if (!fs.existsSync(outPath)) fs.writeFileSync(outPath, HEADER + "\n");

function probeDuration(file) {
  const probe = JSON.parse(execFileSync("ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", file], { encoding: "utf8" }));
  return Number(Number(probe.format.duration).toFixed(3));
}

// Naming the destination would be friendlier than printing a bare id, but
// drive.file cannot read a folder it did not create -- files.get returns 404
// even for a folder the authorising user owns. That is the scope working as
// intended, not a misconfiguration, and creating files inside such a folder
// still succeeds (verified against the real API). So the lookup is advisory:
// it reports the name when the folder happens to be one this script made, and
// otherwise says so and continues. A hard failure here would block a working
// upload. Run with --limit 2 first and check Drive if the id is unverified.
let destination = `id ${folderId} (name not readable under the drive.file scope)`;
try {
  const { data: folder } = await drive.files.get({ fileId: folderId, fields: "id,name,mimeType" });
  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error(`GOOGLE_DRIVE_FOLDER_ID points at "${folder.name}", which is not a folder.`);
  }
  destination = `${folder.name} (${folder.id})`;
} catch (cause) {
  const message = cause?.message ?? String(cause);
  // One genuine misconfiguration is worth stopping for: the OAuth client's
  // own Cloud project never had the Drive API turned on.
  if (/has not been used in project|is disabled/i.test(message)) {
    const project = (env.GOOGLE_CLIENT_ID ?? "").split("-")[0];
    throw new Error(`The Google Drive API is not enabled in the Cloud project that owns this OAuth client${project ? ` (project number ${project})` : ""}.
Enable it at APIs & Services > Library > Google Drive API, in that same project, then run this again.`);
  }
  if (!/not found|File not found/i.test(message)) throw cause;
}
console.log(`Uploading into Drive folder: ${destination}`);
console.log(`Source: ${finishedDir} -- ${files.length} file(s)\n`);

let uploaded = 0;
let skipped = 0;
for (const name of files) {
  if (uploaded >= limit) break;
  if (existing.has(name)) { skipped += 1; continue; }
  const full = path.join(finishedDir, name);
  const duration = probeDuration(full);
  const { data } = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: "video/mp4", body: fs.createReadStream(full) },
    fields: "id",
  });
  // Append per file rather than writing once at the end: a crash or a rate
  // limit halfway through must not lose the ids already paid for.
  fs.appendFileSync(outPath, `${name},${data.id},${duration}\n`);
  uploaded += 1;
  console.log(`  ${uploaded}. ${name} -> ${data.id} (${duration}s)`);
}

console.log(`\nUploaded ${uploaded}, already present ${skipped}, total on disk ${files.length}.`);
console.log(`Metadata CSV: ${outPath}`);
