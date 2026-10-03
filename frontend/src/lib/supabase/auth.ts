import { redirect } from "next/navigation";
import { createClient } from "./server";

export type Role = "admin" | "annotator";
export type Profile = {
  id: string;
  email: string;
  name: string;
  role: Role;
  enabled: boolean;
  created_at: string;
};

export async function currentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data } = await supabase.from("user_profiles")
    .select("id,email,name,role,enabled,created_at")
    .eq("id", user.id).single();
  return data?.enabled ? data as Profile : null;
}

export async function requireProfile(role?: Role): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (role && profile.role !== role) redirect("/annotate");
  return profile;
}

export async function requireApiProfile(role?: Role): Promise<Profile | Response> {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (role && profile.role !== role) return Response.json({ error: "Forbidden" }, { status: 403 });
  return profile;
}
