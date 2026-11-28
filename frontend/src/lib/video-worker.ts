import { createCipheriv, randomBytes } from "node:crypto";

const PURPOSE = Buffer.from("vqa-video-v1");
const TOKEN_LIFETIME_SECONDS = 60 * 60;

export function workerVideoUrl(driveFileId: string): string | null {
  const base = process.env.VIDEO_WORKER_URL;
  const encodedKey = process.env.VIDEO_WORKER_SECRET;
  if (!base && !encodedKey) return null;
  if (!base || !encodedKey) throw new Error("VIDEO_WORKER_URL and VIDEO_WORKER_SECRET must both be set");
  const worker = new URL(base);
  const localPreview = process.env.NODE_ENV === "development" &&
    worker.protocol === "http:" && ["localhost", "127.0.0.1"].includes(worker.hostname);
  if ((!localPreview && worker.protocol !== "https:") || worker.username || worker.password ||
      worker.pathname !== "/" || worker.search || worker.hash) {
    throw new Error("VIDEO_WORKER_URL must be an HTTPS origin (HTTP localhost is allowed in development)");
  }
  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) throw new Error("VIDEO_WORKER_SECRET must be 32 base64url-encoded bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(PURPOSE);
  const payload = Buffer.from(JSON.stringify({ id: driveFileId, exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS }));
  const token = Buffer.concat([iv, cipher.update(payload), cipher.final(), cipher.getAuthTag()]).toString("base64url");
  worker.pathname = `/video/${token}`;
  return worker.toString();
}
