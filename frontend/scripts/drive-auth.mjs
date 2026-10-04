// One-time Google Drive authorisation. Opens the consent screen in a browser,
// catches the redirect on a loopback port, and writes the refresh token to
// frontend/.drive-token.json so drive-upload.mjs can run unattended afterwards.
//
//   cd frontend && node scripts/drive-auth.mjs
//
// Why OAuth and not a service account: a service account has no Drive storage
// quota of its own, so uploading into a folder in a personal My Drive fails
// with storageQuotaExceeded -- the file would be owned by the service account,
// which cannot own bytes. Service accounts only work against a Shared Drive,
// which needs Google Workspace. Authorising as yourself sidesteps that: the
// files are owned by your account, exactly as if you had dragged them in.
//
// Scope is drive.file -- create files, and see only the files this script
// itself created. It cannot read the rest of your Drive.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { OAuth2Client } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const root = process.cwd();
const tokenPath = path.join(root, ".drive-token.json");

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8")
    .replace(/^﻿/, "").split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
}

const env = { ...readEnv(path.join(root, "..", ".env")), ...readEnv(path.join(root, ".env.local")) };
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error(`Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.

Create them once, then put both in frontend/.env.local:

  1. https://console.cloud.google.com/  ->  create or pick a project
  2. APIs & Services > Library  ->  enable "Google Drive API"
  3. APIs & Services > OAuth consent screen
       User type: External
       Add your own Gmail under "Test users" (no app review needed while testing)
  4. APIs & Services > Credentials > Create credentials > OAuth client ID
       Application type: Desktop app
  5. Copy the client ID and client secret into frontend/.env.local:
       GOOGLE_CLIENT_ID=...apps.googleusercontent.com
       GOOGLE_CLIENT_SECRET=...
       GOOGLE_DRIVE_FOLDER_ID=<id in the Drive folder's URL>

Then run this script again.`);
  process.exit(1);
}

// Loopback redirect: a Desktop-app client accepts any http://127.0.0.1 port,
// so the browser can hand the code back without a public callback URL.
const server = http.createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const redirectUri = `http://127.0.0.1:${server.address().port}`;
const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
const state = crypto.randomBytes(16).toString("hex");

const url = client.generateAuthUrl({
  access_type: "offline",      // ask for a refresh token, not just an hour-long one
  prompt: "consent",           // force a refresh token even on re-authorisation
  scope: [SCOPE],
  state,
});

console.log("Opening the Google consent screen. If no browser appears, paste this URL yourself");
console.log("(copy the whole line -- it must keep every & or Google rejects it):\n");
console.log(url + "\n");

// Never route the URL through cmd.exe: `cmd /c start "" <url>` cuts the
// address at the first & because cmd reads & as a command separator, and the
// browser then opens a query string missing response_type, client_id and
// scope -- Google answers "Required parameter is missing: response_type".
// rundll32 and the posix openers take the URL as one argument, unparsed.
const opener = process.platform === "win32"
  ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
  : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
try {
  spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref();
} catch {
  // Opening a browser is a convenience; the printed URL above still works.
}

const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out after 5 minutes")), 5 * 60_000);
  server.on("request", (request, response) => {
    const query = new URL(request.url, redirectUri).searchParams;
    const finish = (message) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:3rem">${message}</body>`);
    };
    if (query.get("state") !== state) { finish("State mismatch. Run the script again."); return; }
    if (query.get("error")) { finish("Authorisation refused."); clearTimeout(timer); reject(new Error(query.get("error"))); return; }
    const value = query.get("code");
    if (!value) return;
    finish("Done. You can close this tab and return to the terminal.");
    clearTimeout(timer);
    resolve(value);
  });
});

const { tokens } = await client.getToken(code);
if (!tokens.refresh_token) {
  throw new Error("Google returned no refresh token. Remove this app at https://myaccount.google.com/permissions and run again.");
}
fs.writeFileSync(tokenPath, JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2));
server.close();
console.log(`\nRefresh token saved to ${tokenPath} (gitignored).`);
console.log("Next: node scripts/drive-upload.mjs");
