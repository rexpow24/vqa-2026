// Client-side helper: every page fetches through /api/sidecar/* (the
// catch-all proxy in app/api/sidecar/[...path]/route.ts), never the FastAPI
// sidecar directly, so this is the one place that knows the URL shape.

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/sidecar${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.detail ?? `request failed (${res.status})`);
  }
  return body as T;
}
