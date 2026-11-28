import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import worker from "./index.js";
import { workerVideoUrl } from "../../../frontend/src/lib/video-worker.ts";

test("authorized range is streamed without exposing the Drive URL", async () => {
  const secret = randomBytes(32).toString("base64url");
  process.env.VIDEO_WORKER_URL = "https://video.example.workers.dev";
  process.env.VIDEO_WORKER_SECRET = secret;
  const fileId = "1MrKGKa2CJCc4lrAOD46D2jWLjKvaJJXV";
  const url = workerVideoUrl(fileId);
  assert.ok(url);
  assert.equal(url.includes(fileId), false);
  const originalFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (input, options) => {
    requested = { url: input.toString(), options };
    return new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: {
      "Content-Type": "video/mp4", "Content-Range": "bytes 0-2/100", "Content-Length": "3",
      "Cross-Origin-Resource-Policy": "same-site", "Content-Disposition": "attachment",
    } });
  };
  try {
    const response = await worker.fetch(new Request(url, { headers: { Range: "bytes=0-2" } }), { VIDEO_WORKER_SECRET: secret });
    assert.equal(response.status, 206);
    assert.equal(requested.url, `https://drive.google.com/uc?export=download&id=${fileId}`);
    assert.equal(requested.options.headers.Range, "bytes=0-2");
    assert.equal(response.headers.get("content-range"), "bytes 0-2/100");
    assert.equal(response.headers.has("cross-origin-resource-policy"), false);
    assert.equal(response.headers.has("content-disposition"), false);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3]));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.VIDEO_WORKER_URL;
    delete process.env.VIDEO_WORKER_SECRET;
  }
});

test("invalid links and ranges are rejected before Drive is fetched", async () => {
  const secret = randomBytes(32).toString("base64url");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Drive must not be fetched"); };
  try {
    const env = { VIDEO_WORKER_SECRET: secret };
    assert.equal((await worker.fetch(new Request("https://video.example.workers.dev/video/bad"), env)).status, 403);
    assert.equal((await worker.fetch(new Request("https://video.example.workers.dev/video/bad", { headers: { Range: "bytes=0-1,5-6" } }), env)).status, 416);
    assert.equal((await worker.fetch(new Request("https://video.example.workers.dev/nope"), env)).status, 404);
  } finally { globalThis.fetch = originalFetch; }
});
