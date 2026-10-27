// The one definition of "Drive serves this id as a seekable video", shared by
// the single-add route and the CSV import so the two checks cannot drift.
// The stream route plays videos through this same public `uc` URL, so a 206
// with a video content type here is what playback will actually see.
export async function probeDriveVideo(driveFileId: string): Promise<"ok" | "not_video" | "unreachable"> {
  const source = new URL("https://drive.google.com/uc");
  source.searchParams.set("export", "download");
  source.searchParams.set("id", driveFileId);
  // Only the headers matter. Aborting releases the connection; awaiting
  // `body.cancel()` instead never settled under the Next.js server (measured:
  // headers in 2s, then a hang until the client's 300s timeout).
  const controller = new AbortController();
  try {
    const probe = await fetch(source, { headers: { Range: "bytes=0-0" }, cache: "no-store", signal: controller.signal });
    return probe.status === 206 && (probe.headers.get("content-type") ?? "").startsWith("video/") ? "ok" : "not_video";
  } catch {
    return "unreachable";
  } finally {
    controller.abort();
  }
}
