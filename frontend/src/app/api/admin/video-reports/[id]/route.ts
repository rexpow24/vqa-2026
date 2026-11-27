import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (body.action !== "needs_relabel" && body.action !== "dismissed") {
    return Response.json({ error: "Chọn hành động hợp lệ." }, { status: 422 });
  }
  if (body.vote_summary !== undefined && (typeof body.vote_summary !== "string" || body.vote_summary.length > 500)) {
    return Response.json({ error: "Kết quả vote tối đa 500 ký tự." }, { status: 422 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_resolve_video_report", {
    p_report_id: id, p_action: body.action, p_vote_summary: typeof body.vote_summary === "string" ? body.vote_summary.trim() || null : null,
  });
  if (error) {
    const status = error.message.includes("already resolved") ? 409 : 422;
    return Response.json({ error: error.message }, { status });
  }
  return Response.json(data);
}
