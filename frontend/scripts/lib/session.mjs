// Supabase clients for the scripts in this folder.
//
// Verification scripts need two different things from one account: a normal
// client to call RPCs and tables, and a cookie jar so the same session can
// drive the Next.js routes the way a browser does. Both used to be rebuilt
// inline in every script.

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, requireEnv } from "./env.mjs";

const env = loadEnv();
const url = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
const anonKey = requireEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export { env };

/** Service-role client: bypasses RLS. Fixtures and cleanup only. */
export function privilegedClient() {
  return createClient(url, requireEnv(env, "SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Sign in and return `{ client, cookie }` -- `client` for direct Supabase
 * calls, `cookie` to pass as a Cookie header when driving the web routes.
 */
export async function signIn(email, password) {
  const client = createClient(url, anonKey,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const jar = new Map();
  const browser = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: cookieError } = await browser.auth.signInWithPassword({ email, password });
  if (cookieError) throw cookieError;
  return { client, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
}

/** Fetch a path on the app under test, returning `{ status, data }`. */
export async function request(base, pathname, cookie, method = "GET", body) {
  const headers = { Cookie: cookie, Origin: base };
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(base + pathname, {
    method, headers, cache: "no-store", redirect: "manual",
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data, location: response.headers.get("location") };
}
