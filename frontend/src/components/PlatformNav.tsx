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

  // Every management page sits here, so no page needs its own links back.
  const links: [string, string, boolean][] = [
    ["/annotate", "Gán nhãn", pathname.startsWith("/annotate")],
    ...(profile.role === "admin" ? [
      ["/admin", "Dashboard", pathname === "/admin"],
      ["/admin/users", "Người dùng", pathname.startsWith("/admin/users")],
      ["/admin/videos", "Video", pathname.startsWith("/admin/videos")],
      ["/admin/assignments", "Phân công", pathname.startsWith("/admin/assignments")],
    ] as [string, string, boolean][] : []),
  ];
  return <nav className="mt-3 flex flex-wrap items-center gap-x-5 border-b border-border px-6 text-sm">
    {links.map(([href, label, active]) => <Link key={href} href={href} aria-current={active ? "page" : undefined}
      className={`border-b-2 py-3 ${active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>{label}</Link>)}
    <span className="ml-auto text-muted">{profile.name}</span>
    <button type="button" onClick={signOut} className="py-3 text-muted hover:text-foreground">Đăng xuất</button>
  </nav>;
}
