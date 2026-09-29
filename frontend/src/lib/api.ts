// Client-side helper: every page fetches through /api/sidecar/* (the
// catch-all proxy in app/api/sidecar/[...path]/route.ts), never the FastAPI
// sidecar directly, so this is the one place that knows the URL shape.

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/sidecar${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(res.ok
      ? "The server returned an invalid response."
      : `Request failed (${res.status}): ${raw.trim() || res.statusText}`);
  }
  if (!res.ok) {
    const detail = body && typeof body === "object" && "detail" in body
      ? body.detail
      : null;
    if (typeof detail === "string") throw new Error(detail);
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => {
        if (!item || typeof item !== "object" || !("msg" in item)) return null;
        const field = "loc" in item && Array.isArray(item.loc)
          ? item.loc.filter((part: unknown) => part !== "body").join(".")
          : "";
        return `${field ? `${field}: ` : ""}${String(item.msg)}`;
      }).filter(Boolean);
      if (messages.length) throw new Error(messages.join("; "));
    }
    throw new Error(`Request failed (${res.status}).`);
  }
  return body as T;
}
