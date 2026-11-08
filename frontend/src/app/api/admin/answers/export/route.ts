import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

// Every saved answer, one row per (question, annotator), for computing
// agreement outside the app: ?scope=agreement|all&from=&to= (video numbers).
export const maxDuration = 60;

const HEADER = [
  "seq", "filename", "agreement", "annotator_email", "annotator_name", "assignment_status", "batch",
  "qgroup", "question", "draft_answer", "verdict", "reason_code", "reason_note", "edited_answer",
  "effective_answer", "human_keyframes_s", "annotated_at", "event_label", "draft_id", "video_id", "annotator_id",
];
// PostgREST caps a response at 1000 rows; the RPC orders rows deterministically,
// so reading it page by page returns each row exactly once.
const PAGE = 1000;

export async function GET(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const params = new URL(request.url).searchParams;
  const number = (name: string) => {
    const raw = params.get(name)?.trim();
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
  };
  const scope = params.get("scope") === "all" ? "all" : "agreement";
  const from = number("from");
  const to = number("to");
  if (from !== null && to !== null && from > to) return Response.json({ error: "Từ số phải ≤ đến số." }, { status: 422 });

  const supabase = await createClient();
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .rpc("answers_export", { only_agreement: scope === "agreement", seq_from: from, seq_to: to })
      .range(offset, offset + PAGE - 1);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const range = from !== null || to !== null ? `-${from ?? 1}-${to ?? "end"}` : "";
  return new Response(toCsv(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="answers-${scope}${range}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
