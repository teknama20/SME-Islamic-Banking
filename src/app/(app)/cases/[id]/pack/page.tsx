import { notFound } from "next/navigation";
import { GeoLink, fmtDateTime } from "@/components/ui";
import { auditNow, verifyChain } from "@/lib/audit";
import { requireActor } from "@/lib/auth";
import { EVIDENCE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { verifyDocumentIntegrity } from "@/lib/engine/documents";
import { pkr } from "@/lib/pricing";
import { getProduct } from "@/lib/products/catalog";
import { roleLabel } from "@/lib/rbac";
import { renderMarkdown } from "@/lib/render";
import { PrintButton } from "./print-button";
import { loadCase } from "../load";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, session } = await requireActor();
  if (actor.kind !== "BANK") notFound();
  const loaded = await loadCase(actor, id);
  if (!loaded) notFound();
  const { kase, people } = loaded;
  const product = getProduct(kase.productCode);
  const docs = kase.documents.filter((d) => d.status === "EXECUTED" || d.status === "ISSUED");
  const [integrity, events, chain] = await Promise.all([
    Promise.all(docs.map((d) => verifyDocumentIntegrity(d.id, actor.tenantId))),
    db.auditEvent.findMany({ where: { tenantId: actor.tenantId, caseId: id }, orderBy: { seq: "asc" } }),
    verifyChain(actor.tenantId),
  ]);
  await auditNow(actor, { eventType: "EXECUTION_PACK_VIEWED", action: "VIEW", summary: `Execution pack opened for ${kase.ref}`, caseId: id, customerId: kase.customerId, entityType: "FinancingCase", entityId: id });

  return (
    <div className="mx-auto max-w-4xl space-y-8 bg-surface p-6 print:p-0">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>
      <header className="border-b border-line pb-4">
        <div className="text-sm text-muted">{session.tenant.legalName}</div>
        <h1 className="text-2xl font-semibold">Execution Pack — {kase.ref}</h1>
        <p className="text-sm">
          {product.name} for {kase.customer.legalName} · {pkr(kase.amount)} · {kase.tenorMonths} months · CPTM {kase.cptmNo}
        </p>
        <p className="text-xs text-muted">
          Generated {fmtDateTime(new Date())} by {session.user.fullName} ({roleLabel(actor.role)}). Audit chain: {chain.ok ? `verified (${chain.checked} events, head ${chain.headHash?.slice(0, 16)}…)` : `BROKEN at #${chain.brokenAtSeq}`}.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Approvals & clearances</h2>
        <table className="table">
          <tbody>
            {kase.clearances.map((c) => (
              <tr key={c.id}>
                <td>{c.track}</td>
                <td>{c.status}</td>
                <td>{people[c.decidedById ?? ""]?.fullName}</td>
                <td>{fmtDateTime(c.decidedAt)}</td>
                <td className="text-xs">{c.comments}</td>
              </tr>
            ))}
            {kase.approvals
              .filter((a) => a.status === "APPROVED")
              .map((a) => (
                <tr key={a.id}>
                  <td>
                    L{a.level} {roleLabel(a.role)}
                  </td>
                  <td>{a.action}</td>
                  <td>{people[a.decidedById ?? ""]?.fullName}</td>
                  <td>{fmtDateTime(a.decidedAt)}</td>
                  <td className="text-xs">{a.comments}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {docs.map((d, i) => (
        <section key={d.id} className="page-break">
          <h2 className="mb-2 text-lg font-semibold">
            {i + 2}. {d.title} <span className="text-sm font-normal text-muted">({d.status.toLowerCase()})</span>
          </h2>
          <article className="doc rounded-lg border border-line p-5" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.content) }} />
          <h3 className="mt-4 mb-1 text-sm font-semibold">Signature certificate</h3>
          <p className="mono">SHA-256 {d.contentHash} — {integrity[i].ok ? "text and all seals verified" : "VERIFICATION FAILED"}</p>
          <table className="table mt-2 text-xs">
            <thead>
              <tr>
                <th>#</th>
                <th>Capacity</th>
                <th>Signer</th>
                <th>Time</th>
                <th>Location / IP</th>
                <th>Seal</th>
              </tr>
            </thead>
            <tbody>
              {d.signatures.map((s) => (
                <tr key={s.id}>
                  <td>{s.slot + 1}</td>
                  <td>{s.capacity}</td>
                  <td>
                    {s.signerName} ({s.decision}, {s.method})
                  </td>
                  <td>{fmtDateTime(s.signedAt)}</td>
                  <td>
                    <GeoLink lat={s.lat} lng={s.lng} accuracy={s.accuracy} /> · {s.ip}
                  </td>
                  <td className="mono">{s.seal.slice(0, 24)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <section className="page-break">
        <h2 className="mb-2 text-lg font-semibold">{docs.length + 2}. Possession & evidence register</h2>
        <table className="table text-xs">
          <thead>
            <tr>
              <th>Category</th>
              <th>Description</th>
              <th>Server time</th>
              <th>GPS</th>
              <th>Captured / verified</th>
              <th>SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {kase.evidence.map((e) => (
              <tr key={e.id}>
                <td>{EVIDENCE_LABELS[e.category]}</td>
                <td>{e.description}</td>
                <td>{fmtDateTime(e.serverTime)}</td>
                <td>
                  <GeoLink lat={e.lat} lng={e.lng} accuracy={e.accuracy} />
                </td>
                <td>
                  {people[e.capturedById]?.fullName} / {people[e.verifiedById ?? ""]?.fullName ?? "—"} ({e.status})
                </td>
                <td className="mono">{e.file.sha256.slice(0, 20)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="page-break">
        <h2 className="mb-2 text-lg font-semibold">{docs.length + 3}. Audit trail</h2>
        <table className="table text-xs">
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="mono">#{e.seq}</td>
                <td>{fmtDateTime(e.occurredAt)}</td>
                <td>
                  {e.actorName} ({roleLabel(e.actorRole)})
                </td>
                <td>{e.summary}</td>
                <td className="mono">{e.hash.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
