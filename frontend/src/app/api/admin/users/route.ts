import { requireApiProfile, type Role } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 100 ||
      password.length < 4 || !["admin", "annotator"].includes(role)) {
    return Response.json({ error: "Email, name, role, or password is invalid" }, { status: 422 });
  }
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (authError || !created.user) {
    return Response.json({ error: authError?.message ?? "Could not create user" }, { status: 422 });
  }
  const { data, error } = await admin.from("user_profiles")
    .insert({ id: created.user.id, email, name, role, enabled: true })
    .select("id,email,name,role,enabled,created_at").single();
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return Response.json({ error: "Could not create profile; Auth user was rolled back" }, { status: 500 });
  }
  return Response.json(data, { status: 201 });
}
