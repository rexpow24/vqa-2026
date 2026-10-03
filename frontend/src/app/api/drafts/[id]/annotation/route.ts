import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const VERDICTS = ["AGREE", "NOT_ANSWERABLE", "DISAGREE"];
const REASONS = ["thiếu thực thể", "sai thực thể", "sai nhân quả", "sai mốc thời gian",
  "bịa chi tiết", "sai diễn đạt", "khác"];

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
  const marks = body.human_keyframes_s;
  if (!VERDICTS.includes(verdict) || !Array.isArray(marks) || marks.length < 1 || marks.length > 3 ||
      !marks.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      (verdict === "DISAGREE" && (!reason || !REASONS.includes(reason))) ||
      (verdict === "DISAGREE" && reason === "khác" && !note) ||
      (note?.length ?? 0) > 2000 || (answer?.length ?? 0) > 5000) {
    return Response.json({ error: "Chọn nhận xét và 1-3 mốc bằng chứng hợp lệ." }, { status: 422 });
  }
  const supabase = await createClient();
  const { data: draft, error: draftError } = await supabase.from("video_drafts")
    .select("video_id,predicted_keyframes_s").eq("id", id).single();
  if (draftError || !draft) return Response.json({ error: "Không tìm thấy bản nháp." }, { status: 404 });
  const { data, error } = await supabase.from("qa_annotations").upsert({
    draft_id: id, annotator_id: profile.id, verdict,
    reason_code: verdict === "DISAGREE" ? reason : null,
    reason_note: verdict === "DISAGREE" ? note : null,
    edited_answer: answer,
    human_keyframes_s: marks.map((value) => Number(value.toFixed(3))),
  }, { onConflict: "draft_id,annotator_id" })
    .select("draft_id,verdict,reason_code,reason_note,edited_answer,human_keyframes_s,annotated_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  await supabase.from("video_assignments").update({ status: "in_progress" })
    .eq("annotator_id", profile.id).eq("video_id", draft.video_id)
    .neq("status", "completed");
  return Response.json({ ...data, predicted_keyframes_s: draft.predicted_keyframes_s });
}
