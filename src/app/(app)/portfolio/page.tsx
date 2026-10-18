import { redirect } from "next/navigation";
import { Card, PageHeader, Stat } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { pkrMillions } from "@/lib/pricing";
import { getProduct } from "@/lib/products/catalog";
import { can } from "@/lib/rbac";
import { PROVISION_RATE, SME_LABELS, workingDaysBetween, type Classification, type SmeCategory } from "@/lib/sbp";
import { caseScope } from "@/lib/scope";

function Bars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{r.label}</span>
            <span className="text-muted tabular-nums">{r.sub ?? pkrMillions(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** SME MIS (SME PR R-19 ii): size, growth, sectoral / geographic / gender dispersion, quality, TAT. */
export default async function PortfolioPage() {
  const { actor } = await requireActor();
  if (!can(actor.role, "portfolio.view")) redirect("/dashboard");
  const cases = await db.financingCase.findMany({
    where: { ...caseScope(actor), stage: { in: ["ACTIVE", "EXECUTION", "OFFERED", "SANCTIONED", "CLOSED", "UNDER_REVIEW", "PENDING_APPROVAL"] } },
    include: { customer: true, schedule: true },
  });
  const book = cases.filter((c) => ["ACTIVE", "EXECUTION", "OFFERED", "SANCTIONED"].includes(c.stage));
  const sum = (xs: typeof cases) => xs.reduce((s, c) => s + c.amount, 0);
  const group = (key: (c: (typeof cases)[number]) => string) => {
    const m = new Map<string, number>();
    for (const c of book) m.set(key(c), (m.get(key(c)) ?? 0) + c.amount);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const active = cases.filter((c) => c.stage === "ACTIVE");
  const outstanding = active.reduce((s, c) => s + c.schedule.reduce((a, i) => a + i.total - i.paidAmount, 0), 0);
  const classified = active.filter((c) => c.classification !== "REGULAR");
  const provisionEst = classified.reduce((s, c) => s + c.amount * PROVISION_RATE[c.classification as Classification], 0);
  const decided = cases.filter((c) => c.submittedAt && c.sanctionedAt);
  const avgTat = decided.length ? decided.reduce((s, c) => s + workingDaysBetween(c.submittedAt!, c.sanctionedAt!), 0) / decided.length : 0;
  const womenLed = book.filter((c) => c.customer.womenLed);

  return (
    <>
      <PageHeader title="Portfolio & MIS" subtitle="SME finance MIS per SME PR R-19 (ii): portfolio size, sectoral, geographic and gender dispersion, quality and turnaround" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sanctioned book" value={pkrMillions(sum(book))} hint={`${book.length} facilities`} />
        <Stat label="Outstanding (active)" value={pkrMillions(outstanding)} hint={`${active.length} active`} />
        <Stat label="Classified (R-17)" value={classified.length} hint={`indicative provision ${pkrMillions(provisionEst)} before FSV`} tone={classified.length ? "warn" : "ok"} />
        <Stat label="Average TAT" value={`${avgTat.toFixed(1)} days`} hint="submission → sanction (target ≤ 15, R-16)" tone={avgTat > 15 ? "bad" : "ok"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By Islamic mode">
          <Bars rows={group((c) => getProduct(c.productCode).name)} />
        </Card>
        <Card title="By SME category">
          <Bars rows={group((c) => SME_LABELS[c.customer.smeCategory as SmeCategory])} />
        </Card>
        <Card title="By sector">
          <Bars rows={group((c) => c.customer.sector)} />
        </Card>
        <Card title="By city">
          <Bars rows={group((c) => c.customer.city)} />
        </Card>
        <Card title="Women-led enterprises (R-1 v)">
          <Bars rows={[{ label: "Women-led", value: sum(womenLed), sub: `${womenLed.length} · ${pkrMillions(sum(womenLed))}` }, { label: "Other", value: sum(book) - sum(womenLed) }]} />
        </Card>
        <Card title="Start-ups">
          <Bars rows={[{ label: "Start-ups (≤ 5 years)", value: sum(book.filter((c) => c.customer.isStartup)) }, { label: "Established", value: sum(book.filter((c) => !c.customer.isStartup)) }]} />
        </Card>
      </div>
    </>
  );
}
