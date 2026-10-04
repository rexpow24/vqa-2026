import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { GROUP_CODES as GROUPS, GROUP_NAMES as NAMES } from "@/lib/qgroups";

type Context = { params: Promise<{ id: string }> };
const COLUMNS = ["video_id", "qgroup", "question", "answer", "difficulty", "event_label"];

export async function POST(request: Request, context: Context) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size > 2_000_000) {
    return Response.json({ error: "Chọn file CSV UTF-8 tối đa 2 MB." }, { status: 422 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  let parsed: Record<string, string>[];
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = parse(source, { columns: true, bom: true, skip_empty_lines: true, trim: true });
  } catch {
    return Response.json({ error: "CSV không hợp lệ hoặc không phải UTF-8." }, { status: 422 });
  }
  if (parsed.length !== 9 || parsed.some((row) =>
    Object.keys(row).length !== COLUMNS.length || COLUMNS.some((column) => !(column in row)))) {
    return Response.json({ error: "CSV cần đúng 9 dòng và các cột video_id,qgroup,question,answer,difficulty,event_label." }, { status: 422 });
  }
  const seen = new Set<string>();
  let difficulty: string | null = null;
  let eventLabel: string | null = null;
  for (const row of parsed) {
    if (row.video_id !== id || !GROUPS.includes(row.qgroup) || seen.has(row.qgroup) ||
        !row.question || !row.answer || row.question.length > 1000 || row.answer.length > 5000) {
      return Response.json({ error: "video_id phải khớp; 9 nhóm không trùng và mỗi câu cần câu hỏi, câu trả lời." }, { status: 422 });
    }
    seen.add(row.qgroup);
    const rowDifficulty = row.difficulty || null;
    const rowEvent = row.event_label || null;
    if ((rowDifficulty === null) !== (rowEvent === null) ||
        (rowDifficulty !== null && !["easy", "medium", "high"].includes(rowDifficulty)) ||
        (rowEvent !== null && !["accident", "near-miss"].includes(rowEvent))) {
      return Response.json({ error: "Nhãn tham chiếu phải có cả difficulty và event_label đúng từ vựng." }, { status: 422 });
    }
    if (seen.size === 1) { difficulty = rowDifficulty; eventLabel = rowEvent; }
    else if (difficulty !== rowDifficulty || eventLabel !== rowEvent) {
      return Response.json({ error: "Nhãn tham chiếu phải giống nhau ở cả 9 dòng." }, { status: 422 });
    }
  }
  const rows = GROUPS.map((group) => {
    const row = parsed.find((item) => item.qgroup === group)!;
    return { qgroup: group, group_name: NAMES[group], question: row.question, answer: row.answer };
  });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_video_drafts", {
    target_video_id: id, rows, csv_sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    reference_difficulty: difficulty, reference_event_label: eventLabel,
  });
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json({ imported: data });
}
