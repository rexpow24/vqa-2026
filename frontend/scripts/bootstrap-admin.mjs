import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envFile = path.join(root, ".env.local");
if (!fs.existsSync(envFile)) throw new Error("frontend/.env.local is missing");
const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map((line) => {
    const equal = line.indexOf("=");
    return [line.slice(0, equal), line.slice(equal + 1).trim()];
  }));
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Usage: node scripts/bootstrap-admin.mjs <admin-email>");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase URL or server secret is missing");
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
if (existing.users.some((user) => user.email?.toLowerCase() === email)) {
  throw new Error("This email already exists in Supabase Auth; inspect it before bootstrapping");
}
const password = crypto.randomBytes(24).toString("base64url");
const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (authError || !created.user) throw authError ?? new Error("Auth user creation failed");
const { error: profileError } = await admin.from("user_profiles").insert({
  id: created.user.id,
  email,
  name: email.split("@")[0],
  role: "admin",
  enabled: true,
});
if (profileError) {
  await admin.auth.admin.deleteUser(created.user.id);
  throw new Error(`Profile creation failed and Auth user was rolled back: ${profileError.message}`);
}
const output = path.join(root, ".admin-credentials");
fs.writeFileSync(output, `Email: ${email}\nTemporary password: ${password}\n`, { encoding: "utf8", mode: 0o600 });
console.log("Admin created. Read the one-time credentials in frontend/.admin-credentials, then delete that file after saving them securely.");
