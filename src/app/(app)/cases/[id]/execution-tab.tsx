import Link from "next/link";
import { checkStepAction, stepActionAction } from "@/app/actions/workflow";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, StatusBadge, fmtDateTime } from "@/components/ui";
import type { Actor } from "@/lib/actor";
import { EVIDENCE_LABELS } from "@/lib/constants";
import { DISBURSEMENT_CHECKERS, stepSpec } from "@/lib/engine/execution";
import { pkr } from "@/lib/pricing";
import type { SignerSlot } from "@/lib/products/types";
import { isMyTurnToSign } from "@/lib/queries";
import { roleLabel } from "@/lib/rbac";
import type { LoadedCase } from "./load";

const KIND_LABEL = { SIGN: "Signature", EVIDENCE: "Evidence", ACTION: "Action", CHECK: "Shariah check" } as const;

export function ExecutionTab({ actor, data }: { actor: Actor; data: LoadedCase }) {
  const { kase, people } = data;
  if (!kase.steps.length) return <Empty>The execution plan is generated at sanction from the product&apos;s Shariah sequence.</Empty>;
  const docsByStep = Object.fromEntries(kase.documents.filter((d) => d.stepKey && d.status !== "VOID").map((d) => [d.stepKey!, d]));
  const done = kase.steps.filter((s) => s.status === "DONE").length;

  return (
    <Card
      title={`Execution sequence — ${done}/${kase.steps.length} complete`}
      actions={kase.stage !== "EXECUTION" && kase.stage !== "ACTIVE" && kase.stage !== "CLOSED" ? <Badge tone="warn">Starts after the customer accepts the offer</Badge> : undefined}
    >
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-brand" style={{ width: `${(done / kase.steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-3">
        {kase.steps.map((st) => {
          const spec = stepSpec(st);
          const outcome = JSON.parse(st.outcome || "{}") as Record<string, string | number | boolean>;
          const ready = st.status === "READY" && kase.stage === "EXECUTION";
          const doc = docsByStep[st.key];
          const evidence = kase.evidence.filter((e) => e.stepKey === st.key);
          return (
            <li key={st.id} id={`step-${st.key}`} className={`scroll-mt-6 rounded-xl border p-4 ${ready ? "border-brand/40 bg-brand/5" : "border-line"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${st.status === "DONE" ? "bg-ok text-white" : ready ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>{st.status === "DONE" ? "✓" : st.seq}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{st.title}</span>
                    <Badge tone="neutral">{KIND_LABEL[st.kind as keyof typeof KIND_LABEL]}</Badge>
                    {st.status === "LOCKED" ? <Badge tone="neutral">waiting</Badge> : <StatusBadge status={st.status} />}
                  </div>
                  {spec.note && <p className="mt-1 text-xs text-muted">{spec.note}</p>}
                  {spec.dependsOn.length > 0 && st.status === "LOCKED" && (
                    <p className="mt-1 text-xs text-muted">After: {spec.dependsOn.map((d) => kase.steps.find((x) => x.key === d)?.title ?? d).join(", ")}</p>
                  )}
                  {st.status === "DONE" && (
                    <p className="mt-1 text-xs text-muted">
                      Completed by {people[st.completedById ?? ""]?.fullName ?? "—"} · {fmtDateTime(st.completedAt)}
                      {outcome.paymentRef ? ` · ref ${outcome.paymentRef} · ${pkr(Number(outcome.amount))} to ${outcome.payee}` : ""}
                      {outcome.registrationRef ? ` · ${outcome.registrationRef} (${outcome.registeredWith})` : ""}
                      {outcome.cbsRef ? ` · CBS ${outcome.cbsRef}` : ""}
                      {outcome.comments ? ` · “${outcome.comments}”` : ""}
                    </p>
                  )}

                  {/* SIGN */}
                  {spec.kind === "SIGN" && doc && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <Link href={`/documents/${doc.id}`} className="link">
                        {doc.title}
                      </Link>
                      <span className="text-xs text-muted">
                        {doc.signatures.filter((s) => s.decision === "SIGNED").length}/{(JSON.parse(doc.signerPlan) as SignerSlot[]).length} signatures
                      </span>
                      {ready && doc.status === "ISSUED" && (isMyTurnToSign(actor, doc, kase, true) ? (
                        <Link href={`/documents/${doc.id}`} className="btn btn-primary btn-sm">
                          Review & sign now
                        </Link>
                      ) : (
                        <span className="text-xs text-warn">Waiting for: {(JSON.parse(doc.signerPlan) as SignerSlot[])[doc.signatures.filter((x) => x.decision === "SIGNED").length]?.capacity}</span>
                      ))}
                    </div>
                  )}

                  {/* EVIDENCE */}
                  {spec.kind === "EVIDENCE" && spec.evidence && (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="text-xs text-muted">
                        Needs {spec.evidence.minItems} verified item(s): {spec.evidence.categories.map((c) => EVIDENCE_LABELS[c]).join(" / ")}
                        {spec.evidence.requireGps && " · GPS mandatory"} · capture: {spec.evidence.capturers.map(roleLabel).join(", ")} · verify: {spec.evidence.verifiers.map(roleLabel).join(", ")}
                      </div>
                      {evidence.length > 0 && (
                        <ul className="space-y-1 text-xs">
                          {evidence.map((e) => (
                            <li key={e.id}>
                              <StatusBadge status={e.status} /> {e.description} · {fmtDateTime(e.serverTime)}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex gap-2">
                        {ready && spec.evidence.capturers.includes(actor.role as never) && (actor.kind === "BANK" || actor.customerId === kase.customerId) && (
                          <Link href={`/cases/${kase.id}/capture?step=${st.key}`} className="btn btn-primary btn-sm">
                            Capture evidence
                          </Link>
                        )}
                        {evidence.some((e) => e.status === "SUBMITTED") && spec.evidence.verifiers.includes(actor.role as never) && (
                          <Link href={`/cases/${kase.id}?tab=evidence`} className="btn btn-sm">
                            Review & verify
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ACTION */}
                  {spec.kind === "ACTION" && spec.action && ready && (
                    <div className="mt-3">
                      {outcome.pendingAuthorisation ? (
                        <div className="space-y-2 text-sm">
                          <p className="rounded-lg border border-warn/30 bg-warn/10 p-2">
                            Payment of {pkr(Number(outcome.amount))} to {String(outcome.payee)} (ref {String(outcome.paymentRef)}) initiated by {people[String(outcome.makerId)]?.fullName ?? "maker"} — awaiting second authorisation.
                          </p>
                          {DISBURSEMENT_CHECKERS.includes(actor.role) && actor.userId !== outcome.makerId && actor.kind === "BANK" && (
                            <ActionForm action={stepActionAction.bind(null, st.id, true)} submitLabel="Authorise payment" geo confirm="Authorise this payment?" />
                          )}
                        </div>
                      ) : spec.action.roles.includes(actor.role as never) ? (
                        <ActionForm action={stepActionAction.bind(null, st.id, false)} submitLabel={spec.action.effect === "DISBURSE" ? "Initiate payment (maker)" : spec.action.effect === "ACTIVATE" ? "Activate facility" : "Record completion"} geo>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {spec.action.fields.map((f) => (
                              <div key={f.name}>
                                <label className="label">{f.label}</label>
                                <input name={`f_${f.name}`} type={f.type} step={f.type === "number" ? "0.01" : undefined} className="input" required />
                              </div>
                            ))}
                          </div>
                        </ActionForm>
                      ) : (
                        <p className="text-xs text-muted">Awaiting {spec.action.roles.map(roleLabel).join(" / ")}.</p>
                      )}
                    </div>
                  )}

                  {/* CHECK */}
                  {spec.kind === "CHECK" && spec.check && ready && (
                    <div className="mt-3">
                      {spec.check.roles.includes(actor.role as never) ? (
                        <ActionForm action={checkStepAction.bind(null, st.id)} submitLabel="Confirm Shariah compliance" geo>
                          <fieldset className="space-y-1">
                            {spec.check.checklist.map((c) => (
                              <label key={c} className="flex items-start gap-2 text-sm">
                                <input type="checkbox" name="checklist" value={c} className="mt-1" /> {c}
                              </label>
                            ))}
                          </fieldset>
                          <input name="comments" className="input" placeholder="Comments / fatwa or Shariah Board reference" required />
                        </ActionForm>
                      ) : (
                        <p className="text-xs text-muted">Awaiting {spec.check.roles.map(roleLabel).join(" / ")}.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
