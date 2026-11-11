import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { needsKeyframes } from "@/lib/qgroups";

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
  // Groups without evidence frames store none, even from a client that still sends some.
  // Groups that take them store exactly two: [start, end] of the event, start
  // before end (same rule as validate_qa_annotation, 20261112_keyframes_start_end.sql).
  const required = needsKeyframes(draft.qgroup);
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
