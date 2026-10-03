import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.video_id !== "string" || typeof body.annotator_id !== "string") {
    return Response.json({ error: "Invalid assignment" }, { status: 422 });
  }
  const supabase = await createClient();
  const { data: annotator } = await supabase.from("user_profiles")
    .select("role,enabled").eq("id", body.annotator_id).single();
  if (!annotator || annotator.role !== "annotator" || !annotator.enabled) {
    return Response.json({ error: "Choose an active annotator" }, { status: 422 });
  }
  const { data, error } = await supabase.from("video_assignments")
    .insert({ video_id: body.video_id, annotator_id: body.annotator_id, status: "pending" })
    .select("id,video_id,annotator_id,status").single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data, { status: 201 });
}
