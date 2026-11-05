// Everything one annotator has labelled, with derived difficulty and the
// integrity checks an annotator's mistake (or a bug) would trip. Read-only.
//
//   cd frontend && node scripts/annotator-report.mjs someone@example.com
//
// Exits 1 when any video has a problem, so it can gate a pilot run.

import { privilegedClient } from "./lib/session.mjs";
import { GROUP_CODES, KEYFRAME_GROUPS } from "./lib/qgroups.mjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) { console.error("Usage: node scripts/annotator-report.mjs <email>"); process.exit(2); }
const admin = privilegedClient();
const must = ({ data, error }) => { if (error) throw error; return data; };

const profile = must(await admin.from("user_profiles").select("id,name,role,enabled").ilike("email", email).maybeSingle());
if (!profile) { console.error(`No user with email ${email}`); process.exit(2); }
console.log(`${profile.name} (${email}) · ${profile.role}${profile.enabled ? "" : " · DISABLED"}\n`);

const assignments = must(await admin.from("video_assignments")
  .select("video_id,status,completed_at,videos(filename,duration_s)").eq("annotator_id", profile.id)
  .order("completed_at", { ascending: true, nullsFirst: false }));
if (!assignments.length) { console.log("No videos opened yet."); process.exit(0); }
const videoIds = assignments.map((row) => row.video_id);
const drafts = must(await admin.from("video_drafts").select("id,video_id,qgroup").in("video_id", videoIds));
const answers = must(await admin.from("qa_annotations")
  .select("draft_id,verdict,reason_code,reason_note,human_keyframes_s").eq("annotator_id", profile.id)
  .in("draft_id", drafts.map((draft) => draft.id)));
const labels = must(await admin.from("video_labels").select("video_id,event_label").eq("annotator_id", profile.id));
const derived = must(await admin.from("annotator_difficulty")
  .select("video_id,disagree_count,not_answerable_count,model_errors,difficulty").eq("annotator_id", profile.id));
const pooled = must(await admin.from("video_difficulty").select("video_id,annotators,model_errors,difficulty").in("video_id", videoIds));

const SHORT = { AGREE: "✓", DISAGREE: "✗", NOT_ANSWERABLE: "?" };
let broken = 0;
for (const assignment of assignments) {
  const byGroup = new Map();
  for (const draft of drafts.filter((item) => item.video_id === assignment.video_id)) {
    byGroup.set(draft.qgroup, answers.find((answer) => answer.draft_id === draft.id));
  }
  const label = labels.find((row) => row.video_id === assignment.video_id);
  const mine = derived.find((row) => row.video_id === assignment.video_id);
  const video = pooled.find((row) => row.video_id === assignment.video_id);

  const problems = [];
  const answered = [...byGroup.values()].filter(Boolean).length;
  if (byGroup.size !== 9) problems.push(`${byGroup.size} drafts, expected 9`);
  if (assignment.status === "completed") {
    if (answered !== 9) problems.push(`completed with ${answered}/9 answers`);
    if (!label) problems.push("completed without an event label");
    if (!mine) problems.push("completed but missing from annotator_difficulty");
  }
  for (const [group, answer] of byGroup) {
    if (!answer) continue;
    const marks = answer.human_keyframes_s ?? [];
    if (KEYFRAME_GROUPS.includes(group) && (marks.length < 1 || marks.length > 3)) problems.push(`${group}: ${marks.length} keyframes`);
    if (!KEYFRAME_GROUPS.includes(group) && marks.length) problems.push(`${group}: keyframes on a group without evidence`);
    if (answer.verdict === "DISAGREE" && !answer.reason_code) problems.push(`${group}: DISAGREE without a reason`);
  }
  if (mine) {
    const counted = [...byGroup.values()].filter((answer) => answer && answer.verdict !== "AGREE").length;
    if (Number(mine.model_errors) !== counted) problems.push(`difficulty counts ${mine.model_errors}, verdicts give ${counted}`);
  }
  if (problems.length) broken += 1;

  const row = GROUP_CODES.map((group) => `${group}${SHORT[byGroup.get(group)?.verdict] ?? "·"}`).join(" ");
  console.log(`${problems.length ? "FAIL" : "ok  "} ${assignment.videos?.filename} · ${assignment.status}`);
  console.log(`     ${row}`);
  console.log(`     event ${label?.event_label ?? "-"} · ${mine
    ? `errors ${mine.model_errors} (✗${mine.disagree_count} ?${mine.not_answerable_count}) → ${mine.difficulty}`
    : "difficulty after completion"}${video && Number(video.annotators) > 1
    ? ` · video mean ${video.model_errors} over ${video.annotators} → ${video.difficulty}` : ""}`);
  for (const problem of problems) console.log(`     ! ${problem}`);
}
console.log(`\n${assignments.length} videos, ${assignments.filter((row) => row.status === "completed").length} completed, ${broken} with problems.`);
process.exit(broken ? 1 : 0);
