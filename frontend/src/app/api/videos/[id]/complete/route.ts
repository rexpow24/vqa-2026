import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("video_assignments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("video_id", id).eq("annotator_id", profile.id)
    .select("id,status,completed_at").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  if (!data) return Response.json({ error: "Assignment not found" }, { status: 404 });
  return Response.json(data);
}
