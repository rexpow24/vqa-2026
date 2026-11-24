import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { needsKeyframes } from "@/lib/qgroups";
import { trainingRequired } from "@/lib/trainings-server";
import { ComposeError, compose, type Slots } from "@/lib/codebook/compose";
import { editProblem, sentenceToStore } from "@/lib/codebook/edit";
import { currentVersion, isSlotGroup } from "@/lib/codebook";
import { deriveOutcome, derivePreventionFromCause } from "@/lib/codebook/derivation";
import { outcomeRow } from "@/lib/codebook/outcome";

type Context = { params: Promise<{ id: string }> };
const VERDICTS = ["AGREE", "NOT_ANSWERABLE", "DISAGREE"];
const REASONS = ["thiếu thực thể", "sai thực thể", "sai nhân quả", "sai mốc thời gian",
  "bịa chi tiết", "sai diễn đạt", "khác"];
const normalize = (text: string | null) => (text ?? "").trim().replace(/\s+/g, " ");

export async function POST(request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const verdict = String(body.verdict ?? "");
  const reason = typeof body.reason_code === "string" ? body.reason_code : null;
  const note = typeof body.reason_note === "string" ? body.reason_note.trim() : null;
  const answer = typeof body.edited_answer === "string" ? body.edited_answer.trim() : null;
  const supabase = await createClient();
  const { data: draft, error: draftError } = await supabase.from("video_drafts")
    .select("video_id,qgroup,answer,predicted_keyframes_s").eq("id", id).single();
  if (draftError || !draft) return Response.json({ error: "Không tìm thấy bản nháp." }, { status: 404 });
  if (draft.qgroup === "V") return Response.json({ error: "Nhóm V đã được gỡ khỏi luồng gán nhãn.", code: "group_removed" }, { status: 410 });
  // features/c-training-gate: a group with a training video is saved only after the caller watched it.
  const untrained = await trainingRequired(supabase, profile, draft.qgroup);
  if (untrained) return untrained;
  // Groups without evidence frames store none, even from a client that still sends some.
  // Groups that take them store exactly two: [start, end] of the event, start
  // before end (same rule as validate_qa_annotation, 20261112000016_keyframes_start_end.sql).
  const required = needsKeyframes(draft.qgroup);
  if (verdict === "SLOTS") return saveSlotAnswer(supabase, profile.id, id, draft, body);
  // A text answer never carries cells (validate_qa_annotation refuses them too).
  if (body.slots !== undefined || body.codebook_version !== undefined) {
    return Response.json({ error: "Câu trả lời dạng chữ không gửi ô.", code: "unexpected_slots" }, { status: 422 });
  }
  const marks = required ? body.human_keyframes_s : [];
  if (!VERDICTS.includes(verdict) || !Array.isArray(marks) ||
      !marks.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      (required && (marks.length !== 2 || Number(marks[0].toFixed(3)) >= Number(marks[1].toFixed(3)))) ||
      (verdict === "DISAGREE" && (!reason || !REASONS.includes(reason))) ||
      (verdict === "DISAGREE" && reason === "khác" && !note) ||
      (note?.length ?? 0) > 2000 || (answer?.length ?? 0) > 5000) {
    return Response.json({ error: required ? "Chọn nhận xét và đặt đủ 2 keyframe: start trước end." : "Chọn nhận xét hợp lệ." },
      { status: 422 });
  }
  // AGREE means the draft is the answer, so only a disagreement carries an
  // edited answer, and it must carry one (same rule as validate_qa_annotation).
  const edited = answer && normalize(answer) !== normalize(draft.answer) ? answer : null;
  if (verdict === "DISAGREE" && !edited) {
    return Response.json({ error: "Chọn Không đồng ý thì phải sửa đáp án cho đúng." }, { status: 422 });
  }
  if (verdict !== "DISAGREE" && edited) {
    return Response.json({ error: "Chỉ sửa đáp án khi chọn Không đồng ý." }, { status: 422 });
  }
  const { data, error } = await supabase.from("qa_annotations").upsert({
    draft_id: id, annotator_id: profile.id, verdict,
    reason_code: verdict === "DISAGREE" ? reason : null,
    reason_note: verdict === "DISAGREE" ? note : null,
    edited_answer: edited,
    human_keyframes_s: marks.map((value) => Number(value.toFixed(3))),
  }, { onConflict: "draft_id,annotator_id" })
    .select("draft_id,verdict,reason_code,reason_note,edited_answer,human_keyframes_s,annotated_at")
    .single();
  if (error?.message.includes("adjudicated")) {
    return Response.json({ error: "Câu này đã được thống nhất, không sửa được nữa." }, { status: 409 });
  }
  if (error) return Response.json({ error: error.message }, { status: 422 });
  await supabase.from("video_assignments").update({ status: "in_progress" })
    .eq("annotator_id", profile.id).eq("video_id", draft.video_id)
    .neq("status", "completed");
  return Response.json({ ...data, predicted_keyframes_s: draft.predicted_keyframes_s });
}

type Draft = { video_id: string; qgroup: string; answer: string; predicted_keyframes_s: number[] };
type Client = Awaited<ReturnType<typeof createClient>>;
const slotError = (code: string, error: string, status = 422) => Response.json({ error, code }, { status });

type SlotRow = { draft_id: string; slots: Slots; codebook_version: string; edited_answer: string; human_keyframes_s: number[] };

/** The caller's slot answer to another group of the same video, or null. */
async function slotAnswer(supabase: Client, annotatorId: string, videoId: string, qgroup: string): Promise<SlotRow | null> {
  const { data: other } = await supabase.from("video_drafts").select("id")
    .eq("video_id", videoId).eq("qgroup", qgroup).maybeSingle();
  if (!other) return null;
  const { data } = await supabase.from("qa_annotations").select("draft_id,slots,codebook_version,edited_answer,human_keyframes_s")
    .eq("draft_id", other.id).eq("annotator_id", annotatorId).eq("verdict", "SLOTS").maybeSingle();
  return data as SlotRow | null;
}

async function questionDraftId(supabase: Client, videoId: string, qgroup: string): Promise<string | null> {
  const { data } = await supabase.from("video_drafts").select("id").eq("video_id", videoId).eq("qgroup", qgroup).maybeSingle();
  return data?.id ?? null;
}

function derivedAnswerRows(cause: Slots, entities: { key: string; cells: Slots }[], prevDraftId: string | null) {
  const prevSlots = derivePreventionFromCause(cause, entities);
  const prevVersion = currentVersion("Prev")!;
  const rows: Record<string, unknown>[] = [];
  if (prevDraftId) rows.push({ draft_id: prevDraftId, codebook_version: prevVersion, slots: prevSlots, human_keyframes_s: [],
    edited_answer: compose("Prev", prevSlots, { version: prevVersion, entities }) });
  return rows;
}

/** Keyframes as the text branch accepts them: none outside C and Attr; there exactly [start, end]. */
function keyframesOf(qgroup: string, value: unknown): number[] | null {
  if (!needsKeyframes(qgroup)) return [];
  if (!Array.isArray(value) || value.length !== 2 ||
      !value.every((mark) => typeof mark === "number" && Number.isFinite(mark) && mark >= 0)) return null;
  const marks = value.map((mark: number) => Number(mark.toFixed(3)));
  return marks[0] < marks[1] ? marks : null;
}

// A slot answer: the cells are the answer, and the server composes the
// sentence from them (compose.ts). The annotator may edit that sentence, but
// only by adding words (edit.ts), so cells and sentence still cannot disagree.
// The database decides whether this row may be a slot answer at all
// (validate_qa_annotation reads the assignment's answer_format); the checks
// here only give the form a precise message first.
async function saveSlotAnswer(supabase: Client, annotatorId: string, draftId: string, draft: Draft,
  body: Record<string, unknown>) {
  const { data: assignment } = await supabase.from("video_assignments").select("answer_format")
    .eq("video_id", draft.video_id).eq("annotator_id", annotatorId).maybeSingle();
  if (assignment?.answer_format !== "slots" || !isSlotGroup(draft.qgroup)) {
    return slotError("text_group", "Nhóm này trả lời bằng chữ, không chọn ô.");
  }
  if (body.reason_code !== undefined || body.reason_note !== undefined) {
    return slotError("stale_page", "Trang này đã cũ: câu trả lời dạng ô không gửi lý do. Tải lại trang.");
  }
  if (body.edited_answer !== undefined && body.edited_answer !== null && typeof body.edited_answer !== "string") {
    return slotError("sentence_edit", "Câu sửa phải là chữ.");
  }
  const edited = typeof body.edited_answer === "string" ? body.edited_answer : null;
  const version = typeof body.codebook_version === "string" ? body.codebook_version : "";
  const slots = body.slots;
  if (!slots || typeof slots !== "object" || Array.isArray(slots)) return slotError("missing_slots", "Chưa chọn ô nào.");
  const marks = keyframesOf(draft.qgroup, body.human_keyframes_s);
  if (!marks) return slotError("keyframes", "Đặt đủ 2 keyframe: start trước end.");
  // Entity references are named from the caller's own E list on this video.
  const { data: declared } = await supabase.from("video_entities").select("entity_key,cells")
    .eq("video_id", draft.video_id).eq("annotator_id", annotatorId);
  const entities = (declared ?? []).map((row) => ({ key: row.entity_key as string, cells: row.cells as Slots }));
  // R names its parties after the caller's C answer, so saving C re-composes
  // an R answer already there, and both rows go in one call (spec Open 6).
  const linked = draft.qgroup === "C" || draft.qgroup === "R" || draft.qgroup === "Prev" || draft.qgroup === "O"
    ? await slotAnswer(supabase, annotatorId, draft.video_id,
      draft.qgroup === "C" ? "R" : "C") : null;
  if (draft.qgroup === "R" && !linked) return slotError("cause_missing", "Lưu nhóm C trước khi lưu nhóm R.");
  if (draft.qgroup === "Prev" && !linked) {
    return slotError("cause_missing", "Lưu nhóm C trước để hệ thống tự sinh Prev.");
  }
  if (draft.qgroup === "O" && !linked) {
    return slotError("cause_missing", "Lưu nhóm C trước để hệ thống suy ra mức độ của nhóm O.");
  }
  // The caller's C as stored before this save: an R whose sentence the new C
  // does not change keeps its own sentence, hand edits included.
  const oldCause = draft.qgroup === "C" && linked ? await slotAnswer(supabase, annotatorId, draft.video_id, "C") : null;
  const rows: Record<string, unknown>[] = [];
  try {
    // Prev and O are derived from the caller's C: what the client sent for a
    // derived cell is never stored: a near miss fixes the O level, and a collision
    // takes the highest level of its signs (features/o-codebook-v2,
    // features/o-signs-max-grouped).
    const canonicalSlots = draft.qgroup === "Prev" ? derivePreventionFromCause(linked!.slots, entities)
      : draft.qgroup === "O" ? deriveOutcome(linked!.slots, slots as Slots) ?? {} : slots as Slots;
    const canonicalVersion = draft.qgroup === "Prev" || draft.qgroup === "O" ? currentVersion(draft.qgroup)! : version;
    if (draft.qgroup === "O" && !canonicalSlots.level) {
      return slotError("missing_cell", "Nhóm C là va chạm: chọn ít nhất một dấu hiệu nhìn thấy rõ.");
    }
    const composed = compose(draft.qgroup, canonicalSlots,
      { version: canonicalVersion, entities, cause: draft.qgroup === "R" ? linked!.slots : undefined });
    const problem = edited === null || edited.trim() === composed ? null : editProblem(composed, edited);
    if (problem) return slotError("sentence_edit", problem);
    rows.push({ draft_id: draftId, codebook_version: canonicalVersion, slots: canonicalSlots,
      human_keyframes_s: marks,
      edited_answer: sentenceToStore(composed, edited) });
    if (draft.qgroup === "C") {
      rows.push(...derivedAnswerRows(slots as Slots, entities,
        await questionDraftId(supabase, draft.video_id, "Prev")));
      // A near miss fully decides O; a collision re-derives only an O.v2 answer that has signs.
      const outcome = outcomeRow(slots as Slots, await slotAnswer(supabase, annotatorId, draft.video_id, "O"), entities,
        await questionDraftId(supabase, draft.video_id, "O"));
      if (outcome) rows.push(outcome);
    }
    if (draft.qgroup === "C" && linked) {
      const linkedContext = { version: linked.codebook_version, entities };
      const next = compose("R", linked.slots, { ...linkedContext, cause: slots as Slots });
      let before: string | null = null;
      try {
        if (oldCause) before = compose("R", linked.slots, { ...linkedContext, cause: oldCause.slots });
      } catch { /* an old C that no longer composes: re-compose R */ }
      if (next !== before) {
        rows.push({ draft_id: linked.draft_id, codebook_version: linked.codebook_version, slots: linked.slots,
          human_keyframes_s: [], edited_answer: next });
      }
    }
  } catch (error) {
    if (error instanceof ComposeError) return slotError(error.code, error.message);
    throw error;
  }
  const { data: saved, error } = await supabase.rpc("save_slot_answers", { rows })
    .select("draft_id,verdict,reason_code,reason_note,edited_answer,slots,codebook_version,human_keyframes_s,annotated_at");
  const data = (saved as { draft_id: string }[] | null)?.find((row) => row.draft_id === draftId);
  // Saving C re-composes the caller's R answer; the form shows that sentence too.
  const also = (saved as { draft_id: string }[] | null)?.filter((row) => row.draft_id !== draftId) ?? [];
  if (error?.message.includes("adjudicated")) {
    return slotError("adjudicated", "Câu này đã được thống nhất, không sửa được nữa.", 409);
  }
  // validate_slots and validate_qa_annotation name the broken rule in HINT.
  if (error) return slotError(error.hint || "invalid_slots", error.message);
  await supabase.from("video_assignments").update({ status: "in_progress" })
    .eq("annotator_id", annotatorId).eq("video_id", draft.video_id)
    .neq("status", "completed");
  return Response.json({ ...data, predicted_keyframes_s: draft.predicted_keyframes_s, also });
}
