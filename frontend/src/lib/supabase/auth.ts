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
  // getClaims(), not getUser(). This project signs its JWTs with ES256, so
  // getClaims verifies the signature locally -- measured at ~1ms against
  // ~247ms for getUser(), which always posts the token to the auth server to
  // be checked. Every page render runs this, so that round trip was pure
  // latency on each navigation. Local verification of an asymmetric signature
  // is equally trustworthy: a forged token fails the check without anyone
  // having to ask the server.
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const { data: profile } = await supabase.from("user_profiles")
    .select("id,email,name,role,enabled,created_at")
    .eq("id", userId).single();
  return profile?.enabled ? profile as Profile : null;
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
