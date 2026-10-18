"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { addComment, cancelCase, createCase, decideApproval, decideClearance, issueOffer, submitCase, updateDraft } from "@/lib/engine/cases";
import { createCustomer, createCustomerUser, recordKyc } from "@/lib/engine/customers";
import { requestSigningOtp, signDocument } from "@/lib/engine/documents";
import { completeAction, completeCheck, recordRepayment, updateDaysPastDue, verifyEvidence } from "@/lib/engine/execution";
import { AccessError, RuleError, type Track } from "@/lib/rbac";
import { all, run, str } from "./run";

// --- Customers -------------------------------------------------------------------

function parseCustomer(fd: FormData) {
  const people: Record<string, string>[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^people\.(\d+)\.(\w+)$/.exec(k);
    if (!m) continue;
    const i = Number(m[1]);
    people[i] ??= {};
    people[i][m[2]] = String(v).trim();
  }
  return {
    legalName: str(fd, "legalName"),
    tradeName: str(fd, "tradeName"),
    legalForm: str(fd, "legalForm"),
    ntn: str(fd, "ntn"),
    strn: str(fd, "strn"),
    registrationNo: str(fd, "registrationNo"),
    establishedOn: str(fd, "establishedOn"),
    sector: str(fd, "sector"),
    businessActivity: str(fd, "businessActivity"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    annualTurnover: str(fd, "annualTurnover"),
    womenLed: fd.get("womenLed") === "on",
    people: people.filter((p) => p && p.fullName),
  };
}

export async function createCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const r = await run(fd, async (actor) => {
    id = (await createCustomer(actor, parseCustomer(fd))).id;
  });
  if (r.ok) redirect(`/customers/${id}`);
  return r;
}

export async function kycAction(customerId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await recordKyc(actor, customerId, {
      decision: str(fd, "decision"),
      riskCategory: str(fd, "riskCategory"),
      ecibObtained: fd.get("ecibObtained") === "on",
      ecibOverdue: fd.get("ecibOverdue") === "on",
      ecibRemarks: str(fd, "ecibRemarks"),
      otherBankExposure: str(fd, "otherBankExposure") || "0",
      relatedParty: fd.get("relatedParty") === "on",
      remarks: str(fd, "remarks"),
    });
    return "KYC decision recorded.";
  });
}

export async function customerUserAction(customerId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await createCustomerUser(actor, customerId, Object.fromEntries(["fullName", "username", "email", "mobile", "role", "password"].map((k) => [k, str(fd, k)])));
    return "Customer user created. Share the username and temporary password through a secure channel.";
  });
}

export async function verifyKycDocAction(docId: string, decision: "VERIFIED" | "REJECTED", _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (actor.role !== "RCAD") throw new AccessError();
    const { audit } = await import("@/lib/audit");
    await db.$transaction(async (tx) => {
      const doc = await tx.customerDocument.findFirst({ where: { id: docId, customer: { tenantId: actor.tenantId } }, include: { file: true } });
      if (!doc) throw new AccessError();
      if (doc.uploadedById === actor.userId) throw new RuleError("Maker-checker: you uploaded this document.");
      await tx.customerDocument.update({ where: { id: docId }, data: { status: decision, verifiedById: actor.userId, verifiedAt: new Date(), remarks: str(fd, "remarks") } });
      await audit(tx, actor, { eventType: "KYC_DOCUMENT_REVIEWED", action: decision === "VERIFIED" ? "APPROVE" : "RETURN", summary: `${doc.docType} ${decision.toLowerCase()}`, customerId: doc.customerId, entityType: "CustomerDocument", entityId: doc.id, docHash: doc.file.sha256 });
    });
  });
}

// --- Cases -----------------------------------------------------------------------

function parseCase(fd: FormData) {
  const structure: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("s_")) structure[k.slice(2)] = String(v).trim();
  return {
    customerId: str(fd, "customerId"),
    productCode: str(fd, "productCode"),
    purpose: str(fd, "purpose"),
    amount: str(fd, "amount"),
    tenorMonths: str(fd, "tenorMonths"),
    profitRate: str(fd, "profitRate"),
    benchmark: str(fd, "benchmark") || "6M KIBOR",
    repayment: str(fd, "repayment"),
    securityType: str(fd, "securityType"),
    collateral: str(fd, "collateral"),
    liquidLien: str(fd, "liquidLien") || "0",
    ecibJustification: str(fd, "ecibJustification"),
    structure,
  };
}

export async function createCaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const r = await run(fd, async (actor) => {
    id = (await createCase(actor, parseCase(fd))).id;
  });
  if (r.ok) redirect(`/cases/${id}`);
  return r;
}

export async function updateCaseAction(caseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run(fd, (actor) => updateDraft(actor, caseId, parseCase(fd)));
  if (r.ok) redirect(`/cases/${caseId}`);
  return r;
}

export async function submitCaseAction(caseId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await submitCase(actor, caseId);
    return "Submitted. CPTM acknowledgement sent to the customer; reviewers notified.";
  });
}

export async function cancelCaseAction(caseId: string, _: ActionState, fd: FormData) {
  return run(fd, (actor) => cancelCase(actor, caseId, str(fd, "reason")));
}

export async function clearanceAction(caseId: string, track: Track, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await decideClearance(actor, caseId, track, { decision: str(fd, "decision"), checklist: all(fd, "checklist"), riskRating: str(fd, "riskRating"), comments: str(fd, "comments") });
    return "Decision recorded.";
  });
}

export async function approvalAction(caseId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await decideApproval(actor, caseId, { decision: str(fd, "decision"), comments: str(fd, "comments") });
    return "Decision recorded.";
  });
}

export async function issueOfferAction(caseId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await issueOffer(actor, caseId);
    return "Offer issued to the customer.";
  });
}

export async function commentAction(caseId: string, _: ActionState, fd: FormData) {
  return run(fd, (actor) => addComment(actor, caseId, str(fd, "body"), fd.get("internal") === "on"));
}

// --- Signing -----------------------------------------------------------------------

export async function requestOtpAction(documentId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    const r = await requestSigningOtp(actor, documentId);
    return { message: `OTP sent to your registered mobile. Valid for ${Math.round(r.expiresInSeconds / 60)} minutes.`, data: { challengeId: r.challengeId, devCode: r.devCode } };
  }, { refresh: false });
}

export async function signAction(documentId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    const decision = str(fd, "decision") === "DECLINED" ? "DECLINED" : "SIGNED";
    await signDocument(actor, documentId, {
      challengeId: str(fd, "challengeId"),
      otp: str(fd, "otp"),
      typedName: str(fd, "typedName"),
      consent: fd.get("consent") === "on",
      decision,
      reason: str(fd, "reason"),
    });
    return decision === "SIGNED" ? "Signed successfully. Your signature is sealed to the document hash." : "You have declined this document.";
  });
}

// --- Execution -----------------------------------------------------------------------

export async function stepActionAction(stepId: string, authorise: boolean, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    const fields: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("f_")) fields[k.slice(2)] = String(v);
    await completeAction(actor, stepId, fields, authorise);
    return authorise ? "Payment authorised." : "Recorded.";
  });
}

export async function checkStepAction(stepId: string, _: ActionState, fd: FormData) {
  return run(fd, (actor) => completeCheck(actor, stepId, all(fd, "checklist"), str(fd, "comments")));
}

export async function verifyEvidenceAction(evidenceId: string, _: ActionState, fd: FormData) {
  return run(fd, (actor) => verifyEvidence(actor, evidenceId, str(fd, "decision") === "REJECTED" ? "REJECTED" : "VERIFIED", str(fd, "remarks"), all(fd, "checklist")));
}

export async function repaymentAction(installmentId: string, _: ActionState, fd: FormData) {
  return run(fd, (actor) => recordRepayment(actor, installmentId, Number(str(fd, "amount")), str(fd, "reference")));
}

export async function dpdAction(caseId: string, _: ActionState, fd: FormData) {
  return run(fd, (actor) => updateDaysPastDue(actor, caseId, Number(str(fd, "dpd"))));
}

// --- Notifications ----------------------------------------------------------------------

export async function markAllReadAction(_: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    await db.notification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
  });
}
