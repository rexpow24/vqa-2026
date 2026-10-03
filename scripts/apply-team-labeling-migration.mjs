import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env");
const migrationName = process.argv[2] || "20261003_team_video_labeling.sql";
if (!/^[A-Za-z0-9_-]+\.sql$/.test(migrationName)) throw new Error("Invalid migration filename");
const migrationPath = path.join(root, "supabase", "migrations", migrationName);
if (!fs.existsSync(migrationPath)) throw new Error(`Migration not found: ${migrationName}`);

if (!fs.existsSync(envPath)) throw new Error("Root .env is missing");
const connectionLine = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  .find((line) => /^DB_CONNECTION=/.test(line));
if (!connectionLine) throw new Error("DB_CONNECTION is missing from root .env");

let connectionString = connectionLine.slice("DB_CONNECTION=".length).trim();
if ((connectionString.startsWith('"') && connectionString.endsWith('"')) ||
    (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
  connectionString = connectionString.slice(1, -1);
}
let url;
try { url = new URL(connectionString); }
catch {
  const match = connectionString.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/);
  if (match) {
    try { url = new URL(match[1] + encodeURIComponent(match[2]) + match[3]); }
    catch { /* A connection error below avoids exposing the password. */ }
  }
  if (!url) throw new Error("DB_CONNECTION is not a valid PostgreSQL URL. URL-encode special password characters.");
}
if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error("DB_CONNECTION must be a PostgreSQL URL");
if (!url.hostname || !url.username || !url.pathname.slice(1)) {
  throw new Error("DB_CONNECTION needs a host, user, and database");
}

const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGSSLMODE: url.searchParams.get("sslmode") || "require",
};
console.log(`Applying migration to ${pgEnv.PGHOST}/${pgEnv.PGDATABASE}`);
const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-1", "-f", migrationPath], {
  cwd: root,
  env: pgEnv,
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
