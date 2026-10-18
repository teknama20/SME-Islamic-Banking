// Drives a case through its lifecycle using the correct, eligible role-holder
// for every action — exactly as the UI would. Used for demo seeding and for
// end-to-end tests of every product workflow. Every rule (maker-checker,
// four-eyes, signing order, GPS for possession, Shariah checks) is exercised.
import type { User } from "@prisma/client";
import type { Actor } from "../actor";
import { TRACK_CHECKLISTS, type Stage } from "../constants";
import { db } from "../db";
import type { SignerSlot } from "../products/types";
import { TRACK_ROLE, type Track } from "../rbac";
import { decideApproval, decideClearance, issueOffer, submitCase } from "../engine/cases";
import { requestSigningOtp, signDocument } from "../engine/documents";
import { DISBURSEMENT_CHECKERS, completeAction, completeCheck, stepSpec, submitEvidence, verifyEvidence } from "../engine/execution";
import { usersForRoles } from "../engine/notify";
import { demoPng } from "./png";

export const DEMO_GEO = { lat: 31.5204, lng: 74.3587, accuracy: 8 }; // Lahore

export function actorOf(u: User & { orgUnit?: { path: string } | null }, geo = DEMO_GEO): Actor {
  return {
    tenantId: u.tenantId,
    userId: u.id,
    name: u.fullName,
    role: u.role,
    kind: u.kind as "BANK" | "CUSTOMER",
    orgUnitId: u.orgUnitId,
    orgPath: u.orgUnit?.path ?? null,
    customerId: u.customerId,
    approvalLimit: u.approvalLimit,
    ip: "10.10.1.25",
    userAgent: "SME-Portal-Autopilot/1.0",
    geo,
    device: { platform: "demo", app: "autopilot" },
  };
}

async function actorById(id: string) {
  return actorOf(await db.user.findUniqueOrThrow({ where: { id }, include: { orgUnit: true } }));
}

async function pick(tenantId: string, roles: string[], orgPath: string, exclude: string[] = []) {
  const users = await usersForRoles(db, tenantId, roles, orgPath);
  const u = users.find((x) => !exclude.includes(x.id));
  if (!u) throw new Error(`Autopilot: no eligible user for ${roles.join("/")} (excluding ${exclude.length})`);
  return actorOf(u);
}

async function signAs(actor: Actor, documentId: string) {
  const otp = await requestSigningOtp(actor, documentId);
  if (!otp.devCode) throw new Error("Autopilot requires on-screen OTP delivery");
  await signDocument(actor, documentId, { challengeId: otp.challengeId, otp: otp.devCode, typedName: actor.name, consent: true, decision: "SIGNED" });
}

async function signAllSlots(documentId: string) {
  for (;;) {
    const doc = await db.document.findUniqueOrThrow({ where: { id: documentId }, include: { signatures: true, case: true } });
    if (doc.status !== "ISSUED") return;
    const plan = JSON.parse(doc.signerPlan) as SignerSlot[];
    const slot = plan[doc.signatures.filter((s) => s.decision === "SIGNED").length];
    const kase = doc.case;
    let actor: Actor;
    if (slot.party === "BANK") actor = await pick(kase.tenantId, slot.roles ?? [], kase.orgPath, [kase.rmId, ...doc.signatures.map((s) => s.signerId)]);
    else {
      const u = await db.user.findFirst({ where: { customerId: kase.customerId, role: slot.party === "GUARANTOR" ? "GUARANTOR" : "CUSTOMER_SIGNATORY" }, include: { orgUnit: true } });
      if (!u) throw new Error(`Autopilot: customer has no ${slot.party} user`);
      actor = actorOf(u);
    }
    await signAs(actor, documentId);
  }
}

/** Performs the next required action; returns false when nothing more can be done. */
export async function step(caseId: string, until: Stage): Promise<boolean> {
  const kase = await db.financingCase.findUniqueOrThrow({ where: { id: caseId } });
  if (kase.stage === until || ["ACTIVE", "CLOSED", "REJECTED", "DECLINED", "CANCELLED"].includes(kase.stage)) return false;
  const rm = await actorById(kase.rmId);

  switch (kase.stage) {
    case "DRAFT":
    case "RETURNED":
      await submitCase(rm, caseId);
      return true;
    case "UNDER_REVIEW": {
      const cl = await db.clearance.findFirst({ where: { caseId, status: "PENDING" }, orderBy: { track: "asc" } });
      if (!cl) return false;
      const track = cl.track as Track;
      const actor = await pick(kase.tenantId, [TRACK_ROLE[track]], kase.orgPath);
      await decideClearance(actor, caseId, track, {
        decision: "CLEARED",
        checklist: TRACK_CHECKLISTS[track],
        riskRating: track === "CREDIT" ? "ORR-3 (Good)" : "",
        comments: `${track} review completed — all requirements satisfied.`,
      });
      return true;
    }
    case "PENDING_APPROVAL": {
      const ap = await db.approval.findFirst({ where: { caseId, status: "PENDING" }, orderBy: [{ round: "desc" }, { level: "asc" }] });
      if (!ap) return false;
      const decided = await db.approval.findMany({ where: { caseId, round: ap.round, decidedById: { not: null } } });
      const actor = await pick(kase.tenantId, [ap.role], kase.orgPath, [kase.rmId, ...decided.map((d) => d.decidedById!)]);
      await decideApproval(actor, caseId, { decision: "APPROVE", comments: ap.action === "RECOMMEND" ? "Recommended for approval." : "Approved within delegated authority." });
      return true;
    }
    case "SANCTIONED": {
      const offer = await db.document.findFirstOrThrow({ where: { caseId, code: "OFFER_LETTER", status: "ISSUED" }, include: { signatures: true } });
      if (!offer.signatures.length) {
        const plan = JSON.parse(offer.signerPlan) as SignerSlot[];
        await signAs(await pick(kase.tenantId, plan[0].roles ?? [], kase.orgPath, [kase.rmId]), offer.id);
      } else await issueOffer(rm, caseId);
      return true;
    }
    case "OFFERED": {
      const docs = await db.document.findMany({ where: { caseId, code: { in: ["OFFER_LETTER", "KFS"] }, status: "ISSUED" } });
      if (!docs.length) return false;
      for (const d of docs) await signAllSlots(d.id);
      return true;
    }
    case "EXECUTION": {
      const st = await db.executionStep.findFirst({ where: { caseId, status: "READY" }, orderBy: { seq: "asc" } });
      if (!st) return false;
      const spec = stepSpec(st);
      if (spec.kind === "SIGN") {
        const doc = await db.document.findFirstOrThrow({ where: { caseId, stepKey: st.key, status: "ISSUED" } });
        await signAllSlots(doc.id);
      } else if (spec.kind === "EVIDENCE" && spec.evidence) {
        const ev = spec.evidence;
        const custUser = await db.user.findFirst({ where: { customerId: kase.customerId, role: { in: ev.capturers.filter((r) => r.startsWith("CUSTOMER")) } }, include: { orgUnit: true } });
        const capturer = custUser ? actorOf(custUser) : ev.capturers.includes("RM") ? rm : await pick(kase.tenantId, ev.capturers.filter((r) => !r.startsWith("CUSTOMER")), kase.orgPath);
        const existing = await db.evidence.count({ where: { caseId, stepKey: st.key, status: { not: "REJECTED" } } });
        for (let i = existing; i < ev.minItems; i++) {
          const cat = ev.categories[i % ev.categories.length];
          await submitEvidence(
            capturer,
            { caseId, stepKey: st.key, category: cat, description: `${st.title} — ${cat.toLowerCase()} record ${i + 1}`, assetRef: `ASSET-${kase.ref}-${i + 1}`, clientTime: new Date().toISOString(), locationNote: "" },
            { buffer: demoPng(st.seq * 10 + i), name: `${st.key}-${i + 1}.png`, type: "image/png" },
          );
        }
        const pending = await db.evidence.findMany({ where: { caseId, stepKey: st.key, status: "SUBMITTED" } });
        for (const p of pending) {
          const verifier = await pick(kase.tenantId, ev.verifiers, kase.orgPath, [p.capturedById]);
          await verifyEvidence(verifier, p.id, "VERIFIED", "Verified against originals; GPS and timestamps consistent.", ev.checklist);
        }
      } else if (spec.kind === "ACTION" && spec.action) {
        const fields: Record<string, string> = {};
        for (const f of spec.action.fields) fields[f.name] = f.type === "number" ? String(paymentAmount(kase, st.key, spec.title)) : `${f.name.toUpperCase()}-${kase.ref}-${st.seq}`;
        if (spec.action.effect === "DISBURSE") {
          const maker = await pick(kase.tenantId, spec.action.roles, kase.orgPath);
          await completeAction(maker, st.id, fields);
          const checker = await pick(kase.tenantId, DISBURSEMENT_CHECKERS, kase.orgPath, [maker.userId]);
          await completeAction(checker, st.id, {}, true);
        } else {
          await completeAction(await pick(kase.tenantId, spec.action.roles, kase.orgPath), st.id, fields);
        }
      } else if (spec.kind === "CHECK" && spec.check) {
        await completeCheck(await pick(kase.tenantId, spec.check.roles, kase.orgPath), st.id, spec.check.checklist, "Verified per Shariah Board-approved process (ref. SB/2026/07).");
      }
      return true;
    }
  }
  return false;
}

function paymentAmount(kase: { amount: number; productCode: string; structure: string }, key: string, title: string) {
  const s = JSON.parse(kase.structure) as Record<string, string>;
  if (key.startsWith("milestone_pay_")) return Math.floor(kase.amount / Math.max(1, Number(s.milestones) || 1));
  if (kase.productCode === "DIMINISHING_MUSHARAKAH" && /vendor/i.test(title)) return Number(s.totalAssetValue) || kase.amount;
  return kase.amount;
}

/** Runs `step` until the case reaches `until` (or cannot progress). */
export async function autopilot(caseId: string, until: Stage = "ACTIVE", maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    if (!(await step(caseId, until))) break;
  }
  return db.financingCase.findUniqueOrThrow({ where: { id: caseId } });
}
