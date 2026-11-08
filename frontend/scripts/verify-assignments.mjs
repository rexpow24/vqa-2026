// Verifies admin-driven assignment: Drive ids hidden, assignment-only access,
// exclusive regular videos, range assignment, the annotator's paged list,
// the stratified agreement-group plan and the reference label import.
//
//   cd frontend && node scripts/verify-assignments.mjs
//   TEST_BASE_URL=http://localhost:3006 node scripts/verify-assignments.mjs   (hosted-mode server)
//
// Creates temporary annotators and videos (numbered after the real ones) and
// removes them in the finally block. Never creates or renumbers the real
// agreement group: that is checked through the read-only plan function.

import crypto from "node:crypto";
import { privilegedClient, signIn, request } from "./lib/session.mjs";
import { adminCredentials } from "./lib/env.mjs";
import { GROUP_CODES, KEYFRAME_GROUPS } from "./lib/qgroups.mjs";

const privileged = privilegedClient();
const base = process.env.TEST_BASE_URL;
const tag = crypto.randomUUID().slice(0, 8);

function check(condition, name, detail) {
  if (!condition) throw new Error(`${name} failed: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  console.log(`  OK  ${name}`);
}
const must = ({ data, error }) => { if (error) throw error; return data; };

async function makeAnnotator(label) {
  const email = `assign-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  must(await privileged.from("user_profiles").insert({ id: data.user.id, email, name: label, role: "annotator", enabled: true }));
  return { id: data.user.id, ...(await signIn(email, password)) };
}

async function makeVideo(index, { drafts = true, agreement = false } = {}) {
  const video = must(await privileged.from("videos").insert({
    drive_file_id: `assign-test-${crypto.randomUUID()}`,
    filename: `zzz-assign-${tag}-${String(index).padStart(2, "0")}_t01.mp4`, duration_s: 10, agreement_sample: agreement,
  }).select("id,seq,filename").single());
  if (drafts) must(await privileged.from("video_drafts").insert(GROUP_CODES.map((group) => ({
    video_id: video.id, qgroup: group, group_name: group, question: `Q ${group}`, answer: `A ${group}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))));
  return video;
}

const videoIds = [];
const userIds = [];
try {
  const { email: adminEmail, password: adminPassword } = adminCredentials();
  const admin = await signIn(adminEmail, adminPassword);
  const regular = [];
  for (let index = 1; index <= 12; index += 1) regular.push(await makeVideo(index));
  const noDrafts = await makeVideo(13, { drafts: false });
  const shared = await makeVideo(14, { agreement: true });
  videoIds.push(...regular.map((video) => video.id), noDrafts.id, shared.id);
  const [alice, bob, carol] = [await makeAnnotator("Assign A"), await makeAnnotator("Assign B"), await makeAnnotator("Assign C")];
  userIds.push(alice.id, bob.id, carol.id);
  const from = Math.min(...regular.map((video) => video.seq));
  const to = shared.seq;

  console.log("Numbering:");
  check(regular.every((video) => Number.isInteger(video.seq)) && new Set([...regular, noDrafts, shared].map((video) => video.seq)).size === 14 &&
    regular.every((video, index) => index === 0 || video.seq === regular[index - 1].seq + 1),
    "new videos get the next numbers in insert order", regular.map((video) => video.seq));

  console.log("Drive ids:");
  const leak = await alice.client.from("videos").select("drive_file_id").limit(1);
  check(Boolean(leak.error), "an annotator cannot select drive_file_id", leak);
  const star = await alice.client.from("videos").select("*").limit(1);
  check(Boolean(star.error), "an annotator cannot select * either", star);
  const adminLeak = await admin.client.from("videos").select("drive_file_id").limit(1);
  check(Boolean(adminLeak.error), "an admin session cannot select drive_file_id (pages use the privileged client)", adminLeak);

  console.log("Assignment-only:");
  check((must(await alice.client.from("videos").select("id").in("id", videoIds))).length === 0,
    "an annotator sees no unassigned video", "");
  check((must(await alice.client.from("video_drafts").select("id").in("video_id", videoIds))).length === 0,
    "an annotator sees no drafts of unassigned videos", "");
  const selfClaim = await alice.client.from("video_assignments").insert({ video_id: regular[0].id, annotator_id: alice.id, status: "pending" });
  check(Boolean(selfClaim.error), "an annotator cannot assign themselves", selfClaim);

  console.log("Ranges:");
  let result = must(await admin.client.rpc("assign_range", { annotator: alice.id, seq_from: from, seq_to: to, batch_label: `Batch ${tag}` }));
  check(result.assigned === 12 && result.skipped_agreement === 1 && result.skipped_not_ready === 1 && result.skipped_taken === 0,
    "a range assigns ready regular videos and reports the rest", result);
  check((must(await alice.client.from("videos").select("id").in("id", videoIds))).length === 12 &&
    (must(await alice.client.from("video_drafts").select("id").in("video_id", videoIds))).length === 108,
    "the assignee sees exactly their videos and drafts", "");
  result = must(await admin.client.rpc("assign_range", { annotator: bob.id, seq_from: from, seq_to: to, batch_label: `Batch ${tag}` }));
  check(result.assigned === 0 && result.skipped_taken === 12, "a second annotator gets nothing already taken", result);
  const doubled = await privileged.from("video_assignments").insert({ video_id: regular[0].id, annotator_id: bob.id, status: "pending" });
  check(Boolean(doubled.error), "a regular video cannot get a second annotator by any path", doubled);
  for (const user of [alice, bob, carol]) {
    must(await privileged.from("video_assignments").insert({ video_id: shared.id, annotator_id: user.id, status: "pending", batch: "agreement" }));
  }
  check((must(await privileged.from("video_assignments").select("id").eq("video_id", shared.id))).length === 3,
    "an agreement video takes three annotators", "");

  console.log("Unassign:");
  must(await alice.client.from("qa_annotations").insert({ draft_id: (must(await privileged.from("video_drafts").select("id")
    .eq("video_id", regular[11].id).eq("qgroup", "S").single())).id, annotator_id: alice.id, verdict: "AGREE", human_keyframes_s: [] }));
  result = must(await admin.client.rpc("unassign_range", { annotator: alice.id, seq_from: regular[10].seq, seq_to: regular[11].seq }));
  check(result.removed === 1 && result.kept_started === 1, "unassigning keeps a started video", result);
  must(await admin.client.rpc("assign_range", { annotator: alice.id, seq_from: regular[10].seq, seq_to: regular[10].seq, batch_label: `Batch ${tag}` }));

  console.log("Annotator list:");
  const page1 = must(await alice.client.rpc("my_assignments", { page_size: 10, page_offset: 0, search: null }));
  const page2 = must(await alice.client.rpc("my_assignments", { page_size: 10, page_offset: 10, search: null }));
  const mine = [...page1, ...page2].filter((row) => videoIds.includes(row.video_id));
  check(mine.length === 13 && Number(page1[0].total) === page1.length + page2.length,
    "pages cover all own videos with a right total", { page1: page1.length, page2: page2.length, total: page1[0]?.total });
  check(page1.every((row, index) => index === 0 || row.seq > page1[index - 1].seq), "rows are ordered by number", page1.map((row) => row.seq));
  const bySeq = must(await alice.client.rpc("my_assignments", { page_size: 10, page_offset: 0, search: String(regular[4].seq) }));
  check(bySeq.length === 1 && bySeq[0].video_id === regular[4].id && Number(bySeq[0].total) === 1, "search by number finds one video", bySeq);
  const byName = must(await alice.client.rpc("my_assignments", { page_size: 10, page_offset: 0, search: `${tag}-07` }));
  check(byName.length === 1 && byName[0].video_id === regular[6].id, "search by filename part finds it", byName);
  const bobs = must(await bob.client.rpc("my_assignments", { page_size: 50, page_offset: 0, search: tag }));
  check(bobs.length === 1 && bobs[0].video_id === shared.id, "another annotator's list holds only their own videos", bobs);

  console.log("Next video and progress:");
  const first = regular[0];
  const drafts = must(await privileged.from("video_drafts").select("id,qgroup").eq("video_id", first.id));
  must(await alice.client.from("video_labels").insert({ video_id: first.id, annotator_id: alice.id, event_label: "accident" }));
  must(await alice.client.from("qa_annotations").insert(drafts.map((draft) => ({ draft_id: draft.id, annotator_id: alice.id,
    verdict: "AGREE", human_keyframes_s: KEYFRAME_GROUPS.includes(draft.qgroup) ? [1] : [] }))));
  must(await alice.client.from("video_assignments").update({ status: "completed" }).eq("video_id", first.id).eq("annotator_id", alice.id));
  const next = must(await alice.client.rpc("next_assigned_video"));
  const progress = must(await alice.client.rpc("annotator_progress"));
  check(next?.[0]?.video_id === regular[1].id, "the next video is the first unfinished one by number", next);
  check(Number(progress[0].assigned) === 13 && Number(progress[0].completed) === 1, "progress counts own assignments", progress);

  console.log("Reference labels and agreement plan:");
  const imported = must(await admin.client.rpc("import_reference_labels", { rows: [
    ...regular.map((video, index) => ({ key: video.filename.replace(/\.mp4$/, ""),
      difficulty: ["easy", "medium", "high"][index % 3], event_label: index % 2 ? "accident" : "near-miss" })),
    { key: `missing-${tag}`, difficulty: "easy", event_label: "accident" },
    { key: regular[0].filename.replace(/_t\d+\.mp4$/, ""), difficulty: "hard", event_label: "accident" },
  ] }));
  check(imported.saved === 12 && imported.unknown?.length === 1 && imported.invalid?.length === 1,
    "reference labels save by shot stem and report unknown and invalid rows", imported);
  const plan = must(await admin.client.rpc("plan_agreement_group", { group_size: 6 }));
  const strata = must(await admin.client.rpc("agreement_strata"));
  const pool = strata.reduce((sum, row) => sum + Number(row.available), 0);
  // Same rule as the SQL: floor of the proportional share, then the largest
  // remainders get one more (ties: bigger stratum, then event label, then difficulty).
  const quotas = strata.map((row) => ({ key: `${row.event_label}/${row.difficulty}`, size: Number(row.available),
    event: row.event_label, difficulty: row.difficulty, exact: 6 * Number(row.available) / pool }));
  quotas.forEach((row) => { row.n = Math.floor(row.exact); });
  [...quotas].sort((a, b) => (b.exact - b.n) - (a.exact - a.n) || b.size - a.size ||
    a.event.localeCompare(b.event) || a.difficulty.localeCompare(b.difficulty))
    .slice(0, 6 - quotas.reduce((sum, row) => sum + row.n, 0)).forEach((row) => { row.n += 1; });
  const picked = Object.fromEntries(quotas.map((row) => [row.key, plan.filter((item) => `${item.event_label}/${item.difficulty}` === row.key).length]));
  check(plan.length === 6 && quotas.every((row) => picked[row.key] === row.n), "the plan follows the proportional allocation", { quotas, picked });
  const denied = await alice.client.rpc("plan_agreement_group", { group_size: 6 });
  check(Boolean(denied.error) || (denied.data ?? []).length === 0, "an annotator cannot plan the group", denied);

  console.log("Labels and overview:");
  must(await privileged.from("user_profiles").update({ label: `Range ${tag}` }).eq("id", alice.id));
  const overview = must(await admin.client.rpc("assignment_overview"));
  const row = overview.annotators.find((item) => item.id === alice.id);
  check(row?.label === `Range ${tag}` && row.total === 13 && row.completed === 1 && row.ranges.includes(`${from}-${regular[11].seq}`),
    "the overview shows label, ranges and totals", row);

  if (base) {
    console.log(`Through HTTP at ${base}:`);
    const list = await request(base, "/annotate?page=2", alice.cookie);
    check(list.status === 200 && String(list.data).includes("Trang 2") && String(list.data).includes('aria-current="page"'),
      "the list renders numbered pages", list.status);
    const search = await request(base, `/annotate?q=${regular[4].seq}`, alice.cookie);
    check(String(search.data).includes(regular[4].filename) && !String(search.data).includes(regular[5].filename),
      "the list filters by search", search.status);
    // A streamed loading.tsx has already sent 200 before notFound() runs, so
    // the proof is the body: the not-found fallback and nothing of the video.
    const foreign = await request(base, `/annotate/${regular[3].id}`, bob.cookie);
    check(/NEXT_HTTP_ERROR_FALLBACK;404|could not be found/.test(String(foreign.data)) && !String(foreign.data).includes(regular[3].filename),
      "an unassigned video page shows not found and nothing of the video", foreign.status);
    const claim = await request(base, `/api/videos/${regular[2].id}/claim`, bob.cookie, "POST");
    check(claim.status === 403, "the claim route refuses", claim.status);
    const stream = await request(base, `/api/videos/${regular[2].id}/stream`, bob.cookie);
    check(stream.status === 404, "streaming an unassigned video is refused", stream.status);
    const ranged = await request(base, "/api/admin/assignments/range", admin.cookie, "POST",
      { annotator_id: carol.id, from, to, batch: `Batch ${tag}` });
    check(ranged.status === 200 && ranged.data.assigned === 0 && ranged.data.skipped_taken === 12,
      "the range route reports taken videos", ranged.data);
    const deniedRange = await request(base, "/api/admin/assignments/range", alice.cookie, "POST",
      { annotator_id: alice.id, from, to });
    check(deniedRange.status === 403, "an annotator cannot use the range route", deniedRange.status);
    const planned = await request(base, "/api/admin/assignments/plan", admin.cookie, "POST", { size: 6 });
    check(planned.status === 200 && planned.data.length === 6, "the plan route previews the group", planned.status);
    const second = regular[1];
    const secondDrafts = must(await privileged.from("video_drafts").select("id,qgroup").eq("video_id", second.id));
    must(await alice.client.from("video_labels").insert({ video_id: second.id, annotator_id: alice.id, event_label: "near-miss" }));
    must(await alice.client.from("qa_annotations").insert(secondDrafts.map((draft) => ({ draft_id: draft.id, annotator_id: alice.id,
      verdict: "AGREE", human_keyframes_s: KEYFRAME_GROUPS.includes(draft.qgroup) ? [1] : [] }))));
    const completed = await request(base, `/api/videos/${second.id}/complete`, alice.cookie, "POST", {});
    check(completed.status === 200 && completed.data.next_video_id === regular[2].id,
      "completing hands back the next assigned video by number", completed.data);
  } else {
    console.log("\nTEST_BASE_URL not set -- skipped the HTTP half.");
  }
  console.log("\nAll assignment checks passed.");
} finally {
  const failures = [];
  for (const id of userIds) { const { error } = await privileged.auth.admin.deleteUser(id); if (error) failures.push(error.message); }
  for (const id of videoIds) { const { error } = await privileged.from("videos").delete().eq("id", id); if (error) failures.push(error.message); }
  if (failures.length) throw new Error(`Cleanup failed: ${failures.join("; ")}`);
}
