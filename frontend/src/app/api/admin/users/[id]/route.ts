import { requireApiProfile, type Role } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role as Role;
  const enabled = body.enabled;
  if (!name || name.length > 100 || !["admin", "annotator"].includes(role) || typeof enabled !== "boolean") {
    return Response.json({ error: "Invalid profile" }, { status: 422 });
  }
  if (id === caller.id && (role !== "admin" || !enabled)) {
    return Response.json({ error: "You cannot revoke your own admin access" }, { status: 422 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("user_profiles")
    .update({ name, role, enabled }).eq("id", id)
    .select("id,email,name,role,enabled,created_at").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  if (!data) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json(data);
}

export async function DELETE(_request: Request, context: Context) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  const { id } = await context.params;
  if (id === caller.id) {
    return Response.json({ error: "You cannot delete your own account" }, { status: 422 });
  }
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("user_profiles")
    .select("id").eq("id", id).maybeSingle();
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!profile) return Response.json({ error: "User not found" }, { status: 404 });
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json({ ok: true });
}
