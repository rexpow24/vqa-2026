// Verifies the admin video CSV import (features/video-csv-import): rows from
// drive-upload.mjs's videos.csv become `videos` rows only after the same Drive
// probe the single-add form uses, and the classification of every other row.
//
//   cd frontend && TEST_BASE_URL=http://localhost:3005 node scripts/verify-video-import.mjs
//
// Needs a server in hosted mode (PLATFORM_MODE=hosted). Fixture rows use
// filenames starting `zzz-import-test-` and are deleted in the finally block.
// The Drive ids must be real, publicly shared videos that are not already in
// `videos`; override them with TEST_DRIVE_IDS=id1,id2,id3.

import crypto from "node:crypto";
import { adminCredentials } from "./lib/env.mjs";
import { privilegedClient, signIn, request } from "./lib/session.mjs";
import { chunkVideoCsv, headerError } from "../src/lib/video-csv.ts";

const base = process.env.TEST_BASE_URL;
if (!base) throw new Error("Set TEST_BASE_URL to a hosted-mode server, e.g. http://localhost:3005");
const privileged = privilegedClient();
const PREFIX = "zzz-import-test-";
const driveIds = (process.env.TEST_DRIVE_IDS ??
  "1TKRB0hq4qbFHkI5vWHLL7WAY8yi3T-5h,13Bto0F0lMvuLxesFGWghGVxuuxcalLsQ,1_WXVybGX2U219-N-yz14yDnX31WDpVTp").split(",");
// Well-formed but nonexistent: Drive answers 404 text/html for it.
const MISSING_DRIVE_ID = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function check(condition, name, detail) {
  if (!condition) throw new Error(`${name} failed: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  console.log(`  OK  ${name}`);
}
const run = crypto.randomUUID().slice(0, 8);
const name = (n) => `${PREFIX}${run}-${n}.mp4`;
const csv = (rows) => ["filename,drive_file_id,duration_s", ...rows.map((row) => row.join(","))].join("\n");
const importChunk = (cookie, text) => request(base, "/api/admin/videos/import", cookie, "POST", { csv: text });
async function stored(filenames) {
  const { data, error } = await privileged.from("videos")
    .select("filename,drive_file_id,duration_s,status,available").in("filename", filenames);
  if (error) throw error;
  return data;
}

const { email, password } = adminCredentials();
const admin = await signIn(email, password);
let annotatorId;

try {
  console.log("Valid rows:");
  const rows = [[name(1), driveIds[0], "6"], [name(2), driveIds[1], "5.5"], [name(3), driveIds[2], "19.25"]];
  const first = await importChunk(admin.cookie, csv(rows));
  check(first.status === 200, "import answers 200", first);
  check(first.data.results?.length === 3 && first.data.results.every((row) => row.status === "inserted"),
    "every valid new row is reported inserted", first.data);
  const saved = await stored(rows.map((row) => row[0]));
  check(rows.every(([filename, id, duration]) => saved.some((row) => row.filename === filename &&
    row.drive_file_id === id && Number(row.duration_s) === Number(duration) &&
    row.status === "active" && row.available === true)),
  "valid rows are inserted with the CSV's values", saved);

  console.log("\nRows that meet existing data:");
  const again = await importChunk(admin.cookie, csv(rows));
  check(again.status === 200 && again.data.results.every((row) => row.status === "skipped"),
    "re-posting the same chunk skips every row", again.data);
  check((await stored(rows.map((row) => row[0]))).length === 3, "a second run adds no rows", "count changed");
  const collisions = await importChunk(admin.cookie, csv([
    [name(1), MISSING_DRIVE_ID, "6"],            // known name, other id
    [name(4), driveIds[1], "6"],                 // known id, new name
    [name(5), MISSING_DRIVE_ID, "0"],            // invalid, but first occurrence
    [name(5), MISSING_DRIVE_ID, "0"],            // repeated name
  ]));
  const [renamed, reused, , repeated] = collisions.data.results ?? [];
  check(renamed?.status === "conflict" && renamed.existing_drive_file_id === driveIds[0],
    "same name with another Drive id is a conflict that names the stored id", collisions.data);
  check((await stored([name(1)]))[0].drive_file_id === driveIds[0], "a conflict leaves the stored id alone", "id changed");
  check(reused?.status === "failed" && reused.reason?.includes(name(2)),
    "a Drive id stored under another name fails and names that file", collisions.data);
  check(repeated?.status === "skipped", "a name repeated inside one file is skipped", collisions.data);

  console.log("\nBad input never writes:");
  const mixed = await importChunk(admin.cookie, csv([
    [name(6), driveIds[2].replace(/.$/, "x"), "6"],  // well-formed id Drive does not have
    [name(7), driveIds[2], "0"],
  ]));
  check(mixed.data.results?.every((row) => row.status === "failed") &&
    mixed.data.results[0].reason.includes("Drive") && mixed.data.results[1].reason.includes("duration_s"),
  "a Drive 404 and a zero duration each fail with their own reason", mixed.data);
  check((await stored([name(6), name(7)])).length === 0, "failed rows are not stored", "stored");
  const tooMany = csv(Array.from({ length: 101 }, (_, i) => [name(`many-${i}`), driveIds[0], "1"]));
  for (const [label, text] of [["missing column", "filename,drive_file_id\na.mp4,1AAAAAAAAAAAA"],
    ["extra column", "filename,drive_file_id,duration_s,x\na.mp4,1AAAAAAAAAAAA,1,2"],
    ["no data rows", "filename,drive_file_id,duration_s\n"], ["101 rows", tooMany]]) {
    const started = Date.now();
    const rejected = await importChunk(admin.cookie, text);
    check(rejected.status === 422 && Date.now() - started < 1500, `${label} is a 422 before any Drive probe`,
      { status: rejected.status, ms: Date.now() - started });
  }

  console.log("\nOnly admins:");
  const anonymous = await importChunk("", csv(rows));
  check(anonymous.status === 401, "no session is a 401", anonymous);
  const annotatorEmail = `import-test-${crypto.randomUUID()}@example.com`;
  const annotatorPassword = crypto.randomBytes(24).toString("base64url");
  const { data: created, error: createError } = await privileged.auth.admin.createUser({
    email: annotatorEmail, password: annotatorPassword, email_confirm: true });
  if (createError) throw createError;
  annotatorId = created.user.id;
  const { error: profileError } = await privileged.from("user_profiles").insert({
    id: annotatorId, email: annotatorEmail, name: "Import Test", role: "annotator", enabled: true });
  if (profileError) throw profileError;
  const annotator = await signIn(annotatorEmail, annotatorPassword);
  const forbidden = await importChunk(annotator.cookie, csv([[name(8), driveIds[2], "1"]]));
  check(forbidden.status === 403 && (await stored([name(8)])).length === 0, "an annotator is a 403 and writes nothing", forbidden);

  console.log("\nBrowser-side chunking:");
  const big = ["﻿filename,drive_file_id,duration_s",
    ...Array.from({ length: 250 }, (_, i) => (i === 120 ? "\r\nv120.mp4,id,1" : `v${i}.mp4,id,1`))].join("\r\n");
  const { chunks, total } = chunkVideoCsv(big);
  check(total === 250 && chunks.map((chunk) => chunk.lines.length).join("/") === "100/100/50",
    "250 rows split into 100/100/50", chunks.map((chunk) => chunk.lines.length));
  check(chunks[1].lines[20] === 123 && chunks.every((chunk) => chunk.csv.startsWith("filename,drive_file_id,duration_s\n")),
    "each chunk repeats the header and keeps original line numbers past a blank line", chunks[1].lines.slice(19, 22));
  check(headerError("﻿duration_s, filename,drive_file_id") === null && headerError("filename,drive_file_id") &&
    headerError("filename,drive_file_id,duration_s,x"), "header check accepts any order and rejects missing or extra", "");

  console.log("\nSingle-add form, which shares the Drive probe:");
  await privileged.from("videos").delete().like("filename", `${PREFIX}%`);
  const added = await request(base, "/api/admin/videos", admin.cookie, "POST",
    { drive_file_id: driveIds[0], filename: name("single"), duration_s: 6 });
  check(added.status === 201, "single-add still accepts a playable Drive video", added);
  const missing = await request(base, "/api/admin/videos", admin.cookie, "POST",
    { drive_file_id: MISSING_DRIVE_ID, filename: name("missing"), duration_s: 6 });
  check(missing.status === 422 && missing.data.error === "Drive file is not a seekable video",
    "single-add still rejects an id Drive answers 404 for", missing);

  console.log("\nAll video import checks passed.");
} finally {
  const { error } = await privileged.from("videos").delete().like("filename", `${PREFIX}%`);
  if (error) throw new Error(`Fixture cleanup failed: ${error.message}`);
  if (annotatorId) {
    const { error: userError } = await privileged.auth.admin.deleteUser(annotatorId);
    if (userError) throw new Error(`Test user cleanup failed: ${userError.message}`);
  }
}
