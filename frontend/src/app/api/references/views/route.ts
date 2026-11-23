import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { referenceDriveId } from "@/lib/references";

/**
 * Logs one reference clip opened from the labeling page (features/c-reference-hints),
 * so the admin statistics page can show who opens them least.
 */
export async function POST(request: Request) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const reference = String(body.reference ?? "");
  if (!referenceDriveId(reference)) return Response.json({ error: "Unknown reference" }, { status: 422 });
  const chosen = typeof body.chosen === "string" && /^K\d\d$/.test(body.chosen) ? body.chosen : null;
  const videoId = typeof body.video_id === "string" ? body.video_id : null;
  const supabase = await createClient();
  const { error } = await supabase.from("reference_views").insert({
    annotator_id: profile.id, video_id: videoId, qgroup: "C", reference, chosen,
  });
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json({ ok: true });
}
