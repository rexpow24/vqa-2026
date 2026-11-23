/**
 * Streams a link-shared Drive video through the app, passing the byte range on
 * so the browser can seek. Callers check who may see the file first; this only
 * fetches it anonymously from Drive.
 */
export async function proxyDriveVideo(request: Request, driveFileId: string, head = false): Promise<Response> {
  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) {
    return new Response("Invalid range", { status: 416 });
  }
  const source = new URL("https://drive.google.com/uc");
  source.searchParams.set("export", "download");
  source.searchParams.set("id", driveFileId);
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
