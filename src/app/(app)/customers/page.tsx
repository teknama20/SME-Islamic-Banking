import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { pkrMillions } from "@/lib/pricing";
import { can } from "@/lib/rbac";
import { SME_LABELS, type SmeCategory } from "@/lib/sbp";
import { customerScope } from "@/lib/scope";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { actor } = await requireActor();
  if (actor.kind === "CUSTOMER") redirect(`/customers/${actor.customerId}`);
  const { q = "" } = await searchParams;
  const customers = await db.customer.findMany({
    where: { ...customerScope(actor), ...(q ? { OR: [{ legalName: { contains: q } }, { cif: { contains: q } }, { ntn: { contains: q } }] } : {}) },
    include: { rm: { select: { fullName: true } }, _count: { select: { cases: true } } },
    orderBy: { legalName: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="SME customers in your portfolio, classified per SBP SME PR Part-I"
        actions={
          can(actor.role, "customer.create") && (
            <Link href="/customers/new" className="btn btn-primary">
              Onboard customer
            </Link>
          )
        }
      />
      <Card>
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, CIF or NTN" className="input max-w-sm" />
          <button className="btn">Search</button>
        </form>
        {customers.length === 0 ? (
          <Empty>No customers found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Sector</th>
                  <th>Turnover</th>
                  <th>KYC</th>
                  <th>RM</th>
                  <th>Cases</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`} className="link">
                        {c.legalName}
                      </Link>
                      <div className="text-xs text-muted">
                        {c.cif} · {c.city}
                      </div>
                    </td>
                    <td>
                      <Badge tone="brand">{SME_LABELS[c.smeCategory as SmeCategory]}</Badge>
                      {c.isStartup && <Badge tone="info">Start-up</Badge>}
                      {c.womenLed && <Badge tone="info">Women-led</Badge>}
                    </td>
                    <td className="text-muted">{c.sector}</td>
                    <td className="tabular-nums">{pkrMillions(c.annualTurnover)}</td>
                    <td>
                      <StatusBadge status={c.kycStatus} />
                    </td>
                    <td className="text-muted">{c.rm.fullName}</td>
                    <td className="tabular-nums">{c._count.cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
