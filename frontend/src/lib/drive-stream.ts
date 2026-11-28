/**
 * Delivers a link-shared Drive video after callers check who may see it.
 * With a configured video Worker, only a small encrypted redirect passes
 * through Vercel; otherwise the existing Vercel stream remains available.
 */
import { workerVideoUrl } from "./video-worker";

export async function proxyDriveVideo(request: Request, driveFileId: string, head = false): Promise<Response> {
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) {
    return new Response("Invalid range", { status: 416 });
  }
  const source = new URL("https://drive.google.com/uc");
  source.searchParams.set("export", "download");
  source.searchParams.set("id", driveFileId);
  // Local demonstration only. The browser cannot embed Drive's download URL
  // because Drive sends Cross-Origin-Resource-Policy: same-site.
  const url = new URL(request.url);
  if (process.env.NODE_ENV === "development" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.searchParams.get("direct_drive_preview") === "link") {
    return Response.json({ driveUrl: source.href }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const workerUrl = workerVideoUrl(driveFileId);
  if (workerUrl) return new Response(null, {
    status: 307,
    headers: { Location: workerUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
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
