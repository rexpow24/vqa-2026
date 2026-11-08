import { parse } from "csv-parse/sync";
import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { IMPORT_COLUMNS, isUndecided, parseFollowed, parseKeyframes } from "@/lib/adjudication";

// The filled adjudication CSV. Rows nobody decided yet are skipped, so a file
// can be uploaded half done; every other row reports saved / stale /
// not_conflict / invalid from import_adjudications().
export const maxDuration = 60;
const BATCH = 200;

type Result = { line: number; status: string; reason: string | null; filename: string; qgroup: string };

export async function POST(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  let csv: unknown;
  try { csv = (await request.json()).csv; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof csv !== "string" || csv.length > 4_000_000) {
    return Response.json({ error: "Cần nội dung CSV tối đa 4 MB." }, { status: 422 });
  }
  let records: Record<string, string>[];
  try {
    records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true });
  } catch (cause) {
    return Response.json({ error: `CSV không đọc được: ${cause instanceof Error ? cause.message : cause}` }, { status: 422 });
  }
  const missing = IMPORT_COLUMNS.filter((name) => records.length && !(name in records[0]));
  if (!records.length || missing.length) {
    return Response.json({ error: records.length ? `Thiếu cột: ${missing.join(", ")}. Hãy dùng file tải từ nút "Tải CSV mâu thuẫn".`
      : "File không có dòng dữ liệu." }, { status: 422 });
  }

  const results: Result[] = [];
  const pending: { line: number; record: Record<string, string> }[] = [];
  records.forEach((record, index) => {
    const line = index + 2;
    if (isUndecided(record)) results.push({ line, status: "skipped", reason: null, filename: record.filename ?? "", qgroup: record.qgroup ?? "" });
    else pending.push({ line, record });
  });
  const supabase = await createClient();
  for (let start = 0; start < pending.length; start += BATCH) {
    const batch = pending.slice(start, start + BATCH);
    const { data, error } = await supabase.rpc("import_adjudications", { rows: batch.map(({ record }) => ({
      kind: record.kind?.trim(), video_id: record.video_id?.trim() || null, draft_id: record.draft_id?.trim() || null,
      fingerprint: record.fingerprint?.trim(), final_verdict: record.final_verdict?.trim().toUpperCase() || null,
      final_answer: record.final_answer, final_keyframes_s: parseKeyframes(record.final_keyframes_s),
      final_event_label: record.final_event_label?.trim().toLowerCase() || null,
      llm_suggestion: record.llm_suggestion, followed_llm: parseFollowed(record.followed_llm),
    })) });
    if (error) return Response.json({ error: error.message, results }, { status: 500 });
    for (const item of data as { index: number; status: string; reason: string | null }[]) {
      const { line, record } = batch[item.index];
      results.push({ line, status: item.status, reason: item.reason, filename: record.filename ?? "", qgroup: record.qgroup ?? "" });
    }
  }
  results.sort((a, b) => a.line - b.line);
  return Response.json({ results });
}
