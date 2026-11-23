// Verifies group C reference clips (features/c-reference-hints/requirements.md)
// through the real routes and the local database: the stream route serves only
// listed clips to a signed-in user, each open is logged for the caller only,
// and admins read per-annotator counts.
//
//   TEST_BASE_URL=http://localhost:3006 node scripts/verify-references.mjs
//
// Local Supabase only. Creates two disposable annotators and one admin, removed in `finally`.

import crypto from "node:crypto";
import { loadEnv, refuseUnlessLocal } from "./lib/env.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
refuseUnlessLocal("TEST_BASE_URL", env.TEST_BASE_URL);
const base = env.TEST_BASE_URL.replace(/\/$/, "");
const { privilegedClient, signIn, request } = await import("./lib/session.mjs");

const privileged = privilegedClient();
const tag = `refs-${crypto.randomUUID().slice(0, 8)}`;
const failures = [];
function check(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else { failures.push(name); console.log(`FAIL ${name}: ${JSON.stringify(detail)}`); }
}
const created = [];
async function makeUser(suffix, role) {
  const email = `${tag}-${suffix}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const result = await privileged.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error) throw result.error;
  created.push(result.data.user.id);
  const insert = await privileged.from("user_profiles").insert({ id: result.data.user.id, email, name: `${tag}-${suffix}`, role, enabled: true });
  if (insert.error) throw insert.error;
  return { id: result.data.user.id, ...(await signIn(email, password)) };
}

try {
  const anonymous = await fetch(`${base}/api/references/K08-K09/stream`, { headers: { Range: "bytes=0-1023" } });
  check("an anonymous reference stream is refused with 401", anonymous.status === 401, anonymous.status);

  const one = await makeUser("a", "annotator");
  const two = await makeUser("b", "annotator");
  const admin = await makeUser("admin", "admin");

  const clip = await fetch(`${base}/api/references/K08-K09/stream`, { headers: { Range: "bytes=0-1023", Cookie: one.cookie } });
  check("a signed-in annotator streams the K08-K09 comparison as a byte range", clip.status === 206
    && (clip.headers.get("content-type") ?? "").startsWith("video/"), { status: clip.status, type: clip.headers.get("content-type") });
  await clip.body?.cancel().catch(() => undefined);
  const unknown = await fetch(`${base}/api/references/K99/stream`, { headers: { Cookie: one.cookie } });
  check("an unlisted reference id is 404, never proxied", unknown.status === 404, unknown.status);

  const logged = await request(base, "/api/references/views", one.cookie, "POST", { reference: "K08-K09", chosen: "K08" });
  const bad = await request(base, "/api/references/views", one.cookie, "POST", { reference: "../x" });
  check("an open is logged; an unknown reference is refused", logged.status === 200 && bad.status === 422, { logged, bad });
  const rows = await privileged.from("reference_views").select("annotator_id,reference,chosen").eq("annotator_id", one.id);
  check("the log row belongs to the caller", rows.data?.length === 1 && rows.data[0].reference === "K08-K09" && rows.data[0].chosen === "K08", rows);

  const peek = await two.client.from("reference_views").select("id").eq("annotator_id", one.id);
  check("another annotator cannot read that row", !peek.error && peek.data.length === 0, peek);
  const forged = await two.client.from("reference_views").insert({ annotator_id: one.id, qgroup: "C", reference: "K01" });
  check("an annotator cannot log an open in someone else's name", Boolean(forged.error), forged.error);

  const denied = await one.client.rpc("reference_view_stats");
  check("an annotator cannot read the per-annotator stats", Boolean(denied.error), denied.error);
  const stats = await admin.client.rpc("reference_view_stats");
  const mine = stats.data?.find((row) => row.annotator_id === one.id);
  const theirs = stats.data?.find((row) => row.annotator_id === two.id);
  check("the admin sees opens per annotator, least first", !stats.error && Number(mine?.opens) === 1 && Number(theirs?.opens) === 0
    && stats.data.findIndex((row) => row.annotator_id === two.id) < stats.data.findIndex((row) => row.annotator_id === one.id),
  { error: stats.error, mine, theirs });
} finally {
  for (const id of created) {
    const { error } = await privileged.auth.admin.deleteUser(id);
    if (error) console.log(`cleanup: ${error.message}`);
  }
}

if (failures.length) { console.log(`\n${failures.length} check(s) failed.`); process.exit(1); }
console.log("\nAll reference checks passed.");
