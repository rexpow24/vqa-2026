import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { GROUP_CODES } from "@/lib/qgroups";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id: videoId } = await context.params;
  const supabase = await createClient();
  const [{ data: assignment }, { data: drafts, error: draftsError }] = await Promise.all([
    supabase.from("video_assignments").select("answer_format,status").eq("video_id", videoId)
      .eq("annotator_id", profile.id).maybeSingle(),
    supabase.from("video_drafts").select("id,qgroup,group_name").eq("video_id", videoId),
  ]);
  if (!assignment || assignment.answer_format !== "slots") return Response.json({ error: "Không tìm thấy bài gán nhãn dạng ô." }, { status: 404 });
  if (assignment.status === "completed") return Response.json({ error: "Video đã hoàn tất." }, { status: 409 });
  if (draftsError) return Response.json({ error: draftsError.message }, { status: 500 });
  const byGroup = new Map((drafts ?? []).map((draft) => [draft.qgroup, draft]));
  const sourceGroups = GROUP_CODES.filter((group) => group !== "N");
  const sourceDrafts = sourceGroups.map((group) => byGroup.get(group));
  const nDraft = byGroup.get("N");
  if (!nDraft || sourceDrafts.some((draft) => !draft)) return Response.json({ error: "Thiếu nhóm nguồn để tổng hợp N." }, { status: 409 });
  const { data: answers, error } = await supabase.from("qa_annotations")
    .select("draft_id,verdict,edited_answer,generated_answer")
    .eq("annotator_id", profile.id).in("draft_id", sourceDrafts.map((draft) => draft!.id));
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const answerByDraft = new Map((answers ?? []).map((answer) => [answer.draft_id, answer]));
  const missing = sourceDrafts.filter((draft) => {
    const answer = answerByDraft.get(draft!.id);
    return !answer || !["SLOTS", "AGREE", "NOT_ANSWERABLE", "DISAGREE"].includes(answer.verdict);
  });
  if (missing.length) return Response.json({ complete: false, missing: missing.map((draft) => draft!.qgroup) });
  const lines = sourceDrafts.flatMap((draft) => {
    const answer = answerByDraft.get(draft!.id)!;
    const text = answer.edited_answer?.trim() || answer.generated_answer?.trim();
    return text ? [`${draft!.qgroup} - ${draft!.group_name}: ${text}`] : [];
  });
  const generatedAnswer = lines.join("\n");
  if (!generatedAnswer) return Response.json({ error: "Chưa có nội dung để tạo N." }, { status: 409 });
  const { data, error: saveError } = await supabase.from("qa_annotations").upsert({
    draft_id: nDraft.id, annotator_id: profile.id, verdict: "AGREE", reason_code: null, reason_note: null,
    edited_answer: null, generated_answer: generatedAnswer, human_keyframes_s: [],
  }, { onConflict: "draft_id,annotator_id" })
    .select("draft_id,verdict,generated_answer,annotated_at").single();
  if (saveError) return Response.json({ error: saveError.message }, { status: 422 });
  await supabase.from("video_assignments").update({ status: "in_progress" })
    .eq("annotator_id", profile.id).eq("video_id", videoId).neq("status", "completed");
  return Response.json({ complete: true, ...data });
}
