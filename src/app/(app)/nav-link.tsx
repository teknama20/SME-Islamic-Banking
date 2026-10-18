"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = path === href || (href !== "/dashboard" && href !== "/admin" && path.startsWith(`${href}/`)) || (href === "/admin" && path === "/admin");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${active ? "bg-brand/10 font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
