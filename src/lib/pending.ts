// "Where is this case pending, with whom, and can I act on it?"
// One function used by the case action centre, case lists and dashboards so
// every screen tells the same story.
import type { Actor } from "./actor";
import { TRACK_LABELS } from "./constants";
import { DISBURSEMENT_CHECKERS, stepSpec } from "./engine/execution";
import { OFFER_DOCS } from "./engine/documents";
import type { SignerSlot } from "./products/types";
import { isMyTurnToSign, nextSlot } from "./queries";
import { TRACK_ROLE, roleLabel, type Track } from "./rbac";

export type PendingCase = {
  id: string;
  stage: string;
  rmId: string;
  customerId: string;
  submittedAt: Date | null;
  sanctionedAt: Date | null;
  offeredAt: Date | null;
  acceptedAt: Date | null;
  activatedAt: Date | null;
  shariahReviewStatus: string;
  shariahReviewedAt: Date | null;
  updatedAt: Date;
  clearances: { track: string; status: string; createdAt: Date; decidedAt: Date | null }[];
  approvals: { role: string; action: string; level: number; status: string; round: number; createdAt: Date; decidedAt: Date | null }[];
  documents: { id: string; code: string; title: string; status: string; signerPlan: string; stepKey: string | null; createdAt: Date; signatures: { decision: string; signerId: string; party: string; signedAt: Date }[] }[];
  steps: { id: string; key: string; title: string; status: string; config: string; outcome: string; completedAt: Date | null }[];
  evidence: { stepKey: string | null; status: string; capturedById: string }[];
  schedule: { seq: number; dueDate: Date; status: string; total: number; paidAmount: number }[];
  customer?: { kycStatus: string; ecibCheckedAt: Date | null };
};

export type Cta =
  | { kind: "link"; label: string; href: string }
  | { kind: "submit" };

export type PendingItem = {
  key: string;
  title: string;
  /** Who must act: role labels / party capacity. */
  owner: string;
  ownerRoles: string[];
  party: "BANK" | "CUSTOMER";
  since: Date | null;
  mine: boolean;
  cta?: Cta;
  done?: boolean;
  note?: string;
};

const latest = (dates: (Date | null | undefined)[]) => dates.filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;

function slotOwner(slot: SignerSlot) {
  if (slot.party === "BANK" || slot.party === "RCAD") return { owner: slot.capacity, roles: slot.roles ?? [], party: "BANK" as const };
  return { owner: slot.capacity, roles: [slot.party === "GUARANTOR" ? "GUARANTOR" : "CUSTOMER_SIGNATORY"], party: "CUSTOMER" as const };
}

export function computePending(actor: Actor, c: PendingCase): PendingItem[] {
  const items: PendingItem[] = [];
  const isRm = actor.userId === c.rmId;
  const signDoc = (d: PendingCase["documents"][number], stepReady: boolean, key: string): PendingItem | null => {
    const { slot } = nextSlot(d);
    if (!slot) return null;
    const o = slotOwner(slot);
    const mine = isMyTurnToSign(actor, d, c, stepReady);
    return {
      key,
      title: `Sign: ${d.title}`,
      owner: o.owner,
      ownerRoles: o.roles,
      party: o.party,
      since: latest([d.createdAt, ...d.signatures.map((s) => s.signedAt)]),
      mine,
      cta: { kind: "link", label: mine ? "Review & sign now" : "View document", href: `/documents/${d.id}` },
      note: `${d.signatures.filter((s) => s.decision === "SIGNED").length} of ${(JSON.parse(d.signerPlan) as SignerSlot[]).length} signatures collected`,
    };
  };

  switch (c.stage) {
    case "DRAFT":
    case "RETURNED":
      items.push({
        key: "submit",
        title: c.stage === "DRAFT" ? "Complete and submit the financing request" : "Address review comments and resubmit",
        owner: roleLabel("RM"),
        ownerRoles: ["RM"],
        party: "BANK",
        since: c.updatedAt,
        mine: isRm,
        cta: isRm ? { kind: "submit" } : undefined,
      });
      break;

    case "UNDER_REVIEW":
      for (const cl of c.clearances) {
        const role = TRACK_ROLE[cl.track as Track];
        const pending = cl.status === "PENDING";
        const kycBlocked = cl.track === "RCAD" && pending && c.customer && (c.customer.kycStatus !== "CLEARED" || !c.customer.ecibCheckedAt);
        if (kycBlocked) {
          const mine = actor.role === "RCAD";
          items.push({
            key: "kyc-first",
            title: "Clear customer KYC / CDD and obtain e-CIB (prerequisite for RCAD clearance)",
            owner: roleLabel("RCAD"),
            ownerRoles: ["RCAD"],
            party: "BANK",
            since: c.submittedAt,
            mine,
            cta: mine ? { kind: "link", label: "Open customer KYC", href: `/customers/${c.customerId}` } : undefined,
          });
        }
        items.push({
          key: `clearance-${cl.track}`,
          title: `${TRACK_LABELS[cl.track as Track]} review`,
          owner: roleLabel(role),
          ownerRoles: [role],
          party: "BANK",
          since: pending ? c.submittedAt ?? cl.createdAt : cl.decidedAt,
          mine: pending && actor.role === role && !kycBlocked,
          done: !pending,
          note: kycBlocked ? "after customer KYC is cleared" : undefined,
          cta: pending && actor.role === role && !kycBlocked ? { kind: "link", label: "Review & clear", href: `/cases/${c.id}?tab=clearances` } : undefined,
        });
      }
      break;

    case "PENDING_APPROVAL": {
      const round = Math.max(0, ...c.approvals.map((a) => a.round));
      for (const a of c.approvals.filter((x) => x.round === round)) {
        const current = a.status === "PENDING" && a.level === Math.min(...c.approvals.filter((x) => x.round === round && x.status === "PENDING").map((x) => x.level));
        if (a.status === "PENDING" && !current) continue;
        const mine = current && actor.role === a.role && !isRm && actor.kind === "BANK";
        items.push({
          key: `approval-${a.level}`,
          title: `Level ${a.level}: ${a.action === "RECOMMEND" ? "recommendation" : "approval"}`,
          owner: roleLabel(a.role),
          ownerRoles: [a.role],
          party: "BANK",
          since: current ? latest([a.createdAt, ...c.approvals.filter((x) => x.round === round).map((x) => x.decidedAt)]) : a.decidedAt,
          mine,
          done: a.status === "APPROVED",
          cta: mine ? { kind: "link", label: a.action === "RECOMMEND" ? "Review & recommend" : "Review & approve", href: `/cases/${c.id}?tab=approvals` } : undefined,
        });
      }
      break;
    }

    case "SANCTIONED":
    case "OFFERED":
      for (const d of c.documents.filter((x) => OFFER_DOCS.includes(x.code) && x.status === "ISSUED")) {
        const it = signDoc(d, true, `offer-${d.code}`);
        if (!it) continue;
        const custTurn = it.party === "CUSTOMER";
        if (custTurn && c.stage === "SANCTIONED") continue; // reaches the customer once the bank signs
        items.push({ ...it, title: d.code === "OFFER_LETTER" ? (custTurn ? "Accept the offer letter" : `Offer letter: ${it.owner.split(" — ")[0]} to sign`) : custTurn ? "Acknowledge the Key Fact Statement (English / Urdu)" : "Key Fact Statement: RCAD to prepare" });
      }
      break;

    case "EXECUTION":
      for (const st of c.steps.filter((s) => s.status === "READY")) {
        const spec = stepSpec(st);
        const since = latest([c.acceptedAt, ...c.steps.filter((x) => spec.dependsOn.includes(x.key)).map((x) => x.completedAt)]);
        if (spec.kind === "SIGN") {
          const d = c.documents.find((x) => x.stepKey === st.key && x.status === "ISSUED");
          const it = d && signDoc(d, true, `step-${st.key}`);
          if (it) items.push({ ...it, title: st.title, since: latest([since, it.since]) });
        } else if (spec.kind === "EVIDENCE" && spec.evidence) {
          const ev = c.evidence.filter((e) => e.stepKey === st.key);
          const submitted = ev.filter((e) => e.status === "SUBMITTED");
          const verified = ev.filter((e) => e.status === "VERIFIED").length;
          const note = `${verified} of ${spec.evidence.minItems} item(s) verified${spec.evidence.requireGps ? " · GPS required" : ""}`;
          if (submitted.length) {
            const mine = spec.evidence.verifiers.includes(actor.role as never) && submitted.some((e) => e.capturedById !== actor.userId);
            items.push({ key: `verify-${st.key}`, title: `Verify evidence: ${st.title}`, owner: spec.evidence.verifiers.map(roleLabel).join(" / "), ownerRoles: spec.evidence.verifiers, party: "BANK", since, mine, note, cta: mine ? { kind: "link", label: "Verify evidence", href: `/cases/${c.id}?tab=evidence` } : undefined });
          }
          if (verified + submitted.length < spec.evidence.minItems) {
            const mine = spec.evidence.capturers.includes(actor.role as never) && (actor.kind === "BANK" || actor.customerId === c.customerId);
            const customerCan = spec.evidence.capturers.some((r) => r.startsWith("CUSTOMER"));
            items.push({ key: `capture-${st.key}`, title: st.title, owner: spec.evidence.capturers.map(roleLabel).join(" / "), ownerRoles: spec.evidence.capturers, party: customerCan ? "CUSTOMER" : "BANK", since, mine, note, cta: mine ? { kind: "link", label: "Capture evidence", href: `/cases/${c.id}/capture?step=${st.key}` } : undefined });
          }
        } else if (spec.kind === "ACTION" && spec.action) {
          const outcome = JSON.parse(st.outcome || "{}") as { pendingAuthorisation?: boolean; makerId?: string };
          if (outcome.pendingAuthorisation) {
            const mine = DISBURSEMENT_CHECKERS.includes(actor.role) && outcome.makerId !== actor.userId && actor.kind === "BANK";
            items.push({ key: `auth-${st.key}`, title: `Authorise payment: ${st.title}`, owner: `${DISBURSEMENT_CHECKERS.map(roleLabel).join(" / ")} (not the initiator)`, ownerRoles: DISBURSEMENT_CHECKERS, party: "BANK", since, mine, cta: mine ? { kind: "link", label: "Authorise payment", href: `/cases/${c.id}?tab=execution#step-${st.key}` } : undefined });
          } else {
            const mine = spec.action.roles.includes(actor.role as never);
            items.push({ key: `action-${st.key}`, title: st.title, owner: spec.action.roles.map(roleLabel).join(" / "), ownerRoles: spec.action.roles, party: "BANK", since, mine, cta: mine ? { kind: "link", label: spec.action.effect === "DISBURSE" ? "Initiate payment" : "Complete step", href: `/cases/${c.id}?tab=execution#step-${st.key}` } : undefined });
          }
        } else if (spec.kind === "CHECK" && spec.check) {
          const mine = spec.check.roles.includes(actor.role as never);
          items.push({ key: `check-${st.key}`, title: st.title, owner: spec.check.roles.map(roleLabel).join(" / "), ownerRoles: spec.check.roles, party: "BANK", since, mine, cta: mine ? { kind: "link", label: "Complete Shariah check", href: `/cases/${c.id}?tab=execution#step-${st.key}` } : undefined });
        }
      }
      break;

    case "ACTIVE":
    case "CLOSED": {
      if (c.shariahReviewStatus === "PENDING") {
        const mine = actor.role === "SHARIAH";
        items.push({ key: "shariah-review", title: "Post-disbursement Shariah review of the complete file", owner: roleLabel("SHARIAH"), ownerRoles: ["SHARIAH"], party: "BANK", since: c.activatedAt, mine, cta: mine ? { kind: "link", label: "Start Shariah review", href: `/cases/${c.id}?tab=shariah` } : undefined });
      } else if (c.shariahReviewStatus === "COMPLIANT" || c.shariahReviewStatus === "NON_COMPLIANT") {
        items.push({ key: "shariah-review", title: `Shariah review: ${c.shariahReviewStatus === "COMPLIANT" ? "compliant" : "NON-COMPLIANT — rectification required"}`, owner: roleLabel("SHARIAH"), ownerRoles: ["SHARIAH"], party: "BANK", since: c.shariahReviewedAt, mine: false, done: c.shariahReviewStatus === "COMPLIANT" });
      }
      if (c.stage === "CLOSED") break;
      const next = c.schedule.find((i) => i.status !== "PAID");
      if (next)
        items.push({
          key: "instalment",
          title: `Instalment #${next.seq} due ${next.dueDate.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}`,
          owner: "Customer (payment) · RCAD (posting)",
          ownerRoles: ["RCAD"],
          party: "CUSTOMER",
          since: null,
          mine: ["RCAD", "OPERATIONS"].includes(actor.role),
          cta: ["RCAD", "OPERATIONS"].includes(actor.role) ? { kind: "link", label: "Post repayment", href: `/cases/${c.id}?tab=schedule` } : { kind: "link", label: "View schedule", href: `/cases/${c.id}?tab=schedule` },
        });
      break;
    }
  }
  return items;
}

/** One-line summary for lists: who the case is waiting on. */
export function pendingSummary(actor: Actor, c: PendingCase): { text: string; mine: boolean } {
  const open = computePending(actor, c).filter((i) => !i.done);
  if (!open.length) return { text: ["CLOSED", "CANCELLED", "REJECTED", "DECLINED"].includes(c.stage) ? "—" : "No pending action", mine: false };
  const mine = open.find((i) => i.mine);
  if (mine) return { text: `You: ${mine.cta && mine.cta.kind === "link" ? mine.cta.label : mine.title}`, mine: true };
  const owners = [...new Set(open.map((i) => (actor.kind === "CUSTOMER" && i.party === "BANK" ? "Bank" : i.owner)))];
  return { text: owners.slice(0, 3).join(" · ") + (owners.length > 3 ? ` +${owners.length - 3}` : ""), mine: false };
}

/** Prisma include needed by computePending. */
export const PENDING_INCLUDE = {
  clearances: true,
  approvals: true,
  documents: { where: { status: { in: ["ISSUED", "EXECUTED"] } }, include: { signatures: true } },
  steps: true,
  evidence: { select: { stepKey: true, status: true, capturedById: true } },
  schedule: { orderBy: { seq: "asc" as const } },
  customer: { select: { kycStatus: true, ecibCheckedAt: true, legalName: true } },
};
