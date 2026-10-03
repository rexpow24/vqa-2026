import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
  .replace(/^\uFEFF/, "").split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => { const equal = line.indexOf("="); return [line.slice(0, equal), line.slice(equal + 1).trim()]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const response = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
});
if (!response.ok) throw new Error(`Auth settings request failed: ${response.status}`);
const settings = await response.json();
if (!settings.disable_signup) throw new Error("Public signup is still enabled in Supabase Auth settings");
const admin = createClient(url, env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const email = `password-policy-test-${crypto.randomUUID()}@example.com`;
const { data, error } = await admin.auth.admin.createUser({ email, password: "Ab1!", email_confirm: true });
if (error) throw new Error(`Four-character password is still rejected: ${error.message}`);
if (!data.user) throw new Error("Four-character test user was not created");
const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
if (cleanupError) throw new Error(`Four-character test user cleanup failed: ${cleanupError.message}`);
console.log("Public signup disabled and four-character password accepted: OK");
