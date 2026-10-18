import { auditNow } from "@/lib/audit";
import { db } from "@/lib/db";
import { errorResponse, routeActor } from "@/lib/http";
import { AccessError } from "@/lib/rbac";
import { canSeeCase, customerScope } from "@/lib/scope";
import { loadFile } from "@/lib/storage";

/** Decrypts and streams a vault file after an access check; every view is audited. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await routeActor();
    const file = await db.storedFile.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { evidence: { include: { case: true } }, stampedEvidence: { include: { case: true } }, customerDocs: true },
    });
    if (!file) throw new AccessError("File not found.");
    const ev = file.evidence[0] ?? file.stampedEvidence[0];
    let caseId: string | undefined;
    let customerId: string | undefined;
    if (ev) {
      if (!canSeeCase(actor, ev.case)) throw new AccessError();
      caseId = ev.caseId;
      customerId = ev.case.customerId;
    } else if (file.customerDocs[0]) {
      customerId = file.customerDocs[0].customerId;
      const ok = await db.customer.findFirst({ where: { ...customerScope(actor), id: customerId } });
      if (!ok) throw new AccessError();
    } else throw new AccessError();

    const data = await loadFile(file);
    const download = new URL(req.url).searchParams.has("download");
    await auditNow(actor, {
      eventType: download ? "FILE_DOWNLOADED" : "FILE_VIEWED",
      action: download ? "DOWNLOAD" : "VIEW",
      summary: `${download ? "Downloaded" : "Viewed"} ${file.originalName}`,
      caseId,
      customerId,
      entityType: "StoredFile",
      entityId: file.id,
      docHash: file.sha256,
    });
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.originalName.replace(/[^\w.\- ]/g, "_")}"`,
        "X-Content-SHA256": file.sha256,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
