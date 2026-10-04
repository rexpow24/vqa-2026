// Env loading shared by the scripts in this folder.
//
// Each script used to carry its own copy of this parser -- the same regex, the
// same BOM strip, the same indexOf("=") split -- so a fix in one never reached
// the others. `.env.local` is written by `vercel env pull`, which emits a BOM
// and quoted values, hence both being handled here rather than in six places.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** frontend/ -- scripts resolve paths from here, not from process.cwd(). */
export const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** Repository root, the parent of frontend/. */
export const REPO_ROOT = path.resolve(FRONTEND_DIR, "..");

function parse(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const equals = line.indexOf("=");
      const value = line.slice(equals + 1).trim();
      const unquoted = (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
      return [line.slice(0, equals), unquoted];
    }));
}

/** Root .env first, then frontend/.env.local, which wins on conflict. */
export function loadEnv() {
  return { ...parse(path.join(REPO_ROOT, ".env")), ...parse(path.join(FRONTEND_DIR, ".env.local")) };
}

/** Read a variable, failing with a message that names the file to edit. */
export function requireEnv(env, name, hint = "") {
  const value = env[name];
  if (!value) throw new Error(`${name} is missing from frontend/.env.local${hint ? `\n${hint}` : ""}`);
  return value;
}

/** The admin login written by bootstrap-admin.mjs. */
export function adminCredentials() {
  const file = path.join(FRONTEND_DIR, ".admin-credentials");
  if (!fs.existsSync(file)) throw new Error("frontend/.admin-credentials is missing -- run scripts/bootstrap-admin.mjs");
  const text = fs.readFileSync(file, "utf8");
  const email = text.match(/^Email: (.+)$/m)?.[1];
  const password = text.match(/^Temporary password: (.+)$/m)?.[1];
  if (!email || !password) throw new Error("frontend/.admin-credentials is unreadable");
  return { email, password };
}
