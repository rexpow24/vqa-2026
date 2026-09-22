// Streams a video file straight off disk with HTTP Range support, mirroring
// what st.video(path) did for app.py -- both processes read the same local
// filesystem, so there is no need to proxy bytes through the sidecar (see
// architecture.md section 2). The sidecar only ever hands back a path
// string (e.g. "work/<id>/delivered/<clip_id>.mp4"); this route resolves it
// against the repo root and rejects anything outside the two directories
// clip files actually live under.

import { NextRequest } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import path from "path";

export const runtime = "nodejs";

// frontend/ -> repo root
const REPO_ROOT = path.resolve(process.cwd(), "..");
const ALLOWED_ROOTS = new Set(["work", "export"]);

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path: segs } = await ctx.params;
  if (!segs.length || !ALLOWED_ROOTS.has(segs[0])) {
    return new Response("forbidden", { status: 403 });
  }

  const rel = segs.map(decodeURIComponent).join(path.sep);
  const resolved = path.resolve(REPO_ROOT, rel);
  const rootResolved = path.resolve(REPO_ROOT);
  // Path-traversal containment: resolved must stay inside REPO_ROOT.
  if (!resolved.startsWith(rootResolved + path.sep)) {
    return new Response("forbidden", { status: 403 });
  }
  if (!existsSync(resolved)) {
    return new Response("not found", { status: 404 });
  }

  const stat = statSync(resolved);
  const range = req.headers.get("range");
  const contentType = resolved.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";

  if (!range) {
    const stream = createReadStream(resolved);
    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const match = /bytes=(\d+)-(\d+)?/.exec(range);
  if (!match) {
    return new Response("invalid range", { status: 416 });
  }
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
  if (start >= stat.size || end >= stat.size || start > end) {
    return new Response("invalid range", {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }

  const stream = createReadStream(resolved, { start, end });
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  return new Response(webStream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
