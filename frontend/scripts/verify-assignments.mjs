// Verifies admin-driven assignment: Drive ids hidden, assignment-only access,
// exclusive regular videos, range assignment, the annotator's paged list,
// the stratified agreement-group plan and its round order, assigning a round,
// "trained", the suggested split, the answers export and the reference label import.
//
//   cd frontend && node scripts/verify-assignments.mjs
//   TEST_BASE_URL=http://localhost:3006 node scripts/verify-assignments.mjs   (hosted-mode server)
//
// Creates temporary annotators and videos (numbered after the real ones) and
// removes them in the finally block. Never creates or renumbers the real
// agreement group: that is checked through the read-only plan function.
// The group's own videos here are temporary ones flagged agreement_sample,
// numbered after the real ones, so a round range never touches real videos.

import crypto from "node:crypto";
import { privilegedClient, signIn, request } from "./lib/session.mjs";
import { adminCredentials } from "./lib/env.mjs";
import { GROUP_CODES, KEYFRAME_GROUPS } from "./lib/qgroups.mjs";

const privileged = privilegedClient();
const base = process.env.TEST_BASE_URL;
// A tag of digits only would read as a video number in my_assignments search.
const tag = `t${crypto.randomUUID().slice(0, 7)}`;

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
  const round = [await makeVideo(15, { agreement: true }), await makeVideo(16, { agreement: true })];
  videoIds.push(...regular.map((video) => video.id), noDrafts.id, shared.id, ...round.map((video) => video.id));
  const [alice, bob, carol, dave] = [await makeAnnotator("Assign A"), await makeAnnotator("Assign B"),
    await makeAnnotator("Assign C"), await makeAnnotator("Assign D")];
  userIds.push(alice.id, bob.id, carol.id, dave.id);
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
  const bobs = must(await bob.client.rpc("my_assignments", { page_size: 50, page_offset: 0, search: `assign-${tag}` }));
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
  // Rounds are consecutive blocks of the group, of a size chosen later, so the
  // order must keep every prefix in proportion: after m videos a stratum of k
  // holds m*k/60 of them, off by less than one. A round is the difference of
  // two prefixes, so it is off by less than two (60 as 3 x 20 here: within 1.34).
  const sixty = must(await admin.client.rpc("plan_agreement_group", { group_size: 60 }));
  const again = must(await admin.client.rpc("plan_agreement_group", { group_size: 60 }));
  check(JSON.stringify(sixty.map((item) => item.video_id)) === JSON.stringify(again.map((item) => item.video_id)),
    "the plan is deterministic, order included", "");
  const stratumOf = (item) => `${item.event_label}/${item.difficulty}`;
  const totals = {};
  sixty.forEach((item) => { totals[stratumOf(item)] = (totals[stratumOf(item)] ?? 0) + 1; });
  const seen = {};
  let worst = 0;
  sixty.forEach((item, index) => {
    seen[stratumOf(item)] = (seen[stratumOf(item)] ?? 0) + 1;
    for (const [key, total] of Object.entries(totals)) worst = Math.max(worst, Math.abs((seen[key] ?? 0) - (index + 1) * total / 60));
  });
  const blocks = [0, 20, 40].map((start) => {
    const counts = {};
    sixty.slice(start, start + 20).forEach((item) => { counts[stratumOf(item)] = (counts[stratumOf(item)] ?? 0) + 1; });
    return counts;
  });
  check(worst < 1, "every prefix of the group order holds each stratum in proportion, off by less than one", { worst, totals, blocks });
  console.log(`      rounds of 20: ${JSON.stringify(blocks)}`);
  const denied = await alice.client.rpc("plan_agreement_group", { group_size: 6 });
  check(Boolean(denied.error) || (denied.data ?? []).length === 0, "an annotator cannot plan the group", denied);

  console.log("Training rounds:");
  const roundFrom = round[0].seq, roundTo = round[1].seq;
  result = must(await admin.client.rpc("assign_agreement_group", { annotators: [bob.id, carol.id], seq_from: roundFrom, seq_to: roundTo }));
  check(result.assigned === 4 && result.videos === 2, "a round assigns its agreement videos to every chosen annotator", result);
  result = must(await admin.client.rpc("assign_agreement_group", { annotators: [bob.id, carol.id], seq_from: roundFrom, seq_to: roundTo }));
  check(result.assigned === 0, "assigning a round twice adds nothing", result);
  const noGroup = await admin.client.rpc("assign_agreement_group", { annotators: [bob.id], seq_from: regular[0].seq, seq_to: regular[2].seq });
  check(Boolean(noGroup.error), "a range without agreement videos is refused", noGroup);
  const notAdmin = await alice.client.rpc("assign_agreement_group", { annotators: [alice.id], seq_from: roundFrom, seq_to: roundTo });
  check(Boolean(notAdmin.error), "an annotator cannot assign a round", notAdmin);

  console.log("Unassigning a round:");
  const viaRange = must(await admin.client.rpc("unassign_range", { annotator: bob.id, seq_from: roundFrom, seq_to: roundTo }));
  check(viaRange.removed === 0 && viaRange.skipped_agreement === 2, "the range unassign leaves a round alone and says so", viaRange);
  const roundDraft = must(await privileged.from("video_drafts").select("id").eq("video_id", round[0].id).eq("qgroup", "S").single());
  must(await carol.client.from("qa_annotations").insert({ draft_id: roundDraft.id, annotator_id: carol.id, verdict: "AGREE", human_keyframes_s: [] }));
  result = must(await admin.client.rpc("unassign_agreement_group", { annotators: [bob.id, carol.id], seq_from: roundFrom, seq_to: roundTo, delete_work: false }));
  check(result.removed === 3 && result.kept_started === 1 && result.deleted_answers === 0, "a round unassign keeps started work by default", result);
  result = must(await admin.client.rpc("unassign_agreement_group", { annotators: [carol.id], seq_from: roundFrom, seq_to: roundTo, delete_work: true }));
  const carolLeft = must(await privileged.from("qa_annotations").select("draft_id").eq("annotator_id", carol.id).eq("draft_id", roundDraft.id));
  check(result.removed === 1 && result.deleted_answers === 1 && carolLeft.length === 0, "deleting work removes the answers with the assignment", result);
  const sharedKept = must(await privileged.from("video_assignments").select("annotator_id").eq("video_id", shared.id));
  check(sharedKept.length === 3, "a round unassign touches only its own numbers", sharedKept.length);
  const unassignDenied = await alice.client.rpc("unassign_agreement_group", { annotators: [alice.id], seq_from: roundFrom, seq_to: roundTo, delete_work: true });
  check(Boolean(unassignDenied.error), "an annotator cannot unassign a round", unassignDenied);
  result = must(await admin.client.rpc("assign_agreement_group", { annotators: [bob.id, carol.id], seq_from: roundFrom, seq_to: roundTo }));
  check(result.assigned === 4, "the round can be assigned again", result);

  console.log("Suggested split:");
  const before = must(await admin.client.rpc("assignment_overview"));
  const parts = must(await admin.client.rpc("split_free_videos", { parts: 3 }));
  check(parts.length === 3 && parts.reduce((sum, part) => sum + part.videos, 0) === before.unassigned,
    "three parts cover every unassigned video", { parts, unassigned: before.unassigned });
  check(Math.max(...parts.map((part) => part.videos)) - Math.min(...parts.map((part) => part.videos)) <= 1 &&
    parts.every((part, index) => part.seq_from <= part.seq_to && (index === 0 || part.seq_from > parts[index - 1].seq_to)),
    "parts are equal to within one and do not overlap", parts);
  const splitDenied = await alice.client.rpc("split_free_videos", { parts: 3 });
  check(Boolean(splitDenied.error), "an annotator cannot split", splitDenied);
  const after = must(await admin.client.rpc("assignment_overview"));
  check(after.unassigned === before.unassigned, "suggesting assigns nothing", { before: before.unassigned, after: after.unassigned });

  console.log("Answers export:");
  const sharedS = must(await privileged.from("video_drafts").select("id,answer").eq("video_id", shared.id).eq("qgroup", "S").single());
  must(await bob.client.from("qa_annotations").insert({ draft_id: sharedS.id, annotator_id: bob.id, verdict: "DISAGREE",
    reason_code: "sai thực thể", edited_answer: `  Bob ${tag}  edit `, human_keyframes_s: [] }));
  must(await carol.client.from("qa_annotations").insert({ draft_id: sharedS.id, annotator_id: carol.id, verdict: "NOT_ANSWERABLE", human_keyframes_s: [] }));
  const stray = await bob.client.from("qa_annotations").update({ verdict: "AGREE" }).eq("draft_id", sharedS.id).eq("annotator_id", bob.id).select();
  check(Boolean(stray.error), "an edited answer cannot stay under AGREE", stray);
  const exported = must(await admin.client.rpc("answers_export", { only_agreement: false, seq_from: from, seq_to: roundTo }));
  const aliceRows = exported.filter((item) => item.annotator_id === alice.id);
  check(aliceRows.length === 10 && aliceRows.every((item) => item.verdict === "AGREE" && item.effective_answer === item.draft_answer),
    "the export holds every saved answer, AGREE resolving to the draft", aliceRows.length);
  const bobRow = exported.find((item) => item.annotator_id === bob.id && item.draft_id === sharedS.id);
  const carolRow = exported.find((item) => item.annotator_id === carol.id && item.draft_id === sharedS.id);
  check(String(bobRow?.edited_answer).includes(`Bob ${tag}`),
    "a DISAGREE row carries the edited answer", bobRow);
  check(bobRow?.effective_answer === `Bob ${tag} edit` && carolRow?.effective_answer === "Không trả lời được" &&
    bobRow.agreement === true && bobRow.seq === shared.seq && bobRow.qgroup === "S",
    "effective answers are normalized and the row says which video and group", { bobRow, carolRow });
  const groupOnly = must(await admin.client.rpc("answers_export", { only_agreement: true, seq_from: from, seq_to: roundTo }));
  check(groupOnly.length === 2 && groupOnly.every((item) => item.agreement), "the agreement scope keeps only group videos", groupOnly.length);
  const exportDenied = await alice.client.rpc("answers_export", { only_agreement: false, seq_from: null, seq_to: null });
  check(Boolean(exportDenied.error), "an annotator cannot export", exportDenied);

  console.log("Labels and overview:");
  must(await privileged.from("user_profiles").update({ label: `Range ${tag}` }).eq("id", alice.id));
  const overview = must(await admin.client.rpc("assignment_overview"));
  const row = overview.annotators.find((item) => item.id === alice.id);
  check(row?.label === `Range ${tag}` && row.total === 13 && row.completed === 1 && row.ranges.includes(`${from}-${regular[11].seq}`),
    "the overview shows label, ranges and totals", row);
  const bobRowOverview = overview.annotators.find((item) => item.id === bob.id);
  const daveRow = overview.annotators.find((item) => item.id === dave.id);
  check(bobRowOverview?.trained === true && bobRowOverview.agreement === 3 && bobRowOverview.agreement_ranges === `${shared.seq}-${roundTo}` &&
    bobRowOverview.ranges === "" && daveRow?.trained === false,
    "anyone holding agreement videos is trained, with the group range apart from regular ranges", { bobRowOverview, daveRow });

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
    const target = regular[9].seq;
    const removedHttp = await request(base, "/api/admin/assignments/unassign", admin.cookie, "POST",
      { annotator_id: alice.id, from: target, to: target });
    const reassigned = await request(base, "/api/admin/assignments/range", admin.cookie, "POST",
      { annotator_id: alice.id, from: target, to: target, batch: `Batch ${tag}` });
    check(removedHttp.data?.removed === 1 && reassigned.data?.assigned === 1,
      "the unassign route removes an untouched video and the range route gives it back", { removedHttp: removedHttp.data, reassigned: reassigned.data });
    const groupRound = await request(base, "/api/admin/assignments/assign-group", admin.cookie, "POST",
      { annotator_ids: [dave.id], from: roundFrom, to: roundTo });
    check(groupRound.status === 200 && groupRound.data.assigned === 2, "the assign-group route assigns one round", groupRound.data);
    const ungrouped = await request(base, "/api/admin/assignments/unassign-group", admin.cookie, "POST",
      { annotator_ids: [dave.id], from: roundFrom, to: roundTo, delete_work: true });
    const regrouped = await request(base, "/api/admin/assignments/assign-group", admin.cookie, "POST",
      { annotator_ids: [dave.id], from: roundFrom, to: roundTo });
    check(ungrouped.status === 200 && ungrouped.data.removed === 2 && regrouped.data?.assigned === 2,
      "the unassign-group route takes a round back", { ungrouped: ungrouped.data, regrouped: regrouped.data });
    const split = await request(base, "/api/admin/assignments/split", admin.cookie, "POST", { parts: 2 });
    check(split.status === 200 && split.data.length === 2, "the split route suggests ranges", split.status);
    const csv = await request(base, `/api/admin/answers/export?scope=agreement&from=${from}&to=${roundTo}`, admin.cookie);
    const lines = String(csv.data).trim().split(/\r\n/);
    check(csv.status === 200 && lines[0].includes("edited_answer") && lines.length === 3 && String(csv.data).includes(`Bob ${tag} edit`),
      "the export route downloads the answers as CSV", { status: csv.status, lines: lines.length });
    const csvDenied = await request(base, "/api/admin/answers/export", alice.cookie);
    check(csvDenied.status === 403, "an annotator cannot download the export", csvDenied.status);
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
