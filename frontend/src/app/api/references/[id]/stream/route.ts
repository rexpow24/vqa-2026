import { requireApiProfile } from "@/lib/supabase/auth";
import { proxyDriveVideo } from "@/lib/drive-stream";
import { referenceDriveId } from "@/lib/references";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// Reference clips (features/c-reference-hints) are training animations, not
// dataset videos: any signed-in user may watch them, but only ids listed in
// lib/references/C.json resolve, so this never proxies an arbitrary Drive file.
async function stream(request: Request, context: Context, head = false) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  const driveFileId = referenceDriveId(id);
  if (!driveFileId) return new Response("Not found", { status: 404 });
  return proxyDriveVideo(request, driveFileId, head);
}

export async function GET(request: Request, context: Context) {
  return stream(request, context);
}

export async function HEAD(request: Request, context: Context) {
  return stream(request, context, true);
}
