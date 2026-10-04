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

  // Hand back the next video so the client can go straight there instead of
  // bouncing through the list. The just-completed video is already excluded
  // from annotator_queue, so asking for one row after the update is enough.
  const { data: queue } = await supabase.rpc("annotator_queue", { page_size: 1, page_offset: 0 });
  const next = Array.isArray(queue) && queue.length ? queue[0] : null;
  return Response.json({
    ...data,
    next_video_id: next?.video_id ?? null,
    next_filename: next?.filename ?? null,
  });
}
