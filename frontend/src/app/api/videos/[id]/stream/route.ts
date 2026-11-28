import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { proxyDriveVideo } from "@/lib/drive-stream";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function stream(request: Request, context: Context, head = false) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  // RLS shows a video only to its assignees (and admins); drive_file_id is
  // readable by no session, so it is looked up privileged after that check.
  const supabase = await createClient();
  const { data: visible } = await supabase.from("videos").select("id,status").eq("id", id).maybeSingle();
  if (!visible) {
    const { data: helping } = await supabase.rpc("can_view_resolution_video", { p_video_id: id });
    if (!helping) return new Response("Not found", { status: 404 });
  } else if (visible.status !== "active") return new Response("Not found", { status: 404 });
  const { data: video } = await createAdminClient().from("videos").select("drive_file_id").eq("id", id).single();
  if (!video) return new Response("Not found", { status: 404 });

  return proxyDriveVideo(request, video.drive_file_id, head);
}

export async function GET(request: Request, context: Context) {
  return stream(request, context);
}

export async function HEAD(request: Request, context: Context) {
  return stream(request, context, true);
}
