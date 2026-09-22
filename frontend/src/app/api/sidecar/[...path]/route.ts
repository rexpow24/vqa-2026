// Generic proxy: every /api/sidecar/<...> request is forwarded verbatim to
// the FastAPI sidecar (sidecar/main.py) at SIDECAR_URL. One catch-all route
// instead of one file per endpoint -- still "Next.js route handlers proxy
// JSON to the sidecar" per architecture.md section 2, just implemented once.
//
// No new logic lives here: this file does not know what any endpoint means,
// it only forwards method/body/query and relays status/JSON back.

import { NextRequest } from "next/server";
import { SIDECAR_URL } from "@/lib/sidecar";

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const target = `${SIDECAR_URL}/${path.join("/")}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text();
    if (body) init.body = body;
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch {
    return Response.json(
      { detail: "Sidecar unreachable. Is `uvicorn sidecar.main:app --port 8787` running?" },
      { status: 502 },
    );
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
