import { requireProfile, type Profile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { UserManager } from "./user-manager";

export default async function UsersPage() {
  const admin = await requireProfile("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_profiles")
    .select("id,email,name,label,role,enabled,created_at").order("created_at");
  if (error) throw new Error(error.message);
  return <div className="flex flex-col gap-5">
    <h2 className="text-xl font-semibold">Người dùng</h2>
    <UserManager users={(data ?? []) as Profile[]} currentAdminId={admin.id} />
  </div>;
}
