import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Stat, StageBadge, fmtDateTime } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { STAGE_LABELS, type Stage } from "@/lib/constants";
import { db } from "@/lib/db";
import { pkrMillions } from "@/lib/pricing";
import { getProduct } from "@/lib/products/catalog";
import { getMyTasks, pipelineStats } from "@/lib/queries";
import { can, roleLabel } from "@/lib/rbac";
import { caseScope } from "@/lib/scope";

export default async function Dashboard() {
  const { actor, session } = await requireActor();
  const [tasks, stats, recent] = await Promise.all([
    getMyTasks(actor),
    pipelineStats(actor),
    db.financingCase.findMany({ where: caseScope(actor), include: { customer: { select: { legalName: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
  ]);
  const count = (s: Stage[]) => stats.byStage.filter((x) => s.includes(x.stage as Stage)).reduce((a, x) => a + x._count, 0);
  const activeAmount = stats.active.reduce((s, a) => s + a.amount, 0);
  const npl = stats.active.filter((a) => a.classification !== "REGULAR").length;
  const isCustomer = actor.kind === "CUSTOMER";

  return (
    <>
      <PageHeader
        title={`Assalam-o-Alaikum, ${session.user.fullName.split(" ")[0]}`}
        subtitle={`${roleLabel(actor.role)}${session.user.orgUnit ? ` · ${session.user.orgUnit.name}` : ""}${isCustomer ? "" : ` · ${session.tenant.name}`}`}
        actions={
          <>
            {can(actor.role, "case.create") && (
              <Link href="/cases/new" className="btn btn-primary">
                New financing request
              </Link>
            )}
            {can(actor.role, "customer.create") && (
              <Link href="/customers/new" className="btn">
                Onboard customer
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting my action" value={tasks.length} hint={`${tasks.filter((t) => t.urgent).length} urgent`} tone={tasks.some((t) => t.urgent) ? "warn" : undefined} />
        <Stat label="In review & approval" value={count(["UNDER_REVIEW", "PENDING_APPROVAL", "RETURNED"])} hint={`${stats.tatBreaches} beyond 15-day TAT (R-16)`} tone={stats.tatBreaches ? "bad" : undefined} />
        <Stat label="In documentation" value={count(["SANCTIONED", "OFFERED", "EXECUTION"])} hint="offer, signing, possession" />
        <Stat label={isCustomer ? "Active facilities" : "Active portfolio"} value={pkrMillions(activeAmount)} hint={`${stats.active.length} facilities · ${npl} classified`} tone={npl ? "warn" : "ok"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="My task queue" actions={<Badge tone="brand">{tasks.length}</Badge>}>
          {tasks.length === 0 ? (
            <Empty>Nothing is waiting on you right now.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {tasks.slice(0, 25).map((t, i) => (
                <li key={i}>
                  <Link href={t.href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-surface-2">
                    <Badge tone={t.urgent ? "warn" : "info"}>{t.kind}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted">{t.detail}</div>
                    </div>
                    <span className="hidden text-xs whitespace-nowrap text-muted sm:block">{fmtDateTime(t.since).slice(0, 17)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Pipeline by stage">
            <ul className="space-y-2 text-sm">
              {stats.byStage.length === 0 && <Empty>No cases yet.</Empty>}
              {stats.byStage
                .sort((a, b) => Object.keys(STAGE_LABELS).indexOf(a.stage) - Object.keys(STAGE_LABELS).indexOf(b.stage))
                .map((s) => (
                  <li key={s.stage} className="flex items-center justify-between gap-2">
                    <StageBadge stage={s.stage} />
                    <span className="tabular-nums">
                      {s._count} · <span className="text-muted">{pkrMillions(s._sum.amount ?? 0)}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
          <Card title="Recently updated">
            <ul className="space-y-3 text-sm">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <Link href={`/cases/${c.id}`} className="min-w-0">
                    <div className="truncate font-medium">
                      {c.ref} · {getProduct(c.productCode).name}
                    </div>
                    <div className="truncate text-xs text-muted">{c.customer.legalName}</div>
                  </Link>
                  <StageBadge stage={c.stage} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
