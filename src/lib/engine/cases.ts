// Financing case lifecycle: draft → submission (CPTM ack, TAT clock) →
// parallel clearances → delegated-authority approvals → sanction → offer.
import type { FinancingCase } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "../actor";
import { audit } from "../audit";
import { EXPOSURE_STAGES, TRACK_CHECKLISTS } from "../constants";
import { db, type Tx } from "../db";
import { getProduct } from "../products/catalog";
import { AccessError, RuleError, TRACK_ROLE, can, roleLabel, type Track } from "../rbac";
import { addWorkingDays, runRegulatoryChecks, type SmeCategory } from "../sbp";
import { assertCaseAccess, canSeeCase, customerScope } from "../scope";
import { approvalChain, parseSettings } from "../tenant";
import { generateDocument } from "./documents";
import { caseShape, instantiateSteps } from "./execution";
import { customerUsers, notify, usersForRoles } from "./notify";

export const caseInput = z.object({
  customerId: z.string().min(1),
  productCode: z.string().min(1),
  purpose: z.string().trim().min(5),
  amount: z.coerce.number().positive(),
  tenorMonths: z.coerce.number().int().min(1).max(120),
  profitRate: z.coerce.number().min(0).max(60),
  benchmark: z.string().trim().default("6M KIBOR"),
  repayment: z.enum(["MONTHLY", "QUARTERLY", "BULLET"]),
  securityType: z.enum(["SECURED", "CLEAN"]),
  collateral: z.string().trim().default(""),
  liquidLien: z.coerce.number().min(0).default(0),
  ecibJustification: z.string().trim().default(""),
  structure: z.record(z.string()).default({}),
});
export type CaseInput = z.infer<typeof caseInput>;

function validateProductTerms(input: CaseInput) {
  const product = getProduct(input.productCode);
  if (!product.repaymentOptions.includes(input.repayment)) throw new RuleError(`${product.name} supports repayment: ${product.repaymentOptions.join(", ")}.`);
  if (input.tenorMonths > product.maxTenorMonths) throw new RuleError(`${product.name} maximum tenor is ${product.maxTenorMonths} months.`);
  for (const f of product.fields) {
    if (f.required && !(input.structure[f.name] ?? "").toString().trim()) throw new RuleError(`${f.label} is required.`);
  }
  return product;
}

export async function createCase(actor: Actor, raw: unknown) {
  if (!can(actor.role, "case.create")) throw new AccessError("Only Relationship Managers initiate financing requests.");
  const input = caseInput.parse(raw);
  const product = validateProductTerms(input);
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { ...customerScope(actor), id: input.customerId } });
    if (!customer) throw new AccessError("Customer is not in your portfolio.");
    const year = new Date().getFullYear();
    const count = await tx.financingCase.count({ where: { tenantId: actor.tenantId } });
    const ref = `SME-${year}-${String(count + 1).padStart(5, "0")}`;
    const kase = await tx.financingCase.create({
      data: {
        tenantId: actor.tenantId,
        ref,
        customerId: customer.id,
        productCode: product.code,
        purpose: input.purpose,
        amount: input.amount,
        tenorMonths: input.tenorMonths,
        profitRate: input.profitRate,
        benchmark: input.benchmark,
        repayment: input.repayment,
        securityType: input.securityType,
        collateral: input.collateral,
        liquidLien: input.liquidLien,
        ecibJustification: input.ecibJustification,
        structure: JSON.stringify(input.structure),
        rmId: actor.userId,
        orgUnitId: customer.orgUnitId,
        orgPath: customer.orgPath,
      },
    });
    await audit(tx, actor, {
      eventType: "CASE_CREATED",
      action: "CREATE",
      summary: `${product.name} request ${ref} for ${customer.legalName}: PKR ${input.amount.toLocaleString("en-PK")}`,
      caseId: kase.id,
      customerId: customer.id,
      entityType: "FinancingCase",
      entityId: kase.id,
      after: input,
    });
    return kase;
  });
}

export async function updateDraft(actor: Actor, caseId: string, raw: unknown) {
  const input = caseInput.parse(raw);
  validateProductTerms(input);
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirstOrThrow({ where: { id: caseId, tenantId: actor.tenantId } });
    if (kase.rmId !== actor.userId) throw new AccessError("Only the case RM can edit the request.");
    if (!["DRAFT", "RETURNED"].includes(kase.stage)) throw new RuleError("Only draft or returned requests can be edited.");
    if (input.customerId !== kase.customerId || input.productCode !== kase.productCode) throw new RuleError("Customer and product cannot be changed; create a new request.");
    const data = {
      purpose: input.purpose,
      amount: input.amount,
      tenorMonths: input.tenorMonths,
      profitRate: input.profitRate,
      benchmark: input.benchmark,
      repayment: input.repayment,
      securityType: input.securityType,
      collateral: input.collateral,
      liquidLien: input.liquidLien,
      ecibJustification: input.ecibJustification,
      structure: JSON.stringify(input.structure),
    };
    await tx.financingCase.update({ where: { id: caseId }, data });
    await audit(tx, actor, {
      eventType: "CASE_UPDATED",
      action: "UPDATE",
      summary: `Request ${kase.ref} amended`,
      caseId,
      customerId: kase.customerId,
      entityType: "FinancingCase",
      entityId: caseId,
      before: { purpose: kase.purpose, amount: kase.amount, tenorMonths: kase.tenorMonths, profitRate: kase.profitRate, repayment: kase.repayment, securityType: kase.securityType, collateral: kase.collateral, structure: kase.structure },
      after: data,
    });
  });
}

/** Regulatory (SBP SME PRs) + Shariah product preconditions for a case. */
export async function evaluateCompliance(tx: Tx, kase: FinancingCase) {
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: kase.customerId } });
  const others = await tx.financingCase.findMany({
    where: { customerId: kase.customerId, id: { not: kase.id }, stage: { in: EXPOSURE_STAGES } },
    select: { amount: true, securityType: true },
  });
  const product = getProduct(kase.productCode);
  const regulatory = runRegulatoryChecks({
    smeCategory: customer.smeCategory as SmeCategory,
    requested: kase.amount,
    securityType: kase.securityType as "SECURED" | "CLEAN",
    liquidLien: kase.liquidLien,
    existingBankExposure: others.reduce((s, o) => s + o.amount, 0),
    existingCleanExposure: others.filter((o) => o.securityType === "CLEAN").reduce((s, o) => s + o.amount, 0),
    otherBankExposure: customer.otherBankExposure,
    relatedParty: customer.relatedParty,
    ecibCheckedAt: customer.ecibCheckedAt,
    ecibOverdue: customer.ecibOverdue,
    ecibJustification: kase.ecibJustification,
    collateral: kase.collateral,
    kycStatus: customer.kycStatus,
    sector: customer.sector,
  });
  const shariah = product.preconditions(caseShape(kase));
  const blocking = regulatory.some((c) => c.status === "FAIL") || shariah.length > 0;
  return { regulatory, shariah, blocking, customer, product };
}

export async function submitCase(actor: Actor, caseId: string) {
  if (!can(actor.role, "case.submit")) throw new AccessError();
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirstOrThrow({ where: { id: caseId, tenantId: actor.tenantId } });
    if (kase.rmId !== actor.userId) throw new AccessError("Only the case RM can submit.");
    if (!["DRAFT", "RETURNED"].includes(kase.stage)) throw new RuleError("Case is not in draft.");
    const { regulatory, shariah, blocking, customer, product } = await evaluateCompliance(tx, kase);
    if (blocking) {
      const reasons = [...regulatory.filter((c) => c.status === "FAIL").map((c) => `${c.rule}: ${c.detail}`), ...shariah.map((s) => `Shariah: ${s}`)];
      throw new RuleError(`Submission blocked — ${reasons.join(" | ")}`);
    }
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
    const settings = parseSettings(tenant.settings);
    const now = new Date();
    const first = !kase.cptmNo;
    const cptmNo = kase.cptmNo ?? `CPTM-${tenant.code}-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${kase.ref.slice(-5)}`;

    // RCAD always reviews; other tracks per the bank's settings (Trade only for trade-based modes).
    const tracks = (["RCAD", ...settings.reviewTracks] as Track[]).filter((t, i, all) => all.indexOf(t) === i && (t !== "TRADE" || product.requiresTrade));
    for (const track of tracks) {
      await tx.clearance.upsert({
        where: { caseId_track: { caseId, track } },
        create: { caseId, track },
        update: { status: "PENDING", decidedById: null, decidedAt: null, comments: "", checklist: "{}", round: { increment: 1 } },
      });
    }
    await tx.approval.updateMany({ where: { caseId, status: "PENDING" }, data: { status: "SUPERSEDED" } });
    await tx.financingCase.update({
      where: { id: caseId },
      data: {
        stage: "UNDER_REVIEW",
        cptmNo,
        submittedAt: first ? now : kase.submittedAt,
        tatDueAt: first ? addWorkingDays(now, settings.tatWorkingDays, settings.publicHolidays) : kase.tatDueAt,
      },
    });
    await audit(tx, actor, {
      eventType: first ? "CASE_SUBMITTED" : "CASE_RESUBMITTED",
      action: "SUBMIT",
      summary: `${kase.ref} ${first ? "submitted" : "resubmitted"}; CPTM ${cptmNo}; tracks: ${tracks.join(", ")}`,
      caseId,
      customerId: kase.customerId,
      entityType: "FinancingCase",
      entityId: caseId,
      before: { stage: kase.stage },
      after: { stage: "UNDER_REVIEW", cptmNo, compliance: regulatory.map((c) => `${c.code}:${c.status}`) },
    });
    const reviewers = await usersForRoles(tx, actor.tenantId, tracks.map((t) => TRACK_ROLE[t]), kase);
    await notify(tx, actor.tenantId, reviewers.map((u) => u.id), "Clearance required", `${kase.ref} — ${product.name} for ${customer.legalName}`, `/cases/${caseId}?tab=clearances`);
    // SME PR R-19: automatic acknowledgement & status to the applicant
    const cust = await customerUsers(tx, kase.customerId);
    await notify(tx, actor.tenantId, cust.map((u) => u.id), `Application acknowledged — ${cptmNo}`, `Your ${product.name} application ${kase.ref} has been received and is under review.`, `/cases/${caseId}`);
  });
}

export const clearanceInput = z.object({
  decision: z.enum(["CLEARED", "RETURNED"]),
  checklist: z.array(z.string()).default([]),
  riskRating: z.string().trim().default(""),
  comments: z.string().trim().min(3, "Comments are required"),
});

export async function decideClearance(actor: Actor, caseId: string, track: Track, raw: unknown) {
  const input = clearanceInput.parse(raw);
  if (actor.role !== TRACK_ROLE[track]) throw new AccessError(`Only ${roleLabel(TRACK_ROLE[track])} can decide the ${track} track.`);
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirstOrThrow({ where: { id: caseId, tenantId: actor.tenantId } });
    assertCaseAccess(actor, kase);
    if (kase.stage !== "UNDER_REVIEW") throw new RuleError("Case is not under review.");
    const cl = await tx.clearance.findUnique({ where: { caseId_track: { caseId, track } } });
    if (!cl || cl.status !== "PENDING") throw new RuleError("This clearance is not pending.");

    if (input.decision === "CLEARED") {
      const missing = TRACK_CHECKLISTS[track].filter((c) => !input.checklist.includes(c));
      if (missing.length) throw new RuleError(`Confirm all checklist items: ${missing.join("; ")}`);
      if (track === "CREDIT" && !input.riskRating) throw new RuleError("Assign an internal risk rating.");
      if (track === "RCAD") {
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: kase.customerId } });
        if (customer.kycStatus !== "CLEARED") throw new RuleError("Customer KYC/CDD must be cleared first.");
        if (!customer.ecibCheckedAt) throw new RuleError("Latest e-CIB report must be obtained (SME PR R-7).");
        if (customer.ecibOverdue && !kase.ecibJustification.trim()) throw new RuleError("e-CIB shows overdues — RM must document the justification (R-7).");
      }
      const { blocking } = await evaluateCompliance(tx, kase);
      if (blocking) throw new RuleError("Regulatory or Shariah checks are failing — return the case to the RM.");
    }

    await tx.clearance.update({
      where: { id: cl.id },
      data: {
        status: input.decision,
        checklist: JSON.stringify(Object.fromEntries(TRACK_CHECKLISTS[track].map((c) => [c, input.checklist.includes(c)]))),
        riskRating: input.riskRating,
        comments: input.comments,
        decidedById: actor.userId,
        decidedAt: new Date(),
      },
    });
    await audit(tx, actor, {
      eventType: "CLEARANCE_DECISION",
      action: input.decision === "CLEARED" ? "APPROVE" : "RETURN",
      summary: `${track} ${input.decision.toLowerCase()} for ${kase.ref}${input.riskRating ? ` — rating ${input.riskRating}` : ""}: ${input.comments}`,
      caseId,
      customerId: kase.customerId,
      entityType: "Clearance",
      entityId: cl.id,
      after: input,
    });

    if (input.decision === "RETURNED") {
      await tx.financingCase.update({ where: { id: caseId }, data: { stage: "RETURNED" } });
      await notify(tx, actor.tenantId, [kase.rmId], `${track} returned ${kase.ref}`, input.comments, `/cases/${caseId}`);
      return;
    }

    const pending = await tx.clearance.count({ where: { caseId, status: { not: "CLEARED" } } });
    if (pending === 0) await openApprovals(tx, actor, kase);
  });
}

async function openApprovals(tx: Tx, actor: Actor, kase: FinancingCase) {
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: kase.tenantId } });
  const chain = approvalChain(parseSettings(tenant.settings), kase.amount, kase.securityType === "CLEAN");
  const round = (await tx.approval.aggregate({ where: { caseId: kase.id }, _max: { round: true } }))._max.round ?? 0;
  for (const [i, lvl] of chain.entries()) {
    await tx.approval.create({ data: { caseId: kase.id, level: i + 1, role: lvl.role, action: lvl.action, limit: lvl.limit, round: round + 1 } });
  }
  await tx.financingCase.update({ where: { id: kase.id }, data: { stage: "PENDING_APPROVAL" } });
  await audit(tx, actor, {
    eventType: "APPROVAL_CHAIN_OPENED",
    action: "ROUTE",
    summary: `All clearances obtained; routed for approval: ${chain.map((c) => `${roleLabel(c.role)} (${c.action.toLowerCase()})`).join(" → ")}`,
    caseId: kase.id,
    customerId: kase.customerId,
    entityType: "FinancingCase",
    entityId: kase.id,
    before: { stage: "UNDER_REVIEW" },
    after: { stage: "PENDING_APPROVAL", chain },
  });
  const users = await usersForRoles(tx, kase.tenantId, [chain[0].role], kase);
  await notify(tx, kase.tenantId, users.map((u) => u.id), "Approval required", `${kase.ref} awaits your ${chain[0].action.toLowerCase()}.`, `/cases/${kase.id}?tab=approvals`);
}

export const approvalInput = z.object({
  decision: z.enum(["APPROVE", "RETURN", "REJECT"]),
  comments: z.string().trim().min(3, "Comments are required"),
});

export async function decideApproval(actor: Actor, caseId: string, raw: unknown) {
  const input = approvalInput.parse(raw);
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirstOrThrow({ where: { id: caseId, tenantId: actor.tenantId } });
    if (kase.stage !== "PENDING_APPROVAL") throw new RuleError("Case is not pending approval.");
    const current = await tx.approval.findFirst({ where: { caseId, status: "PENDING" }, orderBy: [{ round: "desc" }, { level: "asc" }] });
    if (!current) throw new RuleError("No pending approval level.");
    if (actor.role !== current.role) throw new AccessError(`This level requires ${roleLabel(current.role)}.`);
    if (!canSeeCase(actor, kase)) throw new AccessError("Case is outside your delegated area.");
    if (actor.userId === kase.rmId) throw new RuleError("Maker-checker: the initiating RM cannot approve.");
    const priorByMe = await tx.approval.count({ where: { caseId, round: current.round, decidedById: actor.userId } });
    if (priorByMe) throw new RuleError("Segregation of duties: you have already decided a level on this case.");
    if (input.decision === "APPROVE" && current.action === "APPROVE" && actor.approvalLimit != null && kase.amount > actor.approvalLimit) {
      throw new RuleError(`Amount exceeds your personal approval limit of PKR ${actor.approvalLimit.toLocaleString("en-PK")}.`);
    }

    const status = input.decision === "APPROVE" ? "APPROVED" : input.decision === "RETURN" ? "RETURNED" : "REJECTED";
    await tx.approval.update({ where: { id: current.id }, data: { status, decidedById: actor.userId, decidedAt: new Date(), comments: input.comments } });
    await audit(tx, actor, {
      eventType: "APPROVAL_DECISION",
      action: input.decision === "APPROVE" ? "APPROVE" : input.decision,
      summary: `Level ${current.level} ${roleLabel(current.role)} ${input.decision === "APPROVE" ? (current.action === "RECOMMEND" ? "recommended" : "approved") : status.toLowerCase()} ${kase.ref}: ${input.comments}`,
      caseId,
      customerId: kase.customerId,
      entityType: "Approval",
      entityId: current.id,
      after: { level: current.level, role: current.role, action: current.action, limit: current.limit, decision: input.decision, comments: input.comments },
    });

    if (input.decision === "RETURN") {
      await tx.approval.updateMany({ where: { caseId, status: "PENDING" }, data: { status: "SUPERSEDED" } });
      await tx.financingCase.update({ where: { id: caseId }, data: { stage: "RETURNED" } });
      await notify(tx, actor.tenantId, [kase.rmId], `${kase.ref} returned`, input.comments, `/cases/${caseId}`);
      return;
    }
    if (input.decision === "REJECT") {
      await tx.approval.updateMany({ where: { caseId, status: "PENDING" }, data: { status: "SUPERSEDED" } });
      await tx.financingCase.update({ where: { id: caseId }, data: { stage: "REJECTED" } });
      const cust = await customerUsers(tx, kase.customerId);
      await notify(tx, actor.tenantId, [kase.rmId, ...cust.map((u) => u.id)], `${kase.ref} declined by the bank`, input.comments, `/cases/${caseId}`);
      return;
    }

    const next = await tx.approval.findFirst({ where: { caseId, status: "PENDING", round: current.round }, orderBy: { level: "asc" } });
    if (next) {
      const users = await usersForRoles(tx, kase.tenantId, [next.role], kase);
      await notify(tx, kase.tenantId, users.map((u) => u.id), "Approval required", `${kase.ref} awaits your ${next.action.toLowerCase()}.`, `/cases/${caseId}?tab=approvals`);
      return;
    }

    // Final approval → sanction
    const sanctioned = await tx.financingCase.update({ where: { id: caseId }, data: { stage: "SANCTIONED", sanctionedAt: new Date() } });
    await audit(tx, actor, {
      eventType: "CASE_SANCTIONED",
      action: "APPROVE",
      summary: `${kase.ref} sanctioned by ${roleLabel(current.role)}`,
      caseId,
      customerId: kase.customerId,
      entityType: "FinancingCase",
      entityId: caseId,
      before: { stage: "PENDING_APPROVAL" },
      after: { stage: "SANCTIONED" },
    });
    await tx.document.updateMany({ where: { caseId, code: { in: ["OFFER_LETTER", "KFS"] }, status: "ISSUED" }, data: { status: "VOID" } });
    const offer = await generateDocument(tx, actor, sanctioned, "OFFER_LETTER");
    await generateDocument(tx, actor, sanctioned, "KFS");
    await instantiateSteps(tx, sanctioned);
    const rcad = await usersForRoles(tx, kase.tenantId, ["RCAD"], kase);
    await notify(tx, kase.tenantId, [kase.rmId, ...rcad.map((u) => u.id)], "Sanctioned — prepare offer documentation", kase.ref, `/documents/${offer.id}`);
  });
}

export async function addComment(actor: Actor, caseId: string, body: string, internal: boolean) {
  if (!body.trim()) throw new RuleError("Comment cannot be empty.");
  if (actor.role === "AUDITOR") throw new AccessError("Auditors have read-only access.");
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirstOrThrow({ where: { id: caseId, tenantId: actor.tenantId } });
    assertCaseAccess(actor, kase);
    const isInternal = actor.kind === "CUSTOMER" ? false : internal;
    const c = await tx.caseComment.create({ data: { caseId, authorId: actor.userId, body: body.trim(), internal: isInternal } });
    await audit(tx, actor, { eventType: "COMMENT_ADDED", action: "CREATE", summary: `${isInternal ? "Internal" : "Customer-visible"} comment on ${kase.ref}`, caseId, customerId: kase.customerId, entityType: "CaseComment", entityId: c.id, after: { body: body.trim() } });
    if (actor.kind === "CUSTOMER") await notify(tx, actor.tenantId, [kase.rmId], `Customer message on ${kase.ref}`, body.slice(0, 140), `/cases/${caseId}`);
    else if (!isInternal) {
      const cust = await customerUsers(tx, kase.customerId);
      await notify(tx, actor.tenantId, cust.map((u) => u.id), `Message from your bank on ${kase.ref}`, body.slice(0, 140), `/cases/${caseId}`);
    }
  });
}

export async function cancelCase(actor: Actor, caseId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const kase = await tx.financingCase.findFirstOrThrow({ where: { id: caseId, tenantId: actor.tenantId } });
    if (kase.rmId !== actor.userId) throw new AccessError("Only the case RM can cancel.");
    if (!["DRAFT", "RETURNED"].includes(kase.stage)) throw new RuleError("Only draft or returned cases can be cancelled.");
    if (!reason.trim()) throw new RuleError("A reason is required.");
    await tx.financingCase.update({ where: { id: caseId }, data: { stage: "CANCELLED" } });
    await audit(tx, actor, { eventType: "CASE_CANCELLED", action: "CANCEL", summary: `${kase.ref} cancelled: ${reason}`, caseId, customerId: kase.customerId, entityType: "FinancingCase", entityId: caseId, before: { stage: kase.stage }, after: { stage: "CANCELLED" } });
  });
}
