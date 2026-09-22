// Server-side helper for talking to the FastAPI sidecar (sidecar/main.py).
// Used only from Next.js Route Handlers under app/api/**, never from client
// components directly -- see features/nextjs-frontend-migration/architecture.md
// section 2 for why the proxy hop exists.

export const SIDECAR_URL = process.env.SIDECAR_URL ?? "http://127.0.0.1:8787";

export async function sidecarFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SIDECAR_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}
