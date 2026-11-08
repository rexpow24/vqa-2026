import { parse } from "csv-parse/sync";
import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// Admin assignment actions, each a thin wrapper over one RPC in
// 20261108_assigned_labeling.sql (the rules live there, not here).
export const maxDuration = 60;
type Context = { params: Promise<{ action: string }> };

const int = (value: unknown) => (typeof value === "number" || typeof value === "string") && /^\d+$/.test(String(value).trim())
  ? Number(value) : null;
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

export async function POST(request: Request, context: Context) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const { action } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const supabase = await createClient();
  const respond = ({ data, error }: { data: unknown; error: { message: string } | null }) =>
    error ? Response.json({ error: error.message }, { status: 422 }) : Response.json(data);

  if (action === "range" || action === "unassign") {
    const annotator = uuid(body.annotator_id);
    const from = int(body.from);
    const to = int(body.to);
    if (!annotator || from === null || to === null || from < 1 || from > to) {
      return Response.json({ error: "Chọn người gán nhãn và khoảng số hợp lệ (từ ≤ đến)." }, { status: 422 });
    }
    return respond(action === "range"
      ? await supabase.rpc("assign_range", { annotator, seq_from: from, seq_to: to,
          batch_label: typeof body.batch === "string" ? body.batch.slice(0, 100) : null })
      : await supabase.rpc("unassign_range", { annotator, seq_from: from, seq_to: to }));
  }
  if (action === "plan" || action === "create-group") {
    const size = int(body.size);
    if (!size || size < 1) return Response.json({ error: "Số video của nhóm agreement phải ≥ 1." }, { status: 422 });
    return respond(action === "plan"
      ? await supabase.rpc("plan_agreement_group", { group_size: size })
      : await supabase.rpc("create_agreement_group", { group_size: size }));
  }
  if (action === "assign-group") {
    const ids = Array.isArray(body.annotator_ids) ? body.annotator_ids.map(uuid) : [];
    if (!ids.length || ids.some((id) => !id)) return Response.json({ error: "Chọn ít nhất một người." }, { status: 422 });
    return respond(await supabase.rpc("assign_agreement_group", { annotators: ids }));
  }
  if (action === "reference-labels") {
    // CSV from scripts/export_labels_csv.py: video_id (shot stem), or filename / clip_id; difficulty; event_label.
    if (typeof body.csv !== "string" || body.csv.length > 4_000_000) {
      return Response.json({ error: "Cần nội dung CSV tối đa 4 MB." }, { status: 422 });
    }
    let records: Record<string, string>[];
    try { records = parse(body.csv, { columns: true, bom: true, skip_empty_lines: true, trim: true }); }
    catch (cause) { return Response.json({ error: `CSV không đọc được: ${cause instanceof Error ? cause.message : cause}` }, { status: 422 }); }
    if (!records.length || !("difficulty" in records[0]) || !("event_label" in records[0]) ||
        !("video_id" in records[0] || "filename" in records[0] || "clip_id" in records[0])) {
      return Response.json({ error: "Cần các cột video_id (hoặc filename / clip_id), difficulty, event_label." }, { status: 422 });
    }
    const rows = records.map((record) => ({
      key: record.video_id ?? record.filename ?? record.clip_id ?? "",
      difficulty: record.difficulty, event_label: record.event_label,
    }));
    return respond(await supabase.rpc("import_reference_labels", { rows }));
  }
  return Response.json({ error: "Unknown action" }, { status: 404 });
}
