import { requireApiProfile } from "@/lib/supabase/auth";

export async function GET() {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  return Response.json({ id: profile.id, name: profile.name, role: profile.role }, {
    headers: { "Cache-Control": "no-store" },
  });
}
