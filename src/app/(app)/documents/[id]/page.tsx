import Link from "next/link";
import { notFound } from "next/navigation";
import { requestOtpAction, signAction } from "@/app/actions/workflow";
import { Badge, Card, GeoLink, Hash, PageHeader, StatusBadge, fmtDateTime } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { auditNow } from "@/lib/audit";
import { db } from "@/lib/db";
import { verifyDocumentIntegrity } from "@/lib/engine/documents";
import type { SignerSlot } from "@/lib/products/types";
import { isMyTurnToSign, nextSlot } from "@/lib/queries";
import { roleLabel } from "@/lib/rbac";
import { renderMarkdown } from "@/lib/render";
import { canSeeCase } from "@/lib/scope";
import { SignPanel } from "./sign-panel";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, session } = await requireActor();
  const doc = await db.document.findFirst({
    where: { id, tenantId: actor.tenantId },
    include: { case: { include: { customer: true, steps: true } }, signatures: { orderBy: { slot: "asc" } }, template: true },
  });
  if (!doc || !canSeeCase(actor, doc.case)) notFound();
  const kase = doc.case;
  const plan = JSON.parse(doc.signerPlan) as SignerSlot[];
  const integrity = await verifyDocumentIntegrity(doc.id, actor.tenantId);
  const step = doc.stepKey ? kase.steps.find((s) => s.key === doc.stepKey) : undefined;
  const myTurn = isMyTurnToSign(actor, doc, kase, !doc.stepKey || step?.status === "READY");
  const { slot } = nextSlot(doc);
  await auditNow(actor, { eventType: "DOCUMENT_VIEWED", action: "VIEW", summary: `Viewed ${doc.title} v${doc.version}`, caseId: kase.id, customerId: kase.customerId, entityType: "Document", entityId: doc.id, docHash: doc.contentHash });

  return (
    <>
      <PageHeader
        back={{ href: `/cases/${kase.id}?tab=documents`, label: `${kase.ref} documents` }}
        title={doc.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={doc.status} /> v{doc.version} · {kase.customer.legalName} ·{" "}
            {integrity.ok ? <Badge tone="ok">Integrity verified</Badge> : <Badge tone="bad">Integrity check failed</Badge>}
          </span>
        }
        actions={
          <Link href={`/cases/${kase.id}/pack`} className="btn">
            Print execution pack
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <article className="doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }} />
        </Card>
        <div className="space-y-6">
          {myTurn && slot && (
            <Card title="Your signature">
              <SignPanel
                capacity={slot.capacity}
                fullName={session.user.fullName}
                hash={doc.contentHash}
                canDecline={slot.party !== "BANK"}
                requestOtp={requestOtpAction.bind(null, doc.id)}
                sign={signAction.bind(null, doc.id)}
              />
            </Card>
          )}
          <Card title="Signing sequence">
            <ol className="space-y-3">
              {plan.map((p, i) => {
                const sig = doc.signatures.find((s) => s.slot === i);
                return (
                  <li key={i} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {i + 1}. {p.capacity}
                      </span>
                      {sig ? <StatusBadge status={sig.decision} /> : <Badge>{i === doc.signatures.filter((s) => s.decision === "SIGNED").length && doc.status === "ISSUED" ? "next" : "pending"}</Badge>}
                    </div>
                    {p.roles && <div className="text-xs text-muted">Eligible: {p.roles.map(roleLabel).join(", ")}</div>}
                    {sig && (
                      <dl className="mt-2 space-y-0.5 text-xs text-muted">
                        <div>
                          <strong className="text-ink">{sig.signerName}</strong> ({roleLabel(sig.signerRole)}) · {sig.method}
                        </div>
                        <div>{fmtDateTime(sig.signedAt)}</div>
                        <div>
                          <GeoLink lat={sig.lat} lng={sig.lng} accuracy={sig.accuracy} /> · IP {sig.ip}
                        </div>
                        <div>
                          seal <Hash value={sig.seal} /> {integrity.signatures.find((x) => x.id === sig.id)?.sealValid ? "✓" : "✗"}
                        </div>
                        {sig.reason && <div>Reason: {sig.reason}</div>}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card title="Document integrity">
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted">SHA-256 of signed text</dt>
                <dd className="mono">{doc.contentHash}</dd>
              </div>
              <div>
                <dt className="text-muted">Template</dt>
                <dd>
                  {doc.template.code} v{doc.template.version}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Shariah approval</dt>
                <dd>{doc.template.shariahRef || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Legal approval</dt>
                <dd>{doc.template.legalRef || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Generated / executed</dt>
                <dd>
                  {fmtDateTime(doc.createdAt)} / {fmtDateTime(doc.executedAt)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
