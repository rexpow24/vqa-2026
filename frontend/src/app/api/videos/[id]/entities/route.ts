import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { currentVersion, getCodebook } from "@/lib/codebook";
import { ComposeError, compose } from "@/lib/codebook/compose";
import { trainingRequired } from "@/lib/trainings-server";

type Context = { params: Promise<{ id: string }> };
type Entity = { key: string; cells: Record<string, unknown> };
const slotError = (code: string, error: string, status = 422) => Response.json({ error, code }, { status });

// The entities A, B, C of the caller on one video. video_entities is their
// only owner and is written only through save_video_entities, which also
// re-saves the E answer as their snapshot; the sentence of that answer is
// composed here (compose.ts), so the client never sends one.
export async function PUT(request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  // features/c-training-gate: group E is saved only after the caller watched the E training video.
  const untrained = await trainingRequired(await createClient(), profile, "E");
  if (untrained) return untrained;
  // Always the current E book, whatever an old open page sends (the O/Prev
  // pattern): E.v5 takes at most the two main parties, so an E.v4 page must not
  // keep writing lists of three (features/two-entity-subject-rules).
  const version = currentVersion("E")!;
  const entities = body.entities;
  if (!Array.isArray(entities) || !entities.every((entity): entity is Entity =>
    Boolean(entity) && typeof entity === "object" && typeof entity.key === "string" &&
    Boolean(entity.cells) && typeof entity.cells === "object" && !Array.isArray(entity.cells))) {
    return slotError("invalid_value", "Danh sách các bên không hợp lệ.");
  }
  const limit = getCodebook(version)?.max_entities;
  if (typeof limit === "number" && entities.length > limit) {
    return slotError("too_many_entities", `Chỉ khai báo ${limit} bên chính: cặp va chạm đầu tiên, không có va chạm thì cặp suýt va chạm đầu tiên.`);
  }
  // Only the cells the current book defines: a page opened before E.v6 still
  // sends colours, which E.v6 no longer has (features/e-v6-no-colors).
  const defined = new Set(getCodebook(version)?.cells.map((cell) => cell.id) ?? []);
  const ordered = [...entities].sort((a, b) => a.key.localeCompare(b.key)).map((entity) => ({
    key: entity.key, cells: Object.fromEntries(Object.entries(entity.cells).filter(([cellId]) => defined.has(cellId))),
  }));
  let sentence: string;
  try {
    sentence = compose("E", { entities: ordered }, { version });
  } catch (error) {
    if (error instanceof ComposeError) return slotError(error.code, error.message);
    throw error;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_video_entities", {
    target_video: id, version, entities: ordered, e_answer: sentence,
  });
  if (error?.hint === "forbidden") return slotError("forbidden", "Video này không được giao cho bạn dạng chọn ô.", 403);
  if (error?.hint === "entity_referenced") {
    // guard_referenced_entity puts {entity, groups} in DETAIL; nothing was saved.
    let used: { entity?: string; groups?: string[] } = {};
    try { used = JSON.parse(error.details ?? "{}"); } catch { /* keep the message alone */ }
    return Response.json({
      error: `Bên ${used.entity ?? ""} đang được dùng ở nhóm ${(used.groups ?? []).join(", ")}; xóa câu đã chọn ở các nhóm này trước.`,
      code: "entity_referenced", entity: used.entity, groups: used.groups ?? [],
    }, { status: 409 });
  }
  if (error?.message.includes("adjudicated")) {
    return slotError("adjudicated", "Câu này đã được thống nhất, không sửa được nữa.", 409);
  }
  if (error) return slotError(error.hint || "invalid_slots", error.message);
  await supabase.from("video_assignments").update({ status: "in_progress" })
    .eq("annotator_id", profile.id).eq("video_id", id)
    .neq("status", "completed");
  return Response.json(data);
}
