"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/queue", label: "Queue" },
  { href: "/run", label: "Run" },
  { href: "/review", label: "Review" },
  { href: "/export", label: "Export" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border px-6 mt-3">
      {TABS.map((t) => {
        const active = pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
