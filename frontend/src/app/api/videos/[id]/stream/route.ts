import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function stream(request: Request, context: Context, head = false) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos")
    .select("drive_file_id,status")
    .eq("id", id).single();
  if (!video || video.status !== "active") return new Response("Not found", { status: 404 });

  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) {
    return new Response("Invalid range", { status: 416 });
  }
  const source = new URL("https://drive.google.com/uc");
  source.searchParams.set("export", "download");
  source.searchParams.set("id", video.drive_file_id);
  let upstream: Response;
  try {
    upstream = await fetch(source, {
      method: head ? "HEAD" : "GET",
      headers: range ? { Range: range } : {},
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return new Response("Drive is unavailable", { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("video/")) {
    return new Response("Drive video is unavailable", { status: 502 });
  }
  if (range && upstream.status !== 206) {
    return new Response("Drive did not honor the byte range", { status: 502 });
  }
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(head ? null : upstream.body, { status: upstream.status, headers });
}

export async function GET(request: Request, context: Context) {
  return stream(request, context);
}

export async function HEAD(request: Request, context: Context) {
  return stream(request, context, true);
}
