import type { CSSProperties, ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, roleLabel } from "@/lib/rbac";
import { NavLink } from "./nav-link";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { actor, session } = await requireActor();
  const { tenant, user } = session;
  const unread = await db.notification.count({ where: { userId: actor.userId, readAt: null } });
  const isCustomer = actor.kind === "CUSTOMER";

  const nav: { href: string; label: string; show: boolean }[] = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/cases", label: isCustomer ? "My financing" : "Financing cases", show: true },
    { href: isCustomer ? `/customers/${actor.customerId}` : "/customers", label: isCustomer ? "Company profile" : "Customers", show: true },
    { href: "/products", label: "Products & workflows", show: true },
    { href: "/portfolio", label: "Portfolio & MIS", show: can(actor.role, "portfolio.view") },
    { href: "/audit", label: "Audit trail", show: can(actor.role, "audit.view") },
    { href: "/admin/templates", label: "Document templates", show: can(actor.role, "template.author") || can(actor.role, "template.shariah") || can(actor.role, "template.legal") },
    { href: "/admin", label: "Administration", show: can(actor.role, "admin.manage") },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]" style={{ "--brand": tenant.primaryColor, "--brand-accent": tenant.accentColor } as CSSProperties}>
      <aside className="no-print border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-sm font-bold text-white">{tenant.logoText}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{tenant.name}</div>
            <div className="truncate text-xs text-muted">{tenant.tagline || "SME Islamic Banking"}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          <NavLink href="/notifications">
            Notifications
            {unread > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-white">{unread}</span>}
          </NavLink>
        </nav>
        <div className="hidden border-t border-line p-4 lg:absolute lg:bottom-0 lg:block lg:w-full">
          <div className="text-sm font-medium">{user.fullName}</div>
          <div className="text-xs text-muted">{roleLabel(user.role)}</div>
          {user.orgUnit && <div className="text-xs text-muted">{user.orgUnit.name}</div>}
          <form action={logoutAction} className="mt-3">
            <button className="btn btn-sm w-full">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="no-print flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2.5 sm:px-8 lg:hidden">
          <span className="truncate text-sm">
            {user.fullName} · <span className="text-muted">{roleLabel(user.role)}</span>
          </span>
          <form action={logoutAction}>
            <button className="btn btn-sm">Sign out</button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
