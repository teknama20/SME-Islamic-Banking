import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { KYC_DOC_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { assertSameOrigin, fileFromForm, routeActor } from "@/lib/http";
import { AccessError, RuleError, can } from "@/lib/rbac";
import { customerScope } from "@/lib/scope";
import { storeFile } from "@/lib/storage";

/** KYC / business document upload (HTML form post → redirect back). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = new URL(`/customers/${id}`, req.url);
  try {
    assertSameOrigin(req);
    const fd = await req.formData();
    const actor = await routeActor(fd);
    const allowed = actor.kind === "CUSTOMER" ? actor.customerId === id : can(actor.role, "customer.edit") || actor.role === "RCAD";
    if (!allowed) throw new AccessError();
    const file = await fileFromForm(fd, "file");
    if (!file) throw new RuleError("Choose a file.");
    const docType = String(fd.get("docType"));
    if (!KYC_DOC_TYPES.includes(docType)) throw new RuleError("Unknown document type.");
    await db.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { ...customerScope(actor), id } });
      if (!customer) throw new AccessError();
      const stored = await storeFile(tx, { tenantId: actor.tenantId, uploadedById: actor.userId, buffer: file.buffer, originalName: file.name, mimeType: file.type });
      const doc = await tx.customerDocument.create({ data: { customerId: id, docType, fileId: stored.id, uploadedById: actor.userId } });
      await audit(tx, actor, { eventType: "KYC_DOCUMENT_UPLOADED", action: "UPLOAD", summary: `${docType} uploaded (${file.name})`, customerId: id, entityType: "CustomerDocument", entityId: doc.id, docHash: stored.sha256 });
    });
    back.searchParams.set("uploaded", "1");
  } catch (e) {
    back.searchParams.set("error", e instanceof RuleError || e instanceof AccessError ? e.message : "Upload failed.");
    if (!(e instanceof RuleError || e instanceof AccessError)) console.error(e);
  }
  return NextResponse.redirect(back, 303);
}
