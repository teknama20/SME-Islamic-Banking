// Read models for dashboards: "what is waiting on me?" per role and scope.
import type { Actor } from "./actor";
import { TRACK_LABELS } from "./constants";
import { db } from "./db";
import { DISBURSEMENT_CHECKERS, stepSpec } from "./engine/execution";
import { OFFER_DOCS } from "./engine/documents";
import { getProduct } from "./products/catalog";
import type { SignerSlot } from "./products/types";
import { TRACK_ROLE, roleLabel, type Track } from "./rbac";
import { caseScope, customerScope } from "./scope";

export type Task = { kind: string; title: string; detail: string; href: string; since: Date; urgent?: boolean };

export function nextSlot(doc: { signerPlan: string; signatures: { decision: string }[] }): { slot: SignerSlot | undefined; index: number } {
  const plan = JSON.parse(doc.signerPlan) as SignerSlot[];
  const index = doc.signatures.filter((s) => s.decision === "SIGNED").length;
  return { slot: plan[index], index };
}

/** Mirrors engine/documents.assertCanSign without throwing. */
export function isMyTurnToSign(
  actor: Actor,
  doc: { code: string; status: string; signerPlan: string; signatures: { decision: string; signerId: string; party: string }[] },
  kase: { stage: string; customerId: string; rmId: string },
  stepReady: boolean,
) {
  if (doc.status !== "ISSUED") return false;
  const { slot } = nextSlot(doc);
  if (!slot) return false;
  const offer = OFFER_DOCS.includes(doc.code);
  const customerSide = slot.party === "CUSTOMER" || slot.party === "GUARANTOR";
  if (offer && !["SANCTIONED", "OFFERED"].includes(kase.stage)) return false;
  if (offer && customerSide && kase.stage !== "OFFERED") return false;
  if (!offer && (kase.stage !== "EXECUTION" || !stepReady)) return false;
  if (slot.party === "CUSTOMER") return actor.role === "CUSTOMER_SIGNATORY" && actor.customerId === kase.customerId;
  if (slot.party === "GUARANTOR") return actor.role === "GUARANTOR" && actor.customerId === kase.customerId;
  if (actor.kind !== "BANK" || !slot.roles?.includes(actor.role as never)) return false;
  return slot.party !== "BANK" || !doc.signatures.some((s) => s.party === "BANK" && s.signerId === actor.userId);
}

export async function getMyTasks(actor: Actor): Promise<Task[]> {
  const scope = caseScope(actor);
  const tasks: Task[] = [];
  const cases = await db.financingCase.findMany({
    where: { ...scope, OR: [{ stage: { notIn: ["CLOSED", "CANCELLED", "REJECTED", "DECLINED"] } }, { shariahReviewStatus: "PENDING" }] },
    include: {
      customer: { select: { legalName: true } },
      clearances: true,
      approvals: { where: { status: "PENDING" }, orderBy: [{ round: "desc" }, { level: "asc" }] },
      documents: { where: { status: "ISSUED" }, include: { signatures: true } },
      steps: { where: { status: "READY" } },
      evidence: { where: { status: "SUBMITTED" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  for (const c of cases) {
    const label = `${c.ref} · ${c.customer.legalName}`;
    const product = getProduct(c.productCode).name;

    if (actor.userId === c.rmId) {
      if (c.stage === "DRAFT") tasks.push({ kind: "Draft", title: `Complete & submit ${product} request`, detail: label, href: `/cases/${c.id}`, since: c.updatedAt });
      if (c.stage === "RETURNED") tasks.push({ kind: "Returned", title: `Address review comments on ${product}`, detail: label, href: `/cases/${c.id}`, since: c.updatedAt, urgent: true });
    }

    if (c.stage === "UNDER_REVIEW") {
      for (const cl of c.clearances) {
        if (cl.status === "PENDING" && TRACK_ROLE[cl.track as Track] === actor.role)
          tasks.push({ kind: "Clearance", title: `${TRACK_LABELS[cl.track as Track]} clearance`, detail: `${label} · ${product}`, href: `/cases/${c.id}?tab=clearances`, since: c.submittedAt ?? c.updatedAt, urgent: !!c.tatDueAt && c.tatDueAt < new Date() });
      }
    }
    if (c.stage === "PENDING_APPROVAL" && c.approvals[0]?.role === actor.role && actor.userId !== c.rmId) {
      const a = c.approvals[0];
      tasks.push({ kind: "Approval", title: `${a.action === "RECOMMEND" ? "Recommend" : "Approve"} ${product} — PKR ${c.amount.toLocaleString("en-PK")}`, detail: `${label} · level ${a.level} (${roleLabel(a.role)})`, href: `/cases/${c.id}?tab=approvals`, since: a.createdAt, urgent: !!c.tatDueAt && c.tatDueAt < new Date() });
    }

    if (c.shariahReviewStatus === "PENDING" && actor.role === "SHARIAH")
      tasks.push({ kind: "Shariah review", title: `Post-disbursement Shariah review — ${product}`, detail: label, href: `/cases/${c.id}?tab=shariah`, since: c.activatedAt ?? c.updatedAt });

    const readyKeys = new Set(c.steps.map((s) => s.key));
    for (const d of c.documents) {
      if (isMyTurnToSign(actor, d, c, !d.stepKey || readyKeys.has(d.stepKey)))
        tasks.push({ kind: "Signature", title: `Sign: ${d.title}`, detail: `${label} · ${nextSlot(d).slot?.capacity}`, href: `/documents/${d.id}`, since: d.createdAt, urgent: true });
    }

    for (const st of c.steps) {
      const spec = stepSpec(st);
      const outcome = JSON.parse(st.outcome || "{}") as { pendingAuthorisation?: boolean; makerId?: string };
      if (spec.kind === "ACTION" && spec.action) {
        if (outcome.pendingAuthorisation) {
          if (DISBURSEMENT_CHECKERS.includes(actor.role) && outcome.makerId !== actor.userId && actor.kind === "BANK")
            tasks.push({ kind: "Authorise", title: `Authorise payment: ${st.title}`, detail: label, href: `/cases/${c.id}?tab=execution`, since: st.completedAt ?? c.updatedAt, urgent: true });
        } else if (spec.action.roles.includes(actor.role as never)) tasks.push({ kind: "Action", title: st.title, detail: label, href: `/cases/${c.id}?tab=execution`, since: c.updatedAt });
      }
      if (spec.kind === "CHECK" && spec.check?.roles.includes(actor.role as never)) tasks.push({ kind: "Shariah check", title: st.title, detail: label, href: `/cases/${c.id}?tab=execution`, since: c.updatedAt });
      if (spec.kind === "EVIDENCE" && spec.evidence?.capturers.includes(actor.role as never) && (actor.kind === "BANK" || actor.customerId === c.customerId)) {
        const pending = c.evidence.filter((e) => e.stepKey === st.key).length;
        if (!pending) tasks.push({ kind: "Evidence", title: `Capture: ${st.title}`, detail: label, href: `/cases/${c.id}/capture?step=${st.key}`, since: c.updatedAt });
      }
    }
    for (const e of c.evidence) {
      const st = c.steps.find((s) => s.key === e.stepKey);
      if (st && stepSpec(st).evidence?.verifiers.includes(actor.role as never) && e.capturedById !== actor.userId)
        tasks.push({ kind: "Verify", title: `Verify evidence: ${e.description}`, detail: label, href: `/cases/${c.id}?tab=evidence`, since: e.serverTime });
    }
  }

  if (actor.role === "RCAD") {
    const kyc = await db.customer.findMany({ where: { ...customerScope(actor), kycStatus: "PENDING" } });
    for (const k of kyc) tasks.push({ kind: "KYC", title: `KYC/CDD: ${k.legalName}`, detail: `${k.cif} · ${k.city}`, href: `/customers/${k.id}`, since: k.createdAt });
  }
  return tasks.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || a.since.getTime() - b.since.getTime());
}

export async function pipelineStats(actor: Actor) {
  const scope = caseScope(actor);
  const [byStage, byProduct, tatBreaches, active] = await Promise.all([
    db.financingCase.groupBy({ by: ["stage"], where: scope, _count: true, _sum: { amount: true } }),
    db.financingCase.groupBy({ by: ["productCode"], where: { ...scope, stage: { in: ["ACTIVE", "EXECUTION", "OFFERED", "SANCTIONED"] } }, _count: true, _sum: { amount: true } }),
    db.financingCase.count({ where: { ...scope, stage: { in: ["UNDER_REVIEW", "PENDING_APPROVAL", "RETURNED"] }, tatDueAt: { lt: new Date() } } }),
    db.financingCase.findMany({ where: { ...scope, stage: "ACTIVE" }, select: { amount: true, classification: true } }),
  ]);
  return { byStage, byProduct, tatBreaches, active };
}
