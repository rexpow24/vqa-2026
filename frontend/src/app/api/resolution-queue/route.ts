import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  if (profile.role !== "annotator") return Response.json({ error: "Annotator access required" }, { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cell_resolution_queue");
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json({ reports: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  if (profile.role !== "annotator") return Response.json({ error: "Annotator access required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.report_id !== "string" || typeof body.answer !== "string") return Response.json({ error: "Thiếu đáp án." }, { status: 422 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_cell_resolution_vote", { p_report_id: body.report_id, p_answer: body.answer });
  if (error) return Response.json({ error: error.message }, { status: error.message.includes("no longer open") ? 409 : 422 });
  return Response.json(data);
}
