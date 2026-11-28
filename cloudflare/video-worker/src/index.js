const PURPOSE = new TextEncoder().encode("vqa-video-v1");

function decodeToken(token) {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("Invalid token");
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function driveFileId(token, encodedKey) {
  const keyBytes = decodeToken(encodedKey);
  if (keyBytes.length !== 32) throw new Error("Invalid Worker secret");
  const bytes = decodeToken(token);
  if (bytes.length < 29) throw new Error("Invalid token");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: PURPOSE }, key, bytes.slice(12));
  const payload = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Number.isSafeInteger(payload.exp) || payload.exp < Date.now() / 1000 ||
      typeof payload.id !== "string" || !/^[A-Za-z0-9_-]{20,}$/.test(payload.id)) {
    throw new Error("Expired or invalid token");
  }
  return payload.id;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const url = new URL(request.url);
    const match = /^\/video\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (!match || url.search) return new Response("Not found", { status: 404 });
    const range = request.headers.get("range");
    if (range && !/^bytes=\d*-\d*$/.test(range)) return new Response("Invalid range", { status: 416 });
    let id;
    try {
      id = await driveFileId(match[1], env.VIDEO_WORKER_SECRET);
    } catch {
      return new Response("Expired or invalid link", { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const source = new URL("https://drive.google.com/uc");
    source.searchParams.set("export", "download");
    source.searchParams.set("id", id);
    let upstream;
    try {
      upstream = await fetch(source, {
        method: request.method,
        headers: range ? { Range: range } : {},
        redirect: "follow",
      });
    } catch {
      return new Response("Drive is unavailable", { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.startsWith("video/") || (range && upstream.status !== 206)) {
      await upstream.body?.cancel();
      return new Response("Drive video is unavailable", { status: 502 });
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
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  },
};
