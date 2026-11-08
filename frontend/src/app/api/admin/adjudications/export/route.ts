import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { exportTable, type ExportRow } from "@/lib/adjudication";
import { toCsv } from "@/lib/csv";

// Open conflicts (answers and event labels) as a CSV the team fills in.
export async function GET(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjudication_export");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { header, records } = exportTable((data ?? []) as ExportRow[], new URL(request.url).origin);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new Response(toCsv(header, records), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adjudication-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
