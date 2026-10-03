import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/auth";

export default async function Home() {
  if (process.env.VERCEL === "1" || process.env.PLATFORM_MODE === "hosted") {
    const profile = await currentProfile();
    redirect(profile ? (profile.role === "admin" ? "/admin" : "/annotate") : "/login");
  }
  redirect("/queue");
}
