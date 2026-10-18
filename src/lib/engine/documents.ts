// Document generation from approved templates and ordered digital signing.
//
// Signing protocol (per signer slot, strictly in order):
//   1. signer requests an OTP bound to (user, document)
//   2. signer reviews the exact text, types their full name, consents and
//      enters the OTP; browser GPS is captured
//   3. server re-hashes the stored text, checks it equals contentHash,
//      verifies the OTP and the signer's eligibility, then writes an
//      append-only Signature with an HMAC seal over (doc hash, signer, slot, time)
//   4. an audit event with the document hash is chained into the trail
import type { Document, FinancingCase } from "@prisma/client";
import type { Actor } from "../actor";
import { audit } from "../audit";
import { generateOtp, hashOtp, safeEqualHex, sealSignature, sha256 } from "../crypto";
import { db, type Tx } from "../db";
import { LEGAL_FORMS, REPAYMENT_LABELS } from "../constants";
import { amountInWords, buildSchedule, pkr } from "../pricing";
import { docSpec, getProduct } from "../products/catalog";
import type { SignerSlot } from "../products/types";
import { AccessError, RuleError, roleLabel } from "../rbac";
import { merge } from "../render";
import { assertCaseAccess } from "../scope";
import { parseSettings } from "../tenant";
import { afterDocumentExecuted } from "./execution";
import { customerUsers, notify, usersForRoles } from "./notify";

export const OFFER_DOCS = ["OFFER_LETTER", "KFS"];

function scheduleTable(lines: ReturnType<typeof buildSchedule>["lines"], labels: { principal: string; profit: string }, dm: boolean) {
  const head = dm ? `| # | Due date | ${labels.principal} | ${labels.profit} | Instalment | Bank share after |\n|---|---|---|---|---|---|` : `| # | Due date | ${labels.principal} | ${labels.profit} | Instalment |\n|---|---|---|---|---|`;
  const shown = lines.length > 14 ? [...lines.slice(0, 12), null, lines[lines.length - 1]] : lines;
  const rows = shown.map((l) =>
    l === null
      ? dm
        ? `| … | … | … | … | … | … |`
        : `| … | … | … | … | … |`
      : `| ${l.seq} | ${l.dueDate.toISOString().slice(0, 10)} | ${pkr(l.principal)} | ${pkr(l.profit)} | ${pkr(l.total)} |${dm ? ` ${l.bankShare.toFixed(2)}% |` : ""}`,
  );
  const total = lines.reduce((s, l) => s + l.total, 0);
  return [head, ...rows, dm ? `| | **Total** | | | **${pkr(total)}** | |` : `| | **Total** | | | **${pkr(total)}** |`].join("\n");
}

export async function buildContext(tx: Tx, c: FinancingCase) {
  const [tenant, customer, approvals, signatory] = await Promise.all([
    tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } }),
    tx.customer.findUniqueOrThrow({ where: { id: c.customerId } }),
    tx.approval.findMany({ where: { caseId: c.id, status: "APPROVED", action: "APPROVE" }, orderBy: { decidedAt: "desc" }, take: 1 }),
    tx.user.findFirst({ where: { customerId: c.customerId, role: "CUSTOMER_SIGNATORY" } }),
  ]);
  const product = getProduct(c.productCode);
  const structure = JSON.parse(c.structure || "{}") as Record<string, string>;
  const start = c.activatedAt ?? new Date();
  const pricing = buildSchedule({ model: product.pricing, amount: c.amount, tenorMonths: c.tenorMonths, profitRate: c.profitRate, repayment: c.repayment, startDate: start, structure });

  const s: Record<string, string> = {};
  for (const f of product.fields) s[f.name] = (structure[f.name] ?? "").toString().trim() || "N/A";
  if (product.code === "DIMINISHING_MUSHARAKAH") {
    const total = Number(structure.totalAssetValue) || 0;
    s.totalAssetValue = pkr(total);
    s.customerContribution = pkr(total - c.amount);
    s.bankSharePct = total ? ((c.amount / total) * 100).toFixed(2) : "0";
    s.customerSharePct = total ? (100 - (c.amount / total) * 100).toFixed(2) : "0";
  }
  if (product.code === "IJARAH") s.securityDeposit = structure.securityDeposit ? pkr(Number(structure.securityDeposit)) : "Nil";

  const final = approvals[0];
  return {
    bank: { name: tenant.name, legalName: tenant.legalName, shariahBoardRef: tenant.shariahBoardRef || "Shariah Board approval on file" },
    customer: {
      legalName: customer.legalName,
      cif: customer.cif,
      ntn: customer.ntn || "N/A",
      address: customer.address,
      city: customer.city,
      registrationNo: customer.registrationNo || "N/A",
      legalForm: LEGAL_FORMS[customer.legalForm] ?? customer.legalForm,
      signatory: signatory?.fullName ?? "Authorised Signatory",
    },
    case: {
      ref: c.ref,
      cptmNo: c.cptmNo ?? "—",
      purpose: c.purpose,
      amount: pkr(c.amount),
      amountWords: amountInWords(c.amount),
      tenorMonths: c.tenorMonths,
      profitRate: c.profitRate.toFixed(2),
      benchmark: c.benchmark,
      repayment: REPAYMENT_LABELS[c.repayment]?.en ?? c.repayment,
      repaymentUrdu: REPAYMENT_LABELS[c.repayment]?.ur ?? c.repayment,
      security: c.securityType === "CLEAN" ? "Clean — personal guarantee(s) only (SME PR R-9)" : c.collateral || "As per sanction",
      collateral: c.collateral || "N/A",
      guarantorName: structure.guarantorName || "N/A",
    },
    product: { name: product.name, nameUrdu: product.nameUrdu },
    pricing: {
      cost: pkr(pricing.cost),
      profit: pkr(pricing.profit),
      totalPayable: pkr(pricing.totalPayable),
      instalments: pricing.instalments,
      instalmentAmount: pkr(pricing.instalmentAmount),
      schedule: scheduleTable(pricing.lines, pricing.labels, product.pricing === "DM_UNITS"),
    },
    s,
    approval: {
      authority: final ? roleLabel(final.role) : "Approving authority",
      date: final?.decidedAt ? final.decidedAt.toISOString().slice(0, 10) : "—",
    },
    date: { today: new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" }) },
  };
}

/** Generates a document from the latest APPROVED template version. */
export async function generateDocument(tx: Tx, actor: Actor, c: FinancingCase, code: string, stepKey?: string): Promise<Document> {
  const product = getProduct(c.productCode);
  const spec = docSpec(product, code);
  const template = await tx.template.findFirst({
    where: { tenantId: c.tenantId, code, status: "APPROVED" },
    orderBy: { version: "desc" },
  });
  if (!template) throw new RuleError(`No Shariah- and Legal-approved template is available for ${spec.title}.`);
  const ctx = await buildContext(tx, c);
  const { text, missing } = merge(template.body, ctx);
  if (missing.length) throw new RuleError(`Cannot generate ${spec.title}: missing data ${missing.join(", ")}.`);

  const previous = await tx.document.count({ where: { caseId: c.id, code } });
  const doc = await tx.document.create({
    data: {
      tenantId: c.tenantId,
      caseId: c.id,
      templateId: template.id,
      code,
      title: spec.title,
      version: previous + 1,
      content: text,
      contentHash: sha256(text),
      signerPlan: JSON.stringify(spec.signers),
      stepKey,
      createdById: actor.userId,
    },
  });
  await audit(tx, actor, {
    eventType: "DOCUMENT_GENERATED",
    action: "CREATE",
    summary: `${spec.title} v${doc.version} generated from template ${template.code} v${template.version}`,
    caseId: c.id,
    customerId: c.customerId,
    entityType: "Document",
    entityId: doc.id,
    docHash: doc.contentHash,
    after: { templateId: template.id, templateVersion: template.version, signers: spec.signers.map((x) => x.capacity) },
  });
  return doc;
}

export type SigningContext = {
  doc: Document & { signatures: { signerId: string; decision: string }[] };
  kase: FinancingCase;
  slot: SignerSlot;
  slotIndex: number;
};

/** Validates that `actor` is the next eligible signer; returns the slot. */
export async function assertCanSign(tx: Tx, actor: Actor, documentId: string): Promise<SigningContext> {
  const doc = await tx.document.findFirst({
    where: { id: documentId, tenantId: actor.tenantId },
    include: { signatures: { orderBy: { slot: "asc" } }, case: true },
  });
  if (!doc) throw new AccessError("Document not found.");
  const kase = doc.case;
  assertCaseAccess(actor, kase);
  if (doc.status !== "ISSUED") throw new RuleError(`Document is ${doc.status.toLowerCase()} and cannot be signed.`);
  if (sha256(doc.content) !== doc.contentHash) throw new RuleError("Integrity failure: document text does not match its recorded hash.");

  const plan = JSON.parse(doc.signerPlan) as SignerSlot[];
  const slotIndex = doc.signatures.filter((s) => s.decision === "SIGNED").length;
  const slot = plan[slotIndex];
  if (!slot) throw new RuleError("All signatures have been collected.");

  const isOffer = OFFER_DOCS.includes(doc.code);
  if (isOffer) {
    const customerSide = slot.party === "CUSTOMER" || slot.party === "GUARANTOR";
    if (!["SANCTIONED", "OFFERED"].includes(kase.stage)) throw new RuleError("The offer can only be signed between sanction and acceptance.");
    if (customerSide && kase.stage !== "OFFERED") throw new RuleError("The offer reaches the customer once the bank has signed it.");
  } else {
    if (kase.stage !== "EXECUTION") throw new RuleError("Execution documents can only be signed during the execution stage.");
    if (doc.stepKey) {
      const step = await tx.executionStep.findUnique({ where: { caseId_key: { caseId: kase.id, key: doc.stepKey } } });
      if (step?.status !== "READY") throw new RuleError("Preceding steps must be completed before this document can be signed.");
    }
  }

  if (slot.party === "CUSTOMER") {
    if (actor.role !== "CUSTOMER_SIGNATORY" || actor.customerId !== kase.customerId) throw new AccessError(`This signature is reserved for: ${slot.capacity}.`);
  } else if (slot.party === "GUARANTOR") {
    if (actor.role !== "GUARANTOR" || actor.customerId !== kase.customerId) throw new AccessError(`This signature is reserved for: ${slot.capacity}.`);
  } else {
    if (actor.kind !== "BANK" || !slot.roles?.includes(actor.role as never)) throw new AccessError(`This signature is reserved for: ${slot.capacity}.`);
    // Four eyes: each bank signature on a document must be a different officer.
    // (RCAD may prepare and later verify the same document.)
    if (slot.party === "BANK" && doc.signatures.some((s) => s.party === "BANK" && s.signerId === actor.userId))
      throw new RuleError("Four-eyes rule: the same officer cannot sign twice for the bank.");
  }
  return { doc, kase, slot, slotIndex };
}

/** Issues a signing OTP. Returns the code only when the tenant uses on-screen delivery (demo). */
export async function requestSigningOtp(actor: Actor, documentId: string) {
  return db.$transaction(async (tx) => {
    const { doc, kase, slot } = await assertCanSign(tx, actor, documentId);
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
    const settings = parseSettings(tenant.settings);
    const code = generateOtp();
    const ch = await tx.otpChallenge.create({
      data: { tenantId: actor.tenantId, userId: actor.userId, purpose: "SIGN", refId: doc.id, codeHash: "pending", expiresAt: new Date(Date.now() + settings.otpTtlSeconds * 1000) },
    });
    await tx.otpChallenge.update({ where: { id: ch.id }, data: { codeHash: hashOtp(actor.tenantId, ch.id, code) } });
    await audit(tx, actor, {
      eventType: "SIGNING_OTP_ISSUED",
      action: "OTP",
      summary: `Signing OTP issued for ${doc.title} (${slot.capacity})`,
      caseId: kase.id,
      customerId: kase.customerId,
      entityType: "Document",
      entityId: doc.id,
      docHash: doc.contentHash,
    });
    return { challengeId: ch.id, devCode: settings.otpDelivery === "screen" ? code : undefined, expiresInSeconds: settings.otpTtlSeconds };
  });
}

/**
 * Checks an OTP inside the caller's transaction. A wrong code increments the
 * attempt counter and returns an error message (instead of throwing) so the
 * caller can commit the increment and then fail.
 */
export async function checkOtp(tx: Tx, actor: Actor, challengeId: string, code: string, purpose: string, refId: string): Promise<string | null> {
  const ch = await tx.otpChallenge.findFirst({ where: { id: challengeId, userId: actor.userId, purpose, refId } });
  if (!ch || ch.consumedAt) return "OTP is invalid or already used. Request a new one.";
  if (ch.expiresAt < new Date()) return "OTP has expired. Request a new one.";
  if (ch.attempts >= 5) return "Too many attempts. Request a new OTP.";
  if (!safeEqualHex(hashOtp(actor.tenantId, ch.id, code.trim()), ch.codeHash)) {
    await tx.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    return "Incorrect OTP.";
  }
  await tx.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
  return null;
}

export type SignInput = {
  challengeId: string;
  otp: string;
  typedName: string;
  consent: boolean;
  decision: "SIGNED" | "DECLINED";
  reason?: string;
};

export async function signDocument(actor: Actor, documentId: string, input: SignInput) {
  const result = await db.$transaction(async (tx) => {
    const { doc, kase, slot, slotIndex } = await assertCanSign(tx, actor, documentId);
    if (!input.consent) throw new RuleError("You must confirm you have read and agree to the document.");
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (input.typedName.trim().toLowerCase() !== user.fullName.trim().toLowerCase()) throw new RuleError(`Type your full name exactly as registered: ${user.fullName}.`);
    if (input.decision === "DECLINED" && !(input.reason ?? "").trim()) throw new RuleError("A reason is required to decline.");
    if (input.decision === "DECLINED" && (slot.party === "BANK" || slot.party === "RCAD")) throw new RuleError("Bank signatories return a case through the approval workflow, not by declining a document.");
    const otpError = await checkOtp(tx, actor, input.challengeId, input.otp, "SIGN", doc.id);
    if (otpError) return { otpError };

    const signedAt = new Date();
    const seal = sealSignature(actor.tenantId, [doc.id, doc.contentHash, slotIndex, actor.userId, slot.party, input.decision, signedAt.toISOString()]);
    const signature = await tx.signature.create({
      data: {
        documentId: doc.id,
        slot: slotIndex,
        party: slot.party,
        capacity: slot.capacity,
        signerId: actor.userId,
        signerName: input.typedName.trim(),
        signerRole: actor.role,
        method: "OTP_ESIGN",
        decision: input.decision,
        reason: input.reason ?? "",
        docHash: doc.contentHash,
        seal,
        ip: actor.ip ?? "",
        userAgent: actor.userAgent ?? "",
        lat: actor.geo?.lat,
        lng: actor.geo?.lng,
        accuracy: actor.geo?.accuracy ?? undefined,
        signedAt,
      },
    });
    await audit(tx, actor, {
      eventType: input.decision === "SIGNED" ? "DOCUMENT_SIGNED" : "DOCUMENT_DECLINED",
      action: input.decision === "SIGNED" ? "SIGN" : "DECLINE",
      summary: `${doc.title}: ${input.decision === "SIGNED" ? "signed" : "declined"} by ${user.fullName} as ${slot.capacity}`,
      caseId: kase.id,
      customerId: kase.customerId,
      entityType: "Signature",
      entityId: signature.id,
      docHash: doc.contentHash,
      after: { slot: slotIndex, capacity: slot.capacity, method: "OTP_ESIGN", seal, reason: input.reason ?? "" },
    });

    const plan = JSON.parse(doc.signerPlan) as SignerSlot[];
    if (input.decision === "DECLINED") {
      await tx.document.update({ where: { id: doc.id }, data: { status: "DECLINED" } });
      if (OFFER_DOCS.includes(doc.code)) {
        await tx.financingCase.update({ where: { id: kase.id }, data: { stage: "DECLINED" } });
        await audit(tx, actor, { eventType: "OFFER_DECLINED", action: "DECLINE", summary: `Customer declined the offer: ${input.reason}`, caseId: kase.id, customerId: kase.customerId, entityType: "FinancingCase", entityId: kase.id, before: { stage: kase.stage }, after: { stage: "DECLINED" } });
      }
      await notify(tx, kase.tenantId, [kase.rmId], `${doc.title} declined`, input.reason ?? "", `/cases/${kase.id}`);
      return { otpError: null };
    }

    const executed = slotIndex === plan.length - 1;
    if (executed) {
      await tx.document.update({ where: { id: doc.id }, data: { status: "EXECUTED", executedAt: signedAt } });
      await audit(tx, actor, { eventType: "DOCUMENT_EXECUTED", action: "EXECUTE", summary: `${doc.title} fully executed (${plan.length} signature(s))`, caseId: kase.id, customerId: kase.customerId, entityType: "Document", entityId: doc.id, docHash: doc.contentHash });
      await afterDocumentExecuted(tx, actor, kase, doc);
    } else {
      const next = plan[slotIndex + 1];
      // The offer goes to the customer automatically once the bank has signed it.
      if (doc.code === "OFFER_LETTER" && kase.stage === "SANCTIONED" && (next.party === "CUSTOMER" || next.party === "GUARANTOR")) {
        await tx.financingCase.update({ where: { id: kase.id }, data: { stage: "OFFERED", offeredAt: signedAt } });
        await audit(tx, actor, {
          eventType: "OFFER_ISSUED",
          action: "ISSUE",
          summary: `Offer letter signed by the bank and issued to the customer for ${kase.ref}`,
          caseId: kase.id,
          customerId: kase.customerId,
          entityType: "Document",
          entityId: doc.id,
          docHash: doc.contentHash,
          before: { stage: "SANCTIONED" },
          after: { stage: "OFFERED" },
        });
      }
      await notifyNextSigner(tx, kase, doc, next);
    }
    return { otpError: null };
  });
  if (result.otpError) throw new RuleError(result.otpError);
}

export async function notifyNextSigner(tx: Tx, kase: FinancingCase, doc: Document, next: SignerSlot) {
  const link = `/documents/${doc.id}`;
  if (next.party === "BANK" || next.party === "RCAD") {
    const users = await usersForRoles(tx, kase.tenantId, next.roles ?? [], kase);
    await notify(tx, kase.tenantId, users.map((u) => u.id), "Signature required", `${doc.title} — ${next.capacity}`, link);
  } else {
    const users = await customerUsers(tx, kase.customerId, [next.party === "GUARANTOR" ? "GUARANTOR" : "CUSTOMER_SIGNATORY"]);
    await notify(tx, kase.tenantId, users.map((u) => u.id), "Signature required", `${doc.title} — ${next.capacity}`, link);
  }
}

/** Re-verifies a document: hash of text, and every signature seal. */
export async function verifyDocumentIntegrity(documentId: string, tenantId: string) {
  const doc = await db.document.findFirstOrThrow({ where: { id: documentId, tenantId }, include: { signatures: { orderBy: { slot: "asc" } } } });
  const textOk = sha256(doc.content) === doc.contentHash;
  const signatures = doc.signatures.map((s) => ({
    id: s.id,
    slot: s.slot,
    hashMatches: s.docHash === doc.contentHash,
    sealValid: sealSignature(tenantId, [doc.id, s.docHash, s.slot, s.signerId, s.party, s.decision, s.signedAt.toISOString()]) === s.seal,
  }));
  return { textOk, signatures, ok: textOk && signatures.every((s) => s.hashMatches && s.sealValid) };
}
