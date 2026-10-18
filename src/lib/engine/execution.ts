// Execution plan: signatures, possession evidence, operational actions and
// Shariah checks, unlocked strictly by dependency order.
import type { Document, ExecutionStep, FinancingCase } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "../actor";
import { audit } from "../audit";
import { db, type Tx } from "../db";
import { buildSchedule } from "../pricing";
import { buildExecutionPlan, docSpec, getProduct } from "../products/catalog";
import type { SignerSlot, StepSpec } from "../products/types";
import { AccessError, RuleError, isCustomerRole } from "../rbac";
import { classifyByDpd } from "../sbp";
import { assertCaseAccess } from "../scope";
import { storeFile } from "../storage";
import { generateDocument, notifyNextSigner, OFFER_DOCS } from "./documents";
import { customerUsers, notify, usersForRoles } from "./notify";

/** Second pair of eyes for payments. */
export const DISBURSEMENT_CHECKERS = ["OPERATIONS", "UNIT_HEAD", "REGIONAL_HEAD"];

export function caseShape(c: FinancingCase) {
  return {
    amount: c.amount,
    tenorMonths: c.tenorMonths,
    profitRate: c.profitRate,
    repayment: c.repayment,
    securityType: c.securityType,
    structure: JSON.parse(c.structure || "{}") as Record<string, string>,
  };
}

export const stepSpec = (s: Pick<ExecutionStep, "config">) => JSON.parse(s.config) as StepSpec;

export async function instantiateSteps(tx: Tx, c: FinancingCase) {
  const plan = buildExecutionPlan(getProduct(c.productCode), caseShape(c));
  await tx.executionStep.deleteMany({ where: { caseId: c.id, status: "LOCKED" } });
  for (const [i, st] of plan.entries()) {
    await tx.executionStep.upsert({
      where: { caseId_key: { caseId: c.id, key: st.key } },
      create: { caseId: c.id, key: st.key, seq: i + 1, title: st.title, kind: st.kind, config: JSON.stringify(st) },
      update: {},
    });
  }
}

/** Unlocks steps whose dependencies are done; generates documents for SIGN steps. */
export async function refreshSteps(tx: Tx, actor: Actor, caseId: string) {
  const kase = await tx.financingCase.findUniqueOrThrow({ where: { id: caseId } });
  if (kase.stage !== "EXECUTION") return;
  const steps = await tx.executionStep.findMany({ where: { caseId }, orderBy: { seq: "asc" } });
  const done = new Set(steps.filter((s) => s.status === "DONE").map((s) => s.key));
  for (const st of steps) {
    if (st.status !== "LOCKED") continue;
    const spec = stepSpec(st);
    if (!spec.dependsOn.every((d) => done.has(d))) continue;
    await tx.executionStep.update({ where: { id: st.id }, data: { status: "READY" } });
    await announceStep(tx, actor, kase, st, spec);
  }
}

async function announceStep(tx: Tx, actor: Actor, kase: FinancingCase, st: ExecutionStep, spec: StepSpec) {
  const link = `/cases/${kase.id}?tab=execution`;
  if (spec.kind === "SIGN" && spec.docCode) {
    const existing = await tx.document.findFirst({ where: { caseId: kase.id, stepKey: st.key, status: { in: ["ISSUED", "EXECUTED"] } } });
    const doc = existing ?? (await generateDocument(tx, actor, kase, spec.docCode, st.key));
    const plan = JSON.parse(doc.signerPlan) as SignerSlot[];
    await notifyNextSigner(tx, kase, doc, plan[0]);
  } else if (spec.kind === "EVIDENCE" && spec.evidence) {
    const bankRoles = spec.evidence.capturers.filter((r) => !isCustomerRole(r));
    const bank = await usersForRoles(tx, kase.tenantId, bankRoles, kase.orgPath);
    const cust = spec.evidence.capturers.some(isCustomerRole) ? await customerUsers(tx, kase.customerId, spec.evidence.capturers.filter(isCustomerRole)) : [];
    await notify(tx, kase.tenantId, [...bank.map((u) => u.id), ...cust.map((u) => u.id)], "Evidence required", st.title, link);
  } else if (spec.kind === "ACTION" && spec.action) {
    const users = await usersForRoles(tx, kase.tenantId, spec.action.roles, kase.orgPath);
    await notify(tx, kase.tenantId, users.map((u) => u.id), "Action required", st.title, link);
  } else if (spec.kind === "CHECK" && spec.check) {
    const users = await usersForRoles(tx, kase.tenantId, spec.check.roles, kase.orgPath);
    await notify(tx, kase.tenantId, users.map((u) => u.id), "Shariah check required", st.title, link);
  }
}

async function markDone(tx: Tx, actor: Actor, kase: FinancingCase, st: ExecutionStep, outcome: Record<string, unknown>) {
  await tx.executionStep.update({
    where: { id: st.id },
    data: { status: "DONE", completedById: actor.userId, completedAt: new Date(), outcome: JSON.stringify(outcome) },
  });
  await audit(tx, actor, {
    eventType: "STEP_COMPLETED",
    action: "COMPLETE",
    summary: `Execution step completed: ${st.title}`,
    caseId: kase.id,
    customerId: kase.customerId,
    entityType: "ExecutionStep",
    entityId: st.id,
    after: outcome,
  });
  await refreshSteps(tx, actor, kase.id);
}

/** Called (inside the signing transaction) when a document's last signature lands. */
export async function afterDocumentExecuted(tx: Tx, actor: Actor, kase: FinancingCase, doc: Document) {
  if (OFFER_DOCS.includes(doc.code)) {
    const offerDocs = await tx.document.findMany({ where: { caseId: kase.id, code: { in: OFFER_DOCS }, status: "EXECUTED" } });
    const codes = new Set(offerDocs.map((d) => d.code));
    if (OFFER_DOCS.every((c) => codes.has(c)) && kase.stage === "OFFERED") {
      await tx.financingCase.update({ where: { id: kase.id }, data: { stage: "EXECUTION", acceptedAt: new Date() } });
      await audit(tx, actor, {
        eventType: "OFFER_ACCEPTED",
        action: "ACCEPT",
        summary: "Customer accepted the offer and acknowledged the Key Fact Statement — execution started",
        caseId: kase.id,
        customerId: kase.customerId,
        entityType: "FinancingCase",
        entityId: kase.id,
        before: { stage: "OFFERED" },
        after: { stage: "EXECUTION" },
      });
      await notify(tx, kase.tenantId, [kase.rmId], "Offer accepted", `${kase.ref} moved to execution.`, `/cases/${kase.id}?tab=execution`);
      await refreshSteps(tx, actor, kase.id);
    }
    return;
  }
  if (!doc.stepKey) return;
  const st = await tx.executionStep.findUnique({ where: { caseId_key: { caseId: kase.id, key: doc.stepKey } } });
  if (st && st.status === "READY") await markDone(tx, actor, kase, st, { documentId: doc.id, docHash: doc.contentHash });
}

async function loadStep(tx: Tx, actor: Actor, stepId: string) {
  const st = await tx.executionStep.findUnique({ where: { id: stepId }, include: { case: true } });
  if (!st || st.case.tenantId !== actor.tenantId) throw new AccessError("Step not found.");
  assertCaseAccess(actor, st.case);
  if (st.case.stage !== "EXECUTION") throw new RuleError("The case is not in execution.");
  if (st.status !== "READY") throw new RuleError(st.status === "DONE" ? "This step is already complete." : "Preceding steps must be completed first.");
  return { st, kase: st.case, spec: stepSpec(st) };
}

// --- ACTION steps ---------------------------------------------------------------

export async function completeAction(actor: Actor, stepId: string, fields: Record<string, string>, authorise = false) {
  await db.$transaction(async (tx) => {
    const { st, kase, spec } = await loadStep(tx, actor, stepId);
    if (spec.kind !== "ACTION" || !spec.action) throw new RuleError("Not an action step.");
    const outcome = JSON.parse(st.outcome || "{}") as Record<string, unknown>;

    if (spec.action.effect === "DISBURSE" && outcome.pendingAuthorisation) {
      // checker leg
      if (!authorise) throw new RuleError("This payment is awaiting authorisation by a second officer.");
      if (!DISBURSEMENT_CHECKERS.includes(actor.role)) throw new AccessError("Only Operations / Unit Head / Regional Head can authorise payments.");
      if (outcome.makerId === actor.userId) throw new RuleError("Maker-checker: the officer who initiated the payment cannot authorise it.");
      await audit(tx, actor, {
        eventType: "DISBURSEMENT_AUTHORISED",
        action: "APPROVE",
        summary: `Payment authorised: ${st.title} — PKR ${Number(outcome.amount).toLocaleString("en-PK")} to ${outcome.payee}`,
        caseId: kase.id,
        customerId: kase.customerId,
        entityType: "ExecutionStep",
        entityId: st.id,
        after: outcome,
      });
      await markDone(tx, actor, kase, st, { ...outcome, pendingAuthorisation: false, checkerId: actor.userId, authorisedAt: new Date().toISOString() });
      return;
    }

    if (!spec.action.roles.includes(actor.role as never)) throw new AccessError(`Only ${spec.action.roles.join(" / ")} can complete this step.`);
    const values: Record<string, unknown> = {};
    for (const f of spec.action.fields) {
      const v = (fields[f.name] ?? "").trim();
      if (!v) throw new RuleError(`${f.label} is required.`);
      values[f.name] = f.type === "number" ? Number(v) : v;
      if (f.type === "number" && !(Number(v) > 0)) throw new RuleError(`${f.label} must be a positive number.`);
    }

    if (spec.action.effect === "DISBURSE") {
      const shape = caseShape(kase);
      const cap = kase.productCode === "DIMINISHING_MUSHARAKAH" ? Number(shape.structure.totalAssetValue) || kase.amount : kase.amount;
      const prior = await tx.executionStep.findMany({ where: { caseId: kase.id, status: "DONE" } });
      const disbursed = prior
        .filter((p) => stepSpec(p).action?.effect === "DISBURSE")
        .reduce((s, p) => s + (Number((JSON.parse(p.outcome) as { amount?: number }).amount) || 0), 0);
      if (disbursed + Number(values.amount) > cap + 0.01) throw new RuleError(`Payment exceeds the sanctioned amount (already disbursed PKR ${disbursed.toLocaleString("en-PK")}).`);
      const pending = { ...values, pendingAuthorisation: true, makerId: actor.userId, initiatedAt: new Date().toISOString() };
      await tx.executionStep.update({ where: { id: st.id }, data: { outcome: JSON.stringify(pending) } });
      await audit(tx, actor, {
        eventType: "DISBURSEMENT_INITIATED",
        action: "CREATE",
        summary: `Payment initiated: ${st.title} — PKR ${Number(values.amount).toLocaleString("en-PK")} to ${values.payee}`,
        caseId: kase.id,
        customerId: kase.customerId,
        entityType: "ExecutionStep",
        entityId: st.id,
        after: pending,
      });
      const checkers = await usersForRoles(tx, kase.tenantId, DISBURSEMENT_CHECKERS, kase.orgPath);
      await notify(tx, kase.tenantId, checkers.filter((u) => u.id !== actor.userId).map((u) => u.id), "Payment authorisation required", st.title, `/cases/${kase.id}?tab=execution`);
      return;
    }

    if (spec.action.effect === "ACTIVATE") {
      const remaining = await tx.executionStep.count({ where: { caseId: kase.id, status: { not: "DONE" }, id: { not: st.id } } });
      if (remaining) throw new RuleError("All other execution steps must be completed before activation.");
      const product = getProduct(kase.productCode);
      const activatedAt = new Date();
      const sched = buildSchedule({ model: product.pricing, amount: kase.amount, tenorMonths: kase.tenorMonths, profitRate: kase.profitRate, repayment: kase.repayment, startDate: activatedAt, structure: caseShape(kase).structure });
      await tx.installment.deleteMany({ where: { caseId: kase.id } });
      await tx.installment.createMany({ data: sched.lines.map((l) => ({ caseId: kase.id, ...l })) });
      await tx.financingCase.update({ where: { id: kase.id }, data: { stage: "ACTIVE", activatedAt } });
      await markDone(tx, actor, kase, st, values);
      await audit(tx, actor, {
        eventType: "FACILITY_ACTIVATED",
        action: "ACTIVATE",
        summary: `Facility activated; ${sched.instalments} instalment(s), total payable PKR ${sched.totalPayable.toLocaleString("en-PK")}`,
        caseId: kase.id,
        customerId: kase.customerId,
        entityType: "FinancingCase",
        entityId: kase.id,
        before: { stage: "EXECUTION" },
        after: { stage: "ACTIVE", cbsRef: values.cbsRef },
      });
      const cust = await customerUsers(tx, kase.customerId);
      await notify(tx, kase.tenantId, [kase.rmId, ...cust.map((u) => u.id)], "Facility activated", `${kase.ref} is now active.`, `/cases/${kase.id}?tab=schedule`);
      return;
    }

    await markDone(tx, actor, kase, st, values);
  });
}

// --- CHECK steps ------------------------------------------------------------------

export async function completeCheck(actor: Actor, stepId: string, ticked: string[], comments: string) {
  await db.$transaction(async (tx) => {
    const { st, kase, spec } = await loadStep(tx, actor, stepId);
    if (spec.kind !== "CHECK" || !spec.check) throw new RuleError("Not a check step.");
    if (!spec.check.roles.includes(actor.role as never)) throw new AccessError(`Only ${spec.check.roles.join(" / ")} can complete this check.`);
    const missing = spec.check.checklist.filter((c) => !ticked.includes(c));
    if (missing.length) throw new RuleError(`Confirm all items: ${missing.join("; ")}`);
    if (!comments.trim()) throw new RuleError("Comments / fatwa reference are required.");
    await markDone(tx, actor, kase, st, { checklist: spec.check.checklist, comments });
  });
}

// --- EVIDENCE steps -----------------------------------------------------------------

export const evidenceMeta = z.object({
  caseId: z.string().min(1),
  stepKey: z.string().optional(),
  category: z.string().min(1),
  description: z.string().trim().min(3, "Describe what the evidence shows"),
  assetRef: z.string().trim().optional().default(""),
  clientTime: z.string().optional().default(""),
  locationNote: z.string().trim().optional().default(""),
});

export async function submitEvidence(
  actor: Actor,
  meta: z.infer<typeof evidenceMeta>,
  file: { buffer: Buffer; name: string; type: string },
  stamped?: { buffer: Buffer; name: string; type: string },
) {
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirst({ where: { id: meta.caseId, tenantId: actor.tenantId } });
    if (!kase) throw new AccessError("Case not found.");
    assertCaseAccess(actor, kase);
    if (actor.role === "AUDITOR") throw new AccessError("Auditors have read-only access.");

    if (meta.stepKey) {
      const st = await tx.executionStep.findUnique({ where: { caseId_key: { caseId: kase.id, key: meta.stepKey } } });
      if (!st || kase.stage !== "EXECUTION") throw new RuleError("Evidence step is not open.");
      if (st.status !== "READY") throw new RuleError("Preceding steps must be completed before this evidence can be captured.");
      const spec = stepSpec(st).evidence!;
      if (!spec.capturers.includes(actor.role as never)) throw new AccessError("Your role cannot capture evidence for this step.");
      if (!spec.categories.includes(meta.category as never)) throw new RuleError(`Category must be one of: ${spec.categories.join(", ")}`);
      if (spec.requireGps && !actor.geo) throw new RuleError("Location (GPS) is mandatory for possession evidence. Enable location services and retry.");
    }

    const original = await storeFile(tx, { tenantId: actor.tenantId, uploadedById: actor.userId, buffer: file.buffer, originalName: file.name, mimeType: file.type });
    const stampedFile = stamped
      ? await storeFile(tx, { tenantId: actor.tenantId, uploadedById: actor.userId, buffer: stamped.buffer, originalName: stamped.name, mimeType: stamped.type })
      : null;
    const ev = await tx.evidence.create({
      data: {
        tenantId: actor.tenantId,
        caseId: kase.id,
        stepKey: meta.stepKey || null,
        category: meta.category,
        description: meta.description,
        assetRef: meta.assetRef,
        fileId: original.id,
        stampedFileId: stampedFile?.id,
        lat: actor.geo?.lat,
        lng: actor.geo?.lng,
        accuracy: actor.geo?.accuracy ?? undefined,
        locationNote: meta.locationNote,
        clientTime: meta.clientTime,
        device: JSON.stringify(actor.device ?? {}),
        ip: actor.ip ?? "",
        capturedById: actor.userId,
      },
    });
    await audit(tx, actor, {
      eventType: "EVIDENCE_CAPTURED",
      action: "UPLOAD",
      summary: `${meta.category} evidence uploaded: ${meta.description} (${file.name}, ${(file.buffer.length / 1024).toFixed(0)} KB)`,
      caseId: kase.id,
      customerId: kase.customerId,
      entityType: "Evidence",
      entityId: ev.id,
      docHash: original.sha256,
      after: { stepKey: meta.stepKey, category: meta.category, assetRef: meta.assetRef, mime: file.type, stampedSha256: stampedFile?.sha256, clientTime: meta.clientTime, device: actor.device },
    });
    if (meta.stepKey) {
      const st = await tx.executionStep.findUniqueOrThrow({ where: { caseId_key: { caseId: kase.id, key: meta.stepKey } } });
      const verifiers = await usersForRoles(tx, kase.tenantId, stepSpec(st).evidence!.verifiers, kase.orgPath);
      await notify(tx, kase.tenantId, verifiers.filter((u) => u.id !== actor.userId).map((u) => u.id), "Evidence to verify", st.title, `/cases/${kase.id}?tab=evidence`);
    }
    return ev;
  });
}

export async function verifyEvidence(actor: Actor, evidenceId: string, decision: "VERIFIED" | "REJECTED", remarks: string, checklist: string[] = []) {
  await db.$transaction(async (tx) => {
    const ev = await tx.evidence.findFirst({ where: { id: evidenceId, tenantId: actor.tenantId }, include: { case: true } });
    if (!ev) throw new AccessError("Evidence not found.");
    assertCaseAccess(actor, ev.case);
    if (ev.status !== "SUBMITTED") throw new RuleError("Evidence already reviewed.");
    if (ev.capturedById === actor.userId) throw new RuleError("Maker-checker: you cannot verify evidence you captured.");
    if (!remarks.trim()) throw new RuleError("Verification remarks are required.");

    let step: ExecutionStep | null = null;
    if (ev.stepKey) {
      step = await tx.executionStep.findUniqueOrThrow({ where: { caseId_key: { caseId: ev.caseId, key: ev.stepKey } } });
      const spec = stepSpec(step).evidence!;
      if (!spec.verifiers.includes(actor.role as never)) throw new AccessError(`Only ${spec.verifiers.join(" / ")} can verify this evidence.`);
    } else if (!["RCAD", "TRADE", "SHARIAH", "OPERATIONS", "LEGAL", "CREDIT_RISK"].includes(actor.role)) {
      throw new AccessError();
    }

    await tx.evidence.update({ where: { id: ev.id }, data: { status: decision, verifiedById: actor.userId, verifiedAt: new Date(), verifyRemarks: remarks } });
    await audit(tx, actor, {
      eventType: decision === "VERIFIED" ? "EVIDENCE_VERIFIED" : "EVIDENCE_REJECTED",
      action: decision === "VERIFIED" ? "APPROVE" : "RETURN",
      summary: `Evidence ${decision.toLowerCase()}: ${ev.description} — ${remarks}`,
      caseId: ev.caseId,
      customerId: ev.case.customerId,
      entityType: "Evidence",
      entityId: ev.id,
      after: { remarks, checklist },
    });

    if (step && step.status === "READY" && decision === "VERIFIED") {
      const spec = stepSpec(step).evidence!;
      const missing = spec.checklist.filter((c) => !checklist.includes(c));
      const verified = await tx.evidence.count({ where: { caseId: ev.caseId, stepKey: step.key, status: "VERIFIED" } });
      if (verified >= spec.minItems && missing.length === 0) {
        await markDone(tx, actor, ev.case, step, { verifiedItems: verified, checklist: spec.checklist, remarks });
      }
    }
  });
}

// --- Monitoring -------------------------------------------------------------------

export async function recordRepayment(actor: Actor, installmentId: string, amount: number, reference: string) {
  await db.$transaction(async (tx) => {
    if (actor.role !== "OPERATIONS") throw new AccessError("Only Operations can post repayments.");
    const inst = await tx.installment.findUnique({ where: { id: installmentId }, include: { case: true } });
    if (!inst || inst.case.tenantId !== actor.tenantId) throw new AccessError("Instalment not found.");
    if (inst.case.stage !== "ACTIVE") throw new RuleError("Facility is not active.");
    if (!(amount > 0)) throw new RuleError("Amount must be positive.");
    if (!reference.trim()) throw new RuleError("Payment reference is required.");
    const paid = Math.min(inst.total, inst.paidAmount + amount);
    const status = paid >= inst.total - 0.01 ? "PAID" : inst.status;
    await tx.installment.update({ where: { id: inst.id }, data: { paidAmount: paid, paidAt: new Date(), status } });
    await audit(tx, actor, {
      eventType: "REPAYMENT_POSTED",
      action: "UPDATE",
      summary: `Instalment #${inst.seq} — PKR ${amount.toLocaleString("en-PK")} received (ref ${reference})`,
      caseId: inst.caseId,
      customerId: inst.case.customerId,
      entityType: "Installment",
      entityId: inst.id,
      before: { paidAmount: inst.paidAmount, status: inst.status },
      after: { paidAmount: paid, status, reference },
    });
    const open = await tx.installment.count({ where: { caseId: inst.caseId, status: { not: "PAID" } } });
    if (open === 0) {
      await tx.financingCase.update({ where: { id: inst.caseId }, data: { stage: "CLOSED", closedAt: new Date(), daysPastDue: 0, classification: "REGULAR" } });
      await audit(tx, actor, { eventType: "FACILITY_CLOSED", action: "CLOSE", summary: "All instalments settled — facility closed", caseId: inst.caseId, customerId: inst.case.customerId, entityType: "FinancingCase", entityId: inst.caseId, after: { stage: "CLOSED" } });
      const cust = await customerUsers(tx, inst.case.customerId);
      await notify(tx, actor.tenantId, [inst.case.rmId, ...cust.map((u) => u.id)], "Facility closed", `${inst.case.ref} fully settled.`, `/cases/${inst.caseId}`);
    }
  });
}

/** Updates days-past-due (normally fed from core banking) and re-classifies per Annexure I. */
export async function updateDaysPastDue(actor: Actor, caseId: string, dpd: number) {
  await db.$transaction(async (tx) => {
    if (!["OPERATIONS", "CREDIT_RISK"].includes(actor.role)) throw new AccessError();
    const kase = await tx.financingCase.findFirst({ where: { id: caseId, tenantId: actor.tenantId } });
    if (!kase || kase.stage !== "ACTIVE") throw new RuleError("Facility is not active.");
    const classification = classifyByDpd(Math.max(0, Math.round(dpd)));
    await tx.financingCase.update({ where: { id: caseId }, data: { daysPastDue: Math.max(0, Math.round(dpd)), classification } });
    await audit(tx, actor, {
      eventType: "CLASSIFICATION_UPDATED",
      action: "UPDATE",
      summary: `DPD ${dpd} → ${classification} (SME PR R-17 / Annexure I)`,
      caseId,
      customerId: kase.customerId,
      entityType: "FinancingCase",
      entityId: caseId,
      before: { daysPastDue: kase.daysPastDue, classification: kase.classification },
      after: { daysPastDue: dpd, classification },
    });
  });
}

export function docTitle(productCode: string, code: string) {
  return docSpec(getProduct(productCode), code).title;
}
