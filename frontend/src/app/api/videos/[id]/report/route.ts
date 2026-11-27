import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const REASONS = new Set(["overcut", "too_difficult", "entity_color_unclear", "cause_too_difficult"]);

export async function POST(request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id: videoId } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.reason !== "string" || !REASONS.has(body.reason)) {
    return Response.json({ error: "Chọn một lý do báo cáo hợp lệ." }, { status: 422 });
  }
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000)) {
    return Response.json({ error: "Mô tả tối đa 1000 ký tự." }, { status: 422 });
  }
  const groupReport = body.reason === "entity_color_unclear" || body.reason === "cause_too_difficult";
  const expectedGroup = body.reason === "entity_color_unclear" ? "E" : body.reason === "cause_too_difficult" ? "C" : null;
  if (groupReport && body.question_group !== expectedGroup) {
    return Response.json({ error: "Báo cáo chưa gắn đúng nhóm câu hỏi." }, { status: 422 });
  }
  if (body.reason === "entity_color_unclear" && !["A", "B"].includes(String(body.entity_key))) {
    return Response.json({ error: "Không xác định được bên có màu xe khó nhìn." }, { status: 422 });
  }
  if (body.target_label !== undefined && (typeof body.target_label !== "string" || body.target_label.length > 200)) {
    return Response.json({ error: "Thông tin nhóm tối đa 200 ký tự." }, { status: 422 });
  }

  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase.from("video_assignments")
    .select("id").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle();
  if (assignmentError) return Response.json({ error: assignmentError.message }, { status: 422 });
  if (!assignment) return Response.json({ error: "Chỉ có thể báo cáo video đã được giao cho bạn." }, { status: 403 });

  const { data, error } = await supabase.from("video_reports").insert({
    video_id: videoId,
    assignment_id: assignment.id,
    annotator_id: profile.id,
    reason: body.reason,
    question_group: groupReport ? expectedGroup : null,
    entity_key: body.reason === "entity_color_unclear" ? body.entity_key : null,
    target_label: groupReport && typeof body.target_label === "string" ? body.target_label.trim() || null : null,
    note: typeof body.note === "string" ? body.note.trim() || null : null,
  }).select("id,status,created_at").single();
  if (error?.code === "23505") {
    return Response.json({ error: "Bạn đã gửi báo cáo cho video này, đang chờ admin xử lý." }, { status: 409 });
  }
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data, { status: 201 });
}
