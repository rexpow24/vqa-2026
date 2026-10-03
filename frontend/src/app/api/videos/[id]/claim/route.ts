import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  const supabase = await createClient();
  const { count: draftCount, error: draftError } = await supabase.from("video_drafts")
    .select("id", { count: "exact", head: true }).eq("video_id", id);
  if (draftError) return Response.json({ error: draftError.message }, { status: 500 });
  if (draftCount !== 9) return Response.json({ error: "Video chưa có đủ 9 bản nháp để gán nhãn." }, { status: 409 });
  const { data: existing } = await supabase.from("video_assignments")
    .select("id,status").eq("video_id", id).eq("annotator_id", profile.id).maybeSingle();
  if (existing) return Response.json(existing);
  const { data, error } = await supabase.from("video_assignments")
    .insert({ video_id: id, annotator_id: profile.id, status: "pending" })
    .select("id,status").single();
  if (error) return Response.json({ error: error.code === "23505" ? "Already assigned" : error.message }, { status: 409 });
  return Response.json(data, { status: 201 });
}
