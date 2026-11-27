import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const admin = await requireApiProfile("admin");
  if (admin instanceof Response) return admin;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.answer !== "string") return Response.json({ error: "Nhập đáp án cuối cùng." }, { status: 422 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_finalize_cell_report", { p_report_id: id, p_answer: body.answer });
  if (error) return Response.json({ error: error.message }, { status: error.message.includes("already finalized") ? 409 : 422 });
  return Response.json(data);
}
