import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const afterVideoId = new URL(request.url).searchParams.get("after_video_id");
  if (!afterVideoId || !/^[0-9a-f-]{36}$/i.test(afterVideoId)) {
    return Response.json({ error: "Cần video hiện tại để tìm video tiếp theo." }, { status: 422 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_assigned_video_after", { after_video_id: afterVideoId });
  if (error) return Response.json({ error: error.message }, { status: 422 });
  const next = Array.isArray(data) && data.length ? data[0] : null;
  return Response.json({ next_video_id: next?.video_id ?? null, next_filename: next?.filename ?? null });
}
