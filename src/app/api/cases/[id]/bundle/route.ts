import { NextResponse } from "next/server";
import { auditNow, verifyChain } from "@/lib/audit";
import { canonicalJson, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { verifyDocumentIntegrity } from "@/lib/engine/documents";
import { errorResponse, routeActor } from "@/lib/http";
import { AccessError, can } from "@/lib/rbac";
import { assertCaseAccess } from "@/lib/scope";

/**
 * Court-ready evidence bundle (JSON): case data, every document version with
 * its hash and signatures, all evidence metadata with file hashes, the case's
 * audit events and a verification of the tenant hash chain. The bundle itself
 * is hashed so a copy can be checked later.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await routeActor();
    if (actor.kind === "CUSTOMER") throw new AccessError("Evidence bundles are available to bank staff and auditors.");
    const kase = await db.financingCase.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        customer: { include: { people: true } },
        clearances: true,
        approvals: { orderBy: [{ round: "asc" }, { level: "asc" }] },
        documents: { include: { signatures: { orderBy: { slot: "asc" } }, template: { select: { code: true, version: true, shariahRef: true, legalRef: true } } }, orderBy: { createdAt: "asc" } },
        steps: { orderBy: { seq: "asc" } },
        evidence: { include: { file: true, stampedFile: true }, orderBy: { serverTime: "asc" } },
        schedule: { orderBy: { seq: "asc" } },
      },
    });
    if (!kase) throw new AccessError("Case not found.");
    assertCaseAccess(actor, kase);
    if (!can(actor.role, "audit.view") && actor.userId !== kase.rmId && !["RCAD", "SHARIAH", "LEGAL", "OPERATIONS", "CREDIT_RISK"].includes(actor.role)) throw new AccessError();

    const events = await db.auditEvent.findMany({ where: { tenantId: actor.tenantId, caseId: id }, orderBy: { seq: "asc" } });
    const integrity = await Promise.all(kase.documents.map((d) => verifyDocumentIntegrity(d.id, actor.tenantId)));
    const chain = await verifyChain(actor.tenantId);
    const body = {
      generatedAt: new Date().toISOString(),
      generatedBy: { id: actor.userId, name: actor.name, role: actor.role },
      case: kase,
      documentIntegrity: integrity,
      auditEvents: events,
      auditChain: chain,
    };
    const payload = canonicalJson(body);
    const bundleHash = sha256(payload);
    await auditNow(actor, { eventType: "EVIDENCE_BUNDLE_EXPORTED", action: "DOWNLOAD", summary: `Evidence bundle exported for ${kase.ref}`, caseId: id, customerId: kase.customerId, entityType: "FinancingCase", entityId: id, docHash: bundleHash });
    return new NextResponse(JSON.stringify({ bundleSha256: bundleHash, ...JSON.parse(payload) }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${kase.ref}-evidence-bundle.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
