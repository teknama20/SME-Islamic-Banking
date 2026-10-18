import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — SME Islamic Banking" };

const DEMO_USERS = [
  ["rcad.officer", "RCAD (documentation)"],
  ["rm.ali", "Relationship Manager"],
  ["tl.gulberg", "Team Leader"],
  ["uh.gulberg", "Unit Head"],
  ["rh.north", "Regional Head"],
  ["ch.ahmed", "Country Head"],
  ["credit.officer", "Credit / Risk"],
  ["trade.officer", "Trade"],
  ["shariah.officer", "Shariah"],
  ["legal.officer", "Legal"],
  ["auditor", "Internal Audit"],
  ["admin", "Administrator"],
  ["noor.ceo", "Customer signatory"],
  ["noor.guarantor", "Guarantor"],
  ["barakah.partner", "Customer signatory"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ bank?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { bank = "IBP" } = await searchParams;
  const tenant = await db.tenant.findUnique({ where: { code: bank.toUpperCase() } });
  const brand = tenant?.primaryColor ?? "#0b5d3b";
  const accent = tenant?.accentColor ?? "#c8a24a";
  const demo = process.env.NODE_ENV !== "production";

  return (
    <main className="grid min-h-screen lg:grid-cols-2" style={{ "--brand": brand, "--brand-accent": accent } as React.CSSProperties}>
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white/15 text-lg font-bold">{tenant?.logoText ?? "IB"}</div>
          <div>
            <div className="text-lg font-semibold">{tenant?.name ?? "SME Islamic Banking"}</div>
            <div className="text-sm text-white/70">{tenant?.tagline ?? "Digital SME financing"}</div>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl leading-tight font-semibold">Shariah-compliant SME financing — from request to possession, signed and audited digitally.</h1>
          <ul className="space-y-2 text-sm text-white/80">
            <li>• One simple loop: RCAD → RM / Team Leader / Unit Head → Customer → RCAD, Shariah review after disbursement</li>
            <li>• Murabaha, Tijarah, Istisna, Diminishing Musharakah, Ijarah, Salam & Musharakah workflows</li>
            <li>• SBP SME Prudential Regulations checks built in (R-5, R-7, R-9, R-11, R-16, R-17)</li>
            <li>• OTP e-signatures bound to SHA-256 document hashes (ETO 2002)</li>
            <li>• Geo-tagged possession evidence and a tamper-evident audit trail</li>
          </ul>
        </div>
        <p className="text-xs text-white/60">Authorised users only. All activity is monitored and recorded.</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-accent/30" />
      </section>

      <section className="flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="text-lg font-semibold text-brand">{tenant?.name ?? "SME Islamic Banking"}</div>
          </div>
          <h2 className="mb-1 text-2xl font-semibold">Sign in</h2>
          <p className="mb-6 text-sm text-muted">Bank staff and SME customers use the same secure sign-in.</p>
          <LoginForm defaultBank={bank.toUpperCase()} />
          {demo && (
            <details className="mt-8 rounded-lg border border-line bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium">Demo accounts (password: Bank@12345)</summary>
              <div className="mt-2 grid grid-cols-1 gap-1">
                {DEMO_USERS.map(([u, r]) => (
                  <div key={u} className="flex justify-between gap-2">
                    <code className="mono">{u}</code>
                    <span className="text-xs text-muted">{r}</span>
                  </div>
                ))}
                <p className="mt-2 text-xs text-muted">
                  White-label demo: use bank code <code>DCB</code> with <code>admin</code>.
                </p>
              </div>
            </details>
          )}
        </div>
      </section>
    </main>
  );
}
