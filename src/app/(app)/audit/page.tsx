import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, GeoLink, Hash, PageHeader, fmtDateTime } from "@/components/ui";
import { verifyChain } from "@/lib/audit";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, roleLabel } from "@/lib/rbac";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; actor?: string; q?: string; page?: string }> }) {
  const { actor } = await requireActor();
  if (!can(actor.role, "audit.view")) redirect("/dashboard");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    tenantId: actor.tenantId,
    ...(sp.type ? { eventType: sp.type } : {}),
    ...(sp.actor ? { actorName: { contains: sp.actor } } : {}),
    ...(sp.q ? { summary: { contains: sp.q } } : {}),
  };
  const [events, total, types, chain] = await Promise.all([
    db.auditEvent.findMany({ where, orderBy: { seq: "desc" }, take: 100, skip: (page - 1) * 100 }),
    db.auditEvent.count({ where }),
    db.auditEvent.groupBy({ by: ["eventType"], where: { tenantId: actor.tenantId }, _count: true, orderBy: { eventType: "asc" } }),
    verifyChain(actor.tenantId),
  ]);
  const cases = await db.financingCase.findMany({ where: { id: { in: events.map((e) => e.caseId).filter(Boolean) as string[] } }, select: { id: true, ref: true } });
  const refs = Object.fromEntries(cases.map((c) => [c.id, c.ref]));

  return (
    <>
      <PageHeader title="Audit trail" subtitle="Append-only, hash-chained record of every action: who, what, when, where, why and from which device." />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {chain.ok ? <Badge tone="ok">Chain intact</Badge> : <Badge tone="bad">Chain broken</Badge>}
          <span className="text-sm">
            {chain.ok ? `All ${chain.checked} events re-hashed and linked; head hash` : `First break at event #${chain.brokenAtSeq}: ${chain.reason}`} {chain.headHash && <Hash value={chain.headHash} />}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">Each event stores SHA-256(previous hash + canonical event). Database triggers reject UPDATE and DELETE on audit events and signatures; any out-of-band change breaks verification at the exact event.</p>
      </Card>
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <select name="type" defaultValue={sp.type ?? ""} className="input max-w-xs">
            <option value="">All event types</option>
            {types.map((t) => (
              <option key={t.eventType} value={t.eventType}>
                {t.eventType} ({t._count})
              </option>
            ))}
          </select>
          <input name="actor" defaultValue={sp.actor} placeholder="Actor name" className="input max-w-[12rem]" />
          <input name="q" defaultValue={sp.q} placeholder="Search summary" className="input max-w-xs" />
          <button className="btn">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>When (PKT)</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Case</th>
                <th>Where / device</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.seq}</td>
                  <td className="text-xs whitespace-nowrap">{fmtDateTime(e.occurredAt)}</td>
                  <td className="text-xs">
                    <div className="font-medium">{e.actorName}</div>
                    <div className="text-muted">{roleLabel(e.actorRole)}</div>
                  </td>
                  <td className="text-sm">
                    <Badge tone="info">{e.eventType}</Badge>
                    <div className="mt-1">{e.summary}</div>
                    {(e.before || e.after) && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-muted">before / after</summary>
                        {e.before && <pre className="mono mt-1 whitespace-pre-wrap text-muted">− {e.before}</pre>}
                        {e.after && <pre className="mono mt-1 whitespace-pre-wrap">+ {e.after}</pre>}
                      </details>
                    )}
                  </td>
                  <td className="text-xs">{e.caseId ? <Link href={`/cases/${e.caseId}?tab=audit`} className="link">{refs[e.caseId] ?? "case"}</Link> : "—"}</td>
                  <td className="text-xs">
                    <GeoLink lat={e.lat} lng={e.lng} accuracy={e.accuracy} />
                    <div className="text-muted">{e.ip}</div>
                    <div className="max-w-[14rem] truncate text-muted" title={e.userAgent}>
                      {e.userAgent}
                    </div>
                  </td>
                  <td className="text-xs">
                    <Hash value={e.hash} />
                    {e.docHash && (
                      <div>
                        doc <Hash value={e.docHash} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {total} events · page {page} of {Math.max(1, Math.ceil(total / 100))}
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link className="btn btn-sm" href={{ query: { ...sp, page: page - 1 } }}>
                Newer
              </Link>
            )}
            {page * 100 < total && (
              <Link className="btn btn-sm" href={{ query: { ...sp, page: page + 1 } }}>
                Older
              </Link>
            )}
          </span>
        </div>
      </Card>
    </>
  );
}
