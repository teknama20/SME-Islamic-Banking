import Link from "next/link";
import { Card, Empty, PageHeader, StageBadge, fmtDate } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { STAGES, STAGE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { pkrMillions } from "@/lib/pricing";
import { PRODUCTS, getProduct } from "@/lib/products/catalog";
import { PENDING_INCLUDE, pendingSummary } from "@/lib/pending";
import { can } from "@/lib/rbac";
import { caseScope } from "@/lib/scope";

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ stage?: string; product?: string; q?: string }> }) {
  const { actor } = await requireActor();
  const sp = await searchParams;
  const cases = await db.financingCase.findMany({
    where: {
      ...caseScope(actor),
      ...(sp.stage ? { stage: sp.stage } : {}),
      ...(sp.product ? { productCode: sp.product } : {}),
      ...(sp.q ? { OR: [{ ref: { contains: sp.q } }, { cptmNo: { contains: sp.q } }, { customer: { legalName: { contains: sp.q } } }] } : {}),
    },
    include: { rm: { select: { fullName: true } }, ...PENDING_INCLUDE },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const now = new Date();

  return (
    <>
      <PageHeader
        title={actor.kind === "CUSTOMER" ? "My financing" : "Financing cases"}
        subtitle="Credit Proposal Tracking Mechanism (SME PR R-19) — every application has a unique CPTM number"
        actions={
          can(actor.role, "case.create") && (
            <Link href="/cases/new" className="btn btn-primary">
              New request
            </Link>
          )
        }
      />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Ref, CPTM or customer" className="input max-w-xs" />
          <select name="stage" defaultValue={sp.stage ?? ""} className="input max-w-xs">
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <select name="product" defaultValue={sp.product ?? ""} className="input max-w-xs">
            <option value="">All products</option>
            {PRODUCTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn">Filter</button>
        </form>
        {cases.length === 0 ? (
          <Empty>No cases match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th className="text-right">Amount</th>
                  <th>Stage</th>
                  <th>Pending with</th>
                  <th>TAT due</th>
                  <th>RM</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const breached = c.tatDueAt && c.tatDueAt < now && ["UNDER_REVIEW", "PENDING_APPROVAL", "RETURNED"].includes(c.stage);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/cases/${c.id}`} className="link">
                          {c.ref}
                        </Link>
                        <div className="mono text-muted">{c.cptmNo ?? "not submitted"}</div>
                      </td>
                      <td>{c.customer.legalName}</td>
                      <td>{getProduct(c.productCode).name}</td>
                      <td className="text-right tabular-nums">{pkrMillions(c.amount)}</td>
                      <td>
                        <StageBadge stage={c.stage} />
                      </td>
                      <td className="max-w-64 text-xs">
                        {(() => {
                          const p = pendingSummary(actor, c);
                          return p.mine ? (
                            <Link href={`/cases/${c.id}`} className="font-semibold text-warn hover:underline">
                              ▶ {p.text}
                            </Link>
                          ) : (
                            <span className="text-muted">{p.text}</span>
                          );
                        })()}
                      </td>
                      <td className={breached ? "font-medium text-bad" : "text-muted"}>{c.tatDueAt ? fmtDate(c.tatDueAt) : "—"}</td>
                      <td className="text-muted">{c.rm.fullName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
