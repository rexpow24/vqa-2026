import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/auth";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const profile = await currentProfile();
  if (profile) redirect(profile.role === "admin" ? "/admin" : "/annotate");
  return <div className="mx-auto mt-16 max-w-sm rounded-md border border-border bg-surface p-6">
    <h2 className="mb-6 text-xl font-semibold">Đăng nhập</h2>
    <LoginForm />
  </div>;
}
