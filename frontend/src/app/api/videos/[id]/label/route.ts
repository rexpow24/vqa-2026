import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!["easy", "medium", "high"].includes(String(body.difficulty)) ||
      !["accident", "near-miss"].includes(String(body.event_label))) {
    return Response.json({ error: "Chọn độ khó và loại sự kiện hợp lệ." }, { status: 422 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("video_labels").upsert({
    video_id: id, annotator_id: profile.id,
    difficulty: body.difficulty, event_label: body.event_label,
  }, { onConflict: "video_id,annotator_id" })
    .select("difficulty,event_label,labeled_at").single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data);
}
