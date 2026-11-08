import { requireApiProfile } from "@/lib/supabase/auth";

// Videos are assigned by an admin (/admin/assignments); nobody claims their own.
export async function POST() {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  return Response.json({ error: "Video được admin giao; không tự nhận được." }, { status: 403 });
}
