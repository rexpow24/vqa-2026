// Verifies answer adjudication: verdict/answer consistency, final answers
// (single / consensus / conflict), the CSV import of decisions, and the lock.
//
//   cd frontend && node scripts/verify-adjudication.mjs
//   TEST_BASE_URL=https://vqa-vn-traffic-labeling.vercel.app node scripts/verify-adjudication.mjs
//
// The HTTP half (API 422s, CSV export and import routes) needs a hosted server;
// without TEST_BASE_URL it is skipped. Creates three temporary annotators and
// two temporary videos, and removes them in the finally block, which also
// proves a decision does not block deleting a video or a user.

import crypto from "node:crypto";
import { privilegedClient, signIn, request } from "./lib/session.mjs";
import { adminCredentials } from "./lib/env.mjs";
import { GROUP_CODES, KEYFRAME_GROUPS } from "./lib/qgroups.mjs";
import { parse } from "csv-parse/sync";

const privileged = privilegedClient();
const base = process.env.TEST_BASE_URL;
const NOT_ANSWERABLE = "Không trả lời được";

function check(condition, name, detail) {
  if (!condition) throw new Error(`${name} failed: ${detail}`);
  console.log(`  OK  ${name}`);
}
const must = ({ data, error }) => { if (error) throw error; return data; };

async function makeAnnotator(label) {
  const email = `adjudication-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  must(await privileged.from("user_profiles").insert({ id: data.user.id, email, name: label, role: "annotator", enabled: true }));
  const { client, cookie } = await signIn(email, password);
  return { id: data.user.id, client, cookie };
}

async function makeVideo() {
  const video = must(await privileged.from("videos").insert({
    drive_file_id: `adjudication-test-${crypto.randomUUID()}`,
    filename: `zzz-adjudication-test-${crypto.randomUUID()}.mp4`, duration_s: 10, agreement_sample: true,
  }).select("id").single());
  const drafts = must(await privileged.from("video_drafts").insert(GROUP_CODES.map((group) => ({
    video_id: video.id, qgroup: group, group_name: group, question: `Q ${group}`, answer: `Draft ${group}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))).select("id,qgroup,answer"));
  return { id: video.id, draft: Object.fromEntries(drafts.map((draft) => [draft.qgroup, draft])) };
}

// answers: { group: { verdict, edited?, marks? } }, unspecified groups AGREE.
async function label(user, video, answers, eventLabel) {
  must(await privileged.from("video_assignments").insert({ video_id: video.id, annotator_id: user.id, status: "pending" }));
  must(await user.client.from("video_labels").insert({ video_id: video.id, annotator_id: user.id, event_label: eventLabel }));
  must(await user.client.from("qa_annotations").insert(GROUP_CODES.map((group) => {
    const { verdict = "AGREE", edited = null, marks = [1] } = answers[group] ?? {};
    return {
      draft_id: video.draft[group].id, annotator_id: user.id, verdict, edited_answer: edited,
      reason_code: verdict === "DISAGREE" ? "sai nhân quả" : null,
      human_keyframes_s: KEYFRAME_GROUPS.includes(group) ? marks : [],
    };
  })));
  must(await user.client.from("video_assignments").update({ status: "completed" })
    .eq("video_id", video.id).eq("annotator_id", user.id));
}

const finals = async (video) => Object.fromEntries((must(await privileged.from("final_answers")
  .select("qgroup,annotators,source,final_verdict,final_answer,final_keyframes_s,fingerprint,draft_id")
  .eq("video_id", video.id))).map((row) => [row.qgroup, row]));
const finalLabel = async (video) => must(await privileged.from("final_video_labels")
  .select("annotators,source,event_label,fingerprint").eq("video_id", video.id).maybeSingle());

const videos = [];
const users = [];
try {
  const single = await makeVideo(); videos.push(single);
  const pair = await makeVideo(); videos.push(pair);
  for (const name of ["A", "B", "C"]) users.push(await makeAnnotator(`Adjudication Test ${name}`));
  const [alice, bob, carol] = users;
  const { email: adminEmail, password: adminPassword } = adminCredentials();
  const admin = await signIn(adminEmail, adminPassword);

  console.log("Consistency:");
  must(await privileged.from("video_assignments").insert({ video_id: single.id, annotator_id: alice.id, status: "pending" }));
  const save = (row) => alice.client.from("qa_annotations").upsert({
    draft_id: single.draft.S.id, annotator_id: alice.id, human_keyframes_s: [], ...row,
  }, { onConflict: "draft_id,annotator_id" });
  check(Boolean((await save({ verdict: "AGREE", edited_answer: "Rewritten" })).error),
    "AGREE with an edited answer is refused", "");
  check(Boolean((await save({ verdict: "NOT_ANSWERABLE", edited_answer: "Rewritten" })).error),
    "NOT_ANSWERABLE with an edited answer is refused", "");
  check(Boolean((await save({ verdict: "DISAGREE", reason_code: "sai nhân quả" })).error),
    "DISAGREE without an edited answer is refused", "");
  check(Boolean((await save({ verdict: "DISAGREE", reason_code: "sai nhân quả", edited_answer: "  Draft   S " })).error),
    "DISAGREE with the draft's own text is refused", "");
  const fixed = await save({ verdict: "DISAGREE", reason_code: "sai nhân quả", edited_answer: "Fixed S" });
  check(!fixed.error, "DISAGREE with a corrected answer saves", fixed.error?.message);
  must(await alice.client.from("qa_annotations").delete().eq("draft_id", single.draft.S.id).eq("annotator_id", alice.id));
  must(await privileged.from("video_assignments").delete().eq("video_id", single.id).eq("annotator_id", alice.id));
  // Carol is assigned to the pair but never answers: the API checks below and,
  // later, the "uninvolved annotator" checks.
  must(await privileged.from("video_assignments").insert({ video_id: pair.id, annotator_id: carol.id, status: "pending" }));
  if (base) {
    for (const [body, name] of [
      [{ verdict: "AGREE", edited_answer: "Rewritten" }, "API refuses AGREE with an edited answer"],
      [{ verdict: "DISAGREE", reason_code: "sai nhân quả" }, "API refuses DISAGREE without an edited answer"],
    ]) {
      const response = await request(base, `/api/drafts/${pair.draft.S.id}/annotation`, carol.cookie, "POST",
        { human_keyframes_s: [], ...body });
      check(response.status === 422, name, `${response.status} ${JSON.stringify(response.data)}`);
    }
  }

  console.log("Final answers:");
  await label(alice, single, { E: { verdict: "DISAGREE", edited: "E single" } }, "accident");
  let rows = await finals(single);
  check(Object.values(rows).length === 9 && Object.values(rows).every((row) => row.source === "single"),
    "one completed annotator gives single answers", JSON.stringify(rows));
  check(rows.S.final_answer === "Draft S" && rows.E.final_answer === "E single" && rows.E.final_verdict === "DISAGREE",
    "single takes the annotator's effective answer", JSON.stringify([rows.S, rows.E]));
  check((await finalLabel(single))?.source === "single", "one event label is single", "");

  await label(alice, pair, {
    E: {}, N: { verdict: "DISAGREE", edited: "N fixed" }, C: { marks: [1] },
    V: { verdict: "DISAGREE", edited: "V one" }, O: { verdict: "NOT_ANSWERABLE" },
  }, "accident");
  await label(bob, pair, {
    E: { verdict: "DISAGREE", edited: "E fixed" }, N: { verdict: "DISAGREE", edited: "  N   fixed " }, C: { marks: [2] },
    V: { verdict: "DISAGREE", edited: "V two" }, O: { verdict: "NOT_ANSWERABLE" },
  }, "near-miss");
  rows = await finals(pair);
  check(rows.S.source === "consensus" && rows.S.final_answer === "Draft S" && rows.S.annotators === 2,
    "two AGREE are consensus on the draft answer", JSON.stringify(rows.S));
  check(rows.N.source === "consensus" && rows.N.final_answer === "N fixed",
    "two edits equal up to whitespace are consensus", JSON.stringify(rows.N));
  check(rows.C.source === "consensus" && rows.C.final_keyframes_s.map(Number).join() === "1,2",
    "keyframes never conflict and are merged", JSON.stringify(rows.C));
  check(rows.O.source === "consensus" && rows.O.final_answer === NOT_ANSWERABLE,
    "two NOT_ANSWERABLE are consensus", JSON.stringify(rows.O));
  check(rows.E.source === "conflict" && rows.E.final_answer === null,
    "AGREE vs DISAGREE is a conflict with no final answer", JSON.stringify(rows.E));
  check(rows.V.source === "conflict", "two different edits are a conflict", JSON.stringify(rows.V));
  check(Object.values(rows).filter((row) => row.source === "conflict").length === 2, "nothing else conflicts", "");
  const pairLabel = await finalLabel(pair);
  check(pairLabel.source === "conflict" && pairLabel.event_label === null, "different event labels conflict", JSON.stringify(pairLabel));

  if (base) {
    console.log(`Export through HTTP at ${base}:`);
    const exported = await request(base, "/api/admin/adjudications/export", admin.cookie);
    check(exported.status === 200 && typeof exported.data === "string", "admin downloads the CSV", exported.status);
    const mine = parse(exported.data, { columns: true, bom: true, skip_empty_lines: true })
      .filter((row) => row.video_id === pair.id || row.video_id === single.id);
    check(mine.length === 3 && mine.filter((row) => row.kind === "answer").map((row) => row.qgroup).sort().join() === "E,V" &&
      mine.some((row) => row.kind === "event"), "the CSV lists exactly the open conflicts", JSON.stringify(mine));
    const e = mine.find((row) => row.qgroup === "E");
    check(e.fingerprint === rows.E.fingerprint && e.gemini_answer === "Draft E" &&
      [e.answer_1, e.answer_2].sort().join("|") === "Draft E|E fixed", "a row carries both answers and the fingerprint", JSON.stringify(e));
    const denied = await request(base, "/api/admin/adjudications/export", alice.cookie);
    check(denied.status === 403, "an annotator cannot download it", denied.status);
  }

  console.log("Import:");
  const decide = async (decisions) => must(await admin.client.rpc("import_adjudications", { rows: decisions }));
  const answerRow = (group, extra) => ({ kind: "answer", draft_id: pair.draft[group].id, fingerprint: rows[group].fingerprint,
    followed_llm: true, final_keyframes_s: [], ...extra });
  let result = await decide([
    answerRow("E", { fingerprint: "0".repeat(32), final_verdict: "AGREE" }),
    answerRow("S", { final_verdict: "AGREE" }),
    answerRow("V", { final_verdict: "DISAGREE", final_answer: "" }),
    answerRow("E", { final_verdict: "AGREE", final_answer: "" }),
    answerRow("V", { final_verdict: "DISAGREE", final_answer: "V decided", llm_suggestion: "V decided" }),
    { kind: "event", video_id: pair.id, fingerprint: pairLabel.fingerprint, final_event_label: "near-miss", followed_llm: false },
  ]);
  check(result.map((row) => row.status).join() === "stale,not_conflict,invalid,saved,saved,saved",
    "rows report stale, not_conflict, invalid and saved", JSON.stringify(result));
  rows = await finals(pair);
  check(rows.E.source === "adjudicated" && rows.E.final_answer === "Draft E" && rows.E.final_verdict === "AGREE",
    "an AGREE decision takes the draft answer", JSON.stringify(rows.E));
  check(rows.V.source === "adjudicated" && rows.V.final_answer === "V decided", "a DISAGREE decision takes the decided answer", JSON.stringify(rows.V));
  check((await finalLabel(pair)).event_label === "near-miss", "the event label decision applies", "");
  const stored = must(await privileged.from("answer_adjudications").select("annotator_ids,followed_llm,llm_suggestion,decided_by")
    .eq("draft_id", pair.draft.V.id).single());
  check(stored.annotator_ids.slice().sort().join() === [alice.id, bob.id].sort().join() && stored.followed_llm === true &&
    stored.llm_suggestion === "V decided" && stored.decided_by, "the decision records who, the LLM suggestion and the uploader", JSON.stringify(stored));
  result = await decide([answerRow("E", { final_verdict: "NOT_ANSWERABLE" })]);
  check(result[0].status === "saved" && (await finals(pair)).E.final_answer === NOT_ANSWERABLE,
    "a decision can be uploaded again", JSON.stringify(result));
  const forged = await alice.client.rpc("import_adjudications", { rows: [answerRow("E", { final_verdict: "AGREE" })] });
  check(Boolean(forged.error), "an annotator cannot import decisions", JSON.stringify(forged.data));

  console.log("Lock:");
  const update = await alice.client.from("qa_annotations").update({ verdict: "DISAGREE", reason_code: "sai nhân quả", edited_answer: "Late" })
    .eq("draft_id", pair.draft.E.id).eq("annotator_id", alice.id).select();
  check(Boolean(update.error) || update.data?.length === 0, "an involved annotator cannot change a decided answer", JSON.stringify(update));
  const removed = await bob.client.from("qa_annotations").delete().eq("draft_id", pair.draft.V.id).eq("annotator_id", bob.id).select();
  check(Boolean(removed.error) || removed.data?.length === 0, "an involved annotator cannot delete it", JSON.stringify(removed));
  const relabel = await alice.client.from("video_labels").update({ event_label: "near-miss" })
    .eq("video_id", pair.id).eq("annotator_id", alice.id).select();
  check(Boolean(relabel.error) || relabel.data?.length === 0, "an involved annotator cannot change a decided event label", JSON.stringify(relabel));
  const undecided = await alice.client.from("qa_annotations").update({ verdict: "NOT_ANSWERABLE" })
    .eq("draft_id", pair.draft.R.id).eq("annotator_id", alice.id).select();
  check(!undecided.error && undecided.data?.length === 1, "an undecided question stays editable", JSON.stringify(undecided));
  const seen = must(await alice.client.from("answer_adjudications").select("draft_id").in("draft_id", [pair.draft.E.id, pair.draft.V.id]));
  const seenLabel = must(await alice.client.from("label_adjudications").select("video_id").eq("video_id", pair.id));
  check(seen.length === 2 && seenLabel.length === 1, "an involved annotator reads the decisions", JSON.stringify(seen));
  const hidden = must(await carol.client.from("answer_adjudications").select("draft_id").eq("draft_id", pair.draft.E.id));
  check(hidden.length === 0, "an uninvolved annotator cannot read them", JSON.stringify(hidden));
  const late = await carol.client.from("qa_annotations").insert({
    draft_id: pair.draft.E.id, annotator_id: carol.id, verdict: "AGREE", human_keyframes_s: [] });
  check(!late.error, "an uninvolved annotator can still answer a decided question", late.error?.message);

  if (base) {
    console.log(`Import through HTTP at ${base}:`);
    const header = ["kind", "qgroup", "video_id", "draft_id", "fingerprint", "final_verdict", "final_answer",
      "final_keyframes_s", "final_event_label", "llm_suggestion", "followed_llm"];
    // Plain values only, so joining with commas is valid CSV.
    const csv = "﻿" + [header, ...[
      { kind: "event", qgroup: "EVENT", video_id: pair.id, fingerprint: pairLabel.fingerprint, final_event_label: "accident", followed_llm: "có" },
      { kind: "answer", qgroup: "V", video_id: pair.id, draft_id: pair.draft.V.id, fingerprint: rows.V.fingerprint },
    ].map((row) => header.map((name) => row[name] ?? ""))].map((cells) => cells.join(",")).join("\r\n");
    const posted = await request(base, "/api/admin/adjudications/import", admin.cookie, "POST", { csv });
    check(posted.status === 200 && posted.data.results?.map((row) => row.status).join() === "saved,skipped" &&
      (await finalLabel(pair)).event_label === "accident", "the import route saves decided rows and skips undecided ones", JSON.stringify(posted.data));
    const deniedImport = await request(base, "/api/admin/adjudications/import", alice.cookie, "POST", { csv });
    check(deniedImport.status === 403, "an annotator cannot use the import route", deniedImport.status);
  } else {
    console.log("\nTEST_BASE_URL not set -- skipped the HTTP half.");
  }
  console.log("\nAll adjudication checks passed.");
} finally {
  // Users first: their answers cascade away while the decided drafts still
  // exist, the harder case for the lock's cascade escape.
  const failures = [];
  for (const user of users) {
    const { error } = await privileged.auth.admin.deleteUser(user.id);
    if (error) failures.push(`user: ${error.message}`);
  }
  for (const video of videos) {
    const { error } = await privileged.from("videos").delete().eq("id", video.id);
    if (error) failures.push(`video: ${error.message}`);
  }
  if (failures.length) throw new Error(`Cleanup failed: ${failures.join("; ")}`);
  console.log("  OK  deleting decided users and videos still works");
}
