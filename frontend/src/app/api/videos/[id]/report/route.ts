import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { currentVersion, getCodebook } from "@/lib/codebook";

type Context = { params: Promise<{ id: string }> };
const REASONS = new Set(["overcut", "too_difficult", "entity_color_unclear", "cause_too_difficult", "cell_conflict"]);

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
    .select("id,answer_format").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle();
  if (assignmentError) return Response.json({ error: assignmentError.message }, { status: 422 });
  if (!assignment) return Response.json({ error: "Chỉ có thể báo cáo video đã được giao cho bạn." }, { status: 403 });

  let reportSnapshot: Record<string, unknown> | null = null;
  if (body.reason === "cell_conflict") {
    const group = body.question_group;
    const targetCell = body.target_cell;
    const targetIndex = body.target_index;
    const entityKey = body.entity_key;
    if (!(typeof group === "string" && ["S", "E", "C", "R", "O"].includes(group))
      || typeof targetCell !== "string" || typeof body.target_label !== "string" || !body.target_label.trim()
      || (targetIndex !== undefined && (!Number.isInteger(targetIndex) || Number(targetIndex) < 0 || Number(targetIndex) > 1))
      || (group === "E" ? !["A", "B"].includes(String(entityKey)) : entityKey !== undefined && entityKey !== null)) {
      return Response.json({ error: "Chọn một ô hợp lệ để xin phân xử." }, { status: 422 });
    }
    if (assignment.answer_format !== "slots") return Response.json({ error: "Báo cáo theo ô chỉ hỗ trợ câu trả lời dạng ô." }, { status: 422 });
    const reportGroup = group as "S" | "E" | "C" | "R" | "O";
    const cellId = targetCell as string;
    const index = targetIndex as number | undefined;
    const selectedEntity = entityKey as string | undefined;
    const version = currentVersion(reportGroup);
    const cell = version ? getCodebook(version)?.cells.find((candidate) => candidate.id === cellId) : null;
    if (!cell) return Response.json({ error: "Không tìm thấy ô trong codebook hiện tại." }, { status: 422 });

    let answer: Record<string, unknown> | null = null;
    if (reportGroup === "E") {
      const { data: rows, error } = await supabase.from("video_entities").select("entity_key,cells")
        .eq("video_id", videoId).eq("annotator_id", profile.id).order("entity_key");
      if (error) return Response.json({ error: error.message }, { status: 422 });
      const entities = (rows ?? []).map((row) => ({ key: row.entity_key, cells: row.cells as Record<string, unknown> }));
      const entity = entities.find((item) => item.key === selectedEntity);
      if (!entity || !(cellId in entity.cells)) return Response.json({ error: "Ô này chưa được lưu trong câu trả lời của bạn." }, { status: 422 });
      const safeEntities = entities.map((item) => ({ key: item.key, cells: { ...item.cells } }));
      delete safeEntities.find((item) => item.key === selectedEntity)!.cells[cellId];
      answer = { entities: safeEntities };
    } else {
      const { data: draft, error: draftError } = await supabase.from("video_drafts").select("id")
        .eq("video_id", videoId).eq("qgroup", reportGroup).maybeSingle();
      if (draftError || !draft) return Response.json({ error: draftError?.message ?? "Không tìm thấy nhóm câu hỏi." }, { status: 422 });
      const { data: annotation, error } = await supabase.from("qa_annotations").select("slots")
        .eq("draft_id", draft.id).eq("annotator_id", profile.id).maybeSingle();
      if (error || !annotation?.slots) return Response.json({ error: error?.message ?? "Hãy lưu câu trả lời trước khi xin phân xử." }, { status: 422 });
      const slots = structuredClone(annotation.slots as Record<string, unknown>);
      if (index !== undefined) {
        const parties = slots.parties;
        if (!Array.isArray(parties) || !parties[index] || typeof parties[index] !== "object"
          || !(cellId in (parties[index] as Record<string, unknown>))) {
          return Response.json({ error: "Ô này chưa có trong câu trả lời đã lưu." }, { status: 422 });
        }
        delete (parties[index] as Record<string, unknown>)[cellId];
      } else {
        if (!(cellId in slots)) return Response.json({ error: "Ô này chưa có trong câu trả lời đã lưu." }, { status: 422 });
        delete slots[cellId];
      }
      answer = { slots };
    }
    reportSnapshot = { question_group: reportGroup, answer };
  }

  const { data, error } = await supabase.from("video_reports").insert({
    video_id: videoId,
    assignment_id: assignment.id,
    annotator_id: profile.id,
    reason: body.reason,
    question_group: body.reason === "cell_conflict" ? body.question_group as string : groupReport ? expectedGroup : null,
    entity_key: body.reason === "entity_color_unclear" || body.reason === "cell_conflict" && body.question_group === "E" ? body.entity_key : null,
    target_label: (groupReport || body.reason === "cell_conflict") && typeof body.target_label === "string" ? body.target_label.trim() || null : null,
    target_cell: body.reason === "cell_conflict" ? body.target_cell as string : null,
    target_index: body.reason === "cell_conflict" && Number.isInteger(body.target_index) ? body.target_index as number : null,
    report_snapshot: reportSnapshot,
    note: typeof body.note === "string" ? body.note.trim() || null : null,
  }).select("id,status,created_at").single();
  if (error?.code === "23505") {
    return Response.json({ error: "Bạn đã gửi báo cáo cho video này, đang chờ admin xử lý." }, { status: 409 });
  }
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data, { status: 201 });
}
