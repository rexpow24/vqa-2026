"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Profile } from "@/lib/supabase/auth";

export function PlatformNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  if (!profile || pathname === "/login") return null;

  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <nav className="mt-3 flex items-center gap-5 border-b border-border px-6 text-sm">
    <Link className={`py-3 ${pathname.startsWith("/annotate") ? "text-foreground" : "text-muted"}`} href="/annotate">Gán nhãn</Link>
    {profile.role === "admin" && <Link className={`py-3 ${pathname === "/admin" ? "text-foreground" : "text-muted"}`} href="/admin">Dashboard</Link>}
    {profile.role === "admin" && <Link className={`py-3 ${pathname.startsWith("/admin/users") ? "text-foreground" : "text-muted"}`} href="/admin/users">Người dùng</Link>}
    <span className="ml-auto text-muted">{profile.name}</span>
    <button type="button" onClick={signOut} className="py-3 text-muted hover:text-foreground">Đăng xuất</button>
  </nav>;
}
