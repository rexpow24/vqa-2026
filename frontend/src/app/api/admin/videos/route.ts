import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const driveFileId = typeof body.drive_file_id === "string" ? body.drive_file_id.trim() : "";
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const duration = Number(body.duration_s);
  if (!/^[\w-]{10,}$/.test(driveFileId) || !filename || !Number.isFinite(duration) || duration <= 0) {
    return Response.json({ error: "Invalid Drive file ID, filename, or duration" }, { status: 422 });
  }
  try {
    const source = new URL("https://drive.google.com/uc");
    source.searchParams.set("export", "download");
    source.searchParams.set("id", driveFileId);
    const probe = await fetch(source, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
    if (probe.status !== 206 || !(probe.headers.get("content-type") ?? "").startsWith("video/")) {
      return Response.json({ error: "Drive file is not a seekable video" }, { status: 422 });
    }
    await probe.body?.cancel();
  } catch {
    return Response.json({ error: "Could not verify Drive video" }, { status: 502 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("videos")
    .insert({ drive_file_id: driveFileId, filename, duration_s: duration, status: "active", available: true })
    .select("id,drive_file_id,filename,duration_s,available,status").single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data, { status: 201 });
}
