import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env.local"), "utf8")
  .replace(/^\uFEFF/, "").split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => {
    const equal = line.indexOf("=");
    return [line.slice(0, equal), line.slice(equal + 1).trim()];
  }));
const credentials = fs.readFileSync(path.join(root, ".admin-credentials"), "utf8");
const email = credentials.match(/^Email: (.+)$/m)?.[1];
const password = credentials.match(/^Temporary password: (.+)$/m)?.[1];
if (!email || !password) throw new Error("Admin credentials are missing");

async function sessionFor(loginEmail, loginPassword) {
  const jar = new Map();
  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
  if (error) throw new Error(`Login failed: ${error.message}`);
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  if (!cookie) throw new Error("Supabase did not create a session cookie");
  return { client, cookie };
}
const { client: supabase, cookie } = await sessionFor(email, password);

const base = "https://vqa-vn-traffic-labeling.vercel.app";
async function check(pathname, expected, headers = {}) {
  const response = await fetch(base + pathname, {
    headers: { Cookie: cookie, ...headers }, redirect: "manual", cache: "no-store",
  });
  if (response.status !== expected) {
    throw new Error(`${pathname}: expected ${expected}, got ${response.status}; location ${response.headers.get("location") ?? "none"}`);
  }
  return response;
}
const me = await check("/api/auth/me", 200);
const identity = await me.json();
if (identity.role !== "admin") throw new Error("Production session lacks admin role");
await check("/admin", 200);
await check("/admin/statistics", 307);
await check("/admin/users", 200);
await check("/annotate", 200);
console.log("Production admin session and pages: OK");

const { data: video, error: videoError } = await supabase.from("videos")
  .select("id").eq("filename", "AeseZkBqBf0_180633_186500_t01_h264.mp4").single();
if (videoError || !video) throw new Error(`Seed video lookup failed: ${videoError?.message}`);
const stream = await check(`/api/videos/${video.id}/stream`, 206, { Range: "bytes=0-1023" });
if (stream.headers.get("content-range") !== "bytes 0-1023/4229721" ||
    Number(stream.headers.get("content-length")) !== 1024 ||
    !stream.headers.get("content-type")?.startsWith("video/")) {
  throw new Error("Production video byte range headers are incorrect");
}
const bytes = new Uint8Array(await stream.arrayBuffer());
if (bytes.length !== 1024) throw new Error("Production stream returned the wrong byte count");
console.log("Production authenticated Drive stream and seeking range: OK");
for (const filename of [
  "0aD5Bbh_GgU_097200_166733_t01.mp4",
  "0aD5Bbh_GgU_238100_278566_t01.mp4",
]) {
  const { data: readyVideo, error: readyError } = await supabase.from("videos")
    .select("id").eq("filename", filename).single();
  if (readyError || !readyVideo) throw new Error(`Ready video missing: ${filename}`);
  const { count: draftCount } = await supabase.from("video_drafts")
    .select("id", { count: "exact", head: true }).eq("video_id", readyVideo.id);
  if (draftCount !== 9) throw new Error(`Ready video lacks nine drafts: ${filename}`);
  const page = await check(`/annotate/${readyVideo.id}`, 200);
  if (!(await page.text()).includes("Bối cảnh")) throw new Error(`Draft page did not render: ${filename}`);
  const segment = await check(`/api/videos/${readyVideo.id}/stream`, 206, { Range: "bytes=0-1023" });
  if (Number(segment.headers.get("content-length")) !== 1024 ||
      (await segment.arrayBuffer()).byteLength !== 1024) throw new Error(`Video range failed: ${filename}`);
}
console.log("Two imported nine-question videos and authenticated streams: OK");
for (const headers of [{ Range: "bytes=0-" }, {}]) {
  const response = await fetch(base + `/api/videos/${video.id}/stream`, {
    headers: { Cookie: cookie, ...headers }, cache: "no-store",
  });
  console.log(`Stream ${headers.Range ?? "without Range"}: ${response.status}, ${response.headers.get("content-type")}, ${response.headers.get("content-length")}`);
  await response.body?.cancel();
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const tempEmail = `deployment-test-${crypto.randomUUID()}@example.com`;
const tempPassword = crypto.randomBytes(24).toString("base64url");
let tempUserId;
try {
  const create = await fetch(base + "/api/admin/users", {
    method: "POST",
    headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email: tempEmail, name: "Temporary verification", role: "annotator", password: tempPassword }),
  });
  if (create.status !== 201) throw new Error(`Production user creation failed: ${create.status}`);
  const created = await create.json();
  tempUserId = created.id;
  const { cookie: annotatorCookie } = await sessionFor(tempEmail, tempPassword);
  const forbiddenPage = await fetch(base + "/admin/users", {
    headers: { Cookie: annotatorCookie }, redirect: "manual", cache: "no-store",
  });
  if (forbiddenPage.status !== 307 || forbiddenPage.headers.get("location") !== "/annotate") {
    throw new Error("Annotator can access the admin page");
  }
  const forbiddenApi = await fetch(base + "/api/admin/users", {
    method: "POST", headers: { Cookie: annotatorCookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (forbiddenApi.status !== 403) throw new Error("Annotator can use the admin API");
  const disable = await fetch(base + `/api/admin/users/${tempUserId}`, {
    method: "PATCH", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Temporary verification", role: "annotator", enabled: false }),
  });
  if (disable.status !== 200) throw new Error(`Production user disable failed: ${disable.status}`);
  const denied = await fetch(base + "/api/auth/me", {
    headers: { Cookie: annotatorCookie }, cache: "no-store",
  });
  if (denied.status !== 401) throw new Error("Disabled annotator retained app access");
  console.log("Production user creation, role guard, and disable: OK");
} finally {
  if (tempUserId) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(tempUserId);
    if (deleteError) throw new Error(`Temporary user cleanup failed: ${deleteError.message}`);
  }
}
