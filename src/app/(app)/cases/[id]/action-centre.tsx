import Link from "next/link";
import { issueOfferAction, submitCaseAction } from "@/app/actions/workflow";
import { ActionForm } from "@/components/action-form";
import { Badge, fmtAgo } from "@/components/ui";
import type { Actor } from "@/lib/actor";
import { STAGE_LABELS, type Stage } from "@/lib/constants";
import { db } from "@/lib/db";
import { usersForRoles } from "@/lib/engine/notify";
import { computePending, type PendingCase, type PendingItem } from "@/lib/pending";

const TERMINAL: Record<string, string> = {
  CLOSED: "This facility is fully settled and closed.",
  CANCELLED: "This request was cancelled.",
  REJECTED: "This request was declined by the bank.",
  DECLINED: "The customer declined the offer.",
};

async function ownerNames(c: PendingCase & { tenantId: string; orgPath: string }, items: PendingItem[]) {
  const names: Record<string, string> = {};
  for (const it of items) {
    if (it.done) continue;
    const bankRoles = it.ownerRoles.filter((r) => !["CUSTOMER_SIGNATORY", "GUARANTOR", "CUSTOMER_USER"].includes(r));
    const custRoles = it.ownerRoles.filter((r) => ["CUSTOMER_SIGNATORY", "GUARANTOR", "CUSTOMER_USER"].includes(r));
    const bank = bankRoles.length ? await usersForRoles(db, c.tenantId, bankRoles, c.orgPath) : [];
    const cust = custRoles.length ? await db.user.findMany({ where: { customerId: c.customerId, role: { in: custRoles }, status: "ACTIVE" } }) : [];
    names[it.key] = [...bank, ...cust].map((u) => u.fullName).slice(0, 4).join(", ");
  }
  return names;
}

export async function ActionCentre({ actor, kase, done }: { actor: Actor; kase: PendingCase & { tenantId: string; orgPath: string }; done?: string }) {
  const items = computePending(actor, kase);
  const open = items.filter((i) => !i.done);
  const mine = open.filter((i) => i.mine);
  const isCustomer = actor.kind === "CUSTOMER";
  const names = isCustomer ? {} : await ownerNames(kase, items);

  const headline = TERMINAL[kase.stage]
    ? TERMINAL[kase.stage]
    : mine.length
      ? `Action required from you (${mine.length})`
      : open.length
        ? `Waiting on ${[...new Set(open.map((i) => (isCustomer && i.party === "BANK" ? "the bank" : i.owner)))].join(", ")}`
        : "No pending actions";

  return (
    <section className={`no-print mb-5 rounded-xl border p-4 ${mine.length ? "border-accent bg-accent/10" : "border-line bg-surface"}`}>
      {done && <p className="mb-3 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">✓ {done}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium tracking-wide text-muted uppercase">{STAGE_LABELS[kase.stage as Stage] ?? kase.stage}</div>
          <h2 className="text-base font-semibold">{headline}</h2>
        </div>
        {mine.length > 0 && <Badge tone="warn">Your turn</Badge>}
      </div>

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {items.map((it) => (
            <li key={it.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className={`size-2.5 shrink-0 rounded-full ${it.done ? "bg-ok" : it.mine ? "bg-accent" : "bg-warn"}`} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${it.mine ? "font-semibold" : "font-medium"} ${it.done ? "text-muted line-through decoration-ok/50" : ""}`}>{it.title}</div>
                <div className="text-xs text-muted">
                  {it.done ? (
                    <>Completed {it.since ? fmtAgo(it.since) : ""}</>
                  ) : (
                    <>
                      {it.mine ? "Pending with you" : `Pending with ${isCustomer && it.party === "BANK" ? `the bank (${it.owner})` : it.owner}`}
                      {!it.mine && names[it.key] ? ` — ${names[it.key]}` : ""}
                      {it.since && ` · waiting ${fmtAgo(it.since, false)}`}
                      {it.note && ` · ${it.note}`}
                    </>
                  )}
                </div>
              </div>
              {!it.done && it.cta?.kind === "link" && (
                <Link href={it.cta.href} className={it.mine ? "btn btn-primary btn-sm" : "btn btn-sm"}>
                  {it.cta.label}
                </Link>
              )}
              {!it.done && it.cta?.kind === "submit" && (
                <span className="flex gap-2">
                  <Link href={`/cases/${kase.id}/edit`} className="btn btn-sm">
                    Edit
                  </Link>
                  <ActionForm action={submitCaseAction.bind(null, kase.id)} submitLabel={kase.stage === "RETURNED" ? "Resubmit" : "Submit for review"} submitClass="btn btn-primary btn-sm" geo compact />
                </span>
              )}
              {!it.done && it.cta?.kind === "issueOffer" && <ActionForm action={issueOfferAction.bind(null, kase.id)} submitLabel="Issue offer to customer" submitClass="btn btn-primary btn-sm" geo compact />}
              {!it.done && !it.cta && <Badge>waiting</Badge>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
