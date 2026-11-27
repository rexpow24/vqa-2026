import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_assigned_video");
  if (error) return Response.json({ error: error.message }, { status: 422 });
  const next = Array.isArray(data) && data.length ? data[0] : null;
  return Response.json({ next_video_id: next?.video_id ?? null, next_filename: next?.filename ?? null });
}
