// Seeds the LOCAL review environment (features/e-v6-no-colors, review before
// deploy): one admin, one annotator, three real agreement clips streamed from
// Drive (collision of two motorbikes, near miss, single-vehicle K18), each with
// the eight active Gemini drafts copied from the agreement export, assigned to the
// annotator as slot work. Idempotent: earlier review users and videos are
// removed first. Refuses to run against anything but a local Supabase.

import fs from "node:fs";
import path from "node:path";
import { loadEnv, refuseUnlessLocal, FRONTEND_DIR } from "./lib/env.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
const { privilegedClient } = await import("./lib/session.mjs");
const db = privilegedClient();
const must = ({ data, error }) => { if (error) throw error; return data; };

const fixtures = JSON.parse(fs.readFileSync(path.join(FRONTEND_DIR, "scripts", "fixtures", "review-fixtures.json"), "utf8"));
const GROUPS = ["S", "E", "N", "C", "O", "R", "Attr", "Prev"]; // V left active labeling (20261122160000)
const PEOPLE = [
  { email: "review-admin@local.test", password: "review-admin-2026", name: "Review Admin", role: "admin" },
  { email: "review-annotator@local.test", password: "review-annotator-2026", name: "Review Annotator", role: "annotator" },
];

// Clean previous runs.
const { data: listed } = await db.auth.admin.listUsers({ perPage: 1000 });
for (const user of listed.users.filter((u) => PEOPLE.some((p) => p.email === u.email))) {
  must(await db.auth.admin.deleteUser(user.id));
}
must(await db.from("videos").delete().like("drive_file_id", "review-%"));
must(await db.from("videos").delete().in("filename", fixtures.map((f) => `review-${f.filename}`)));

const ids = {};
for (const person of PEOPLE) {
  const created = await db.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true });
  if (created.error) throw created.error;
  ids[person.role] = created.data.user.id;
  must(await db.from("user_profiles").upsert({ id: created.data.user.id, email: person.email, name: person.name,
    role: person.role, enabled: true }));
}

for (const fixture of fixtures) {
  const video = must(await db.from("videos").insert({ drive_file_id: fixture.drive_file_id,
    filename: `review-${fixture.filename}`, duration_s: fixture.duration_s, agreement_sample: false }).select("id,seq").single());
  must(await db.from("video_drafts").insert(GROUPS.map((group) => ({
    video_id: video.id, qgroup: group, group_name: group,
    question: fixture.drafts[group]?.question ?? `Câu hỏi nhóm ${group}`,
    answer: fixture.drafts[group]?.answer ?? `Bản nháp nhóm ${group}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))));
  must(await db.from("video_assignments").insert({ video_id: video.id, annotator_id: ids.annotator,
    status: "pending", answer_format: "slots" }));
  console.log(`${fixture.case.padEnd(10)} #${video.seq} /annotate/${video.id}  ${fixture.filename}`);
}
