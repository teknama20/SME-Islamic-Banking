import Link from "next/link";
import { approvalAction, cancelCaseAction, clearanceAction, commentAction, dpdAction, repaymentAction, verifyEvidenceAction } from "@/app/actions/workflow";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, GeoLink, Hash, KeyValues, StatusBadge, fmtDate, fmtDateTime } from "@/components/ui";
import type { Actor } from "@/lib/actor";
import { verifyChain } from "@/lib/audit";
import { EVIDENCE_LABELS, REPAYMENT_LABELS, RISK_RATINGS, STAGE_LABELS, STAGE_PATH, TRACK_CHECKLISTS, TRACK_LABELS, type Stage } from "@/lib/constants";
import { db } from "@/lib/db";
import { evaluateCompliance } from "@/lib/engine/cases";
import { stepSpec } from "@/lib/engine/execution";
import { buildSchedule, pkr } from "@/lib/pricing";
import { getProduct } from "@/lib/products/catalog";
import type { SignerSlot } from "@/lib/products/types";
import { isMyTurnToSign } from "@/lib/queries";
import { TRACK_ROLE, roleLabel, type Track } from "@/lib/rbac";
import { PROVISION_RATE, type Classification } from "@/lib/sbp";
import { parseSettings } from "@/lib/tenant";
import type { LoadedCase } from "./load";

type P = { actor: Actor; data: LoadedCase };

// --- Overview ----------------------------------------------------------------------

function StageTracker({ stage }: { stage: string }) {
  const idx = STAGE_PATH.indexOf(stage as Stage);
  const off = idx === -1;
  return (
    <ol className="flex flex-wrap gap-2">
      {STAGE_PATH.map((s, i) => {
        const done = !off && i < idx;
        const cur = !off && i === idx;
        return (
          <li key={s} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${cur ? "border-brand bg-brand text-white" : done ? "border-brand/30 bg-brand/10 text-brand" : "border-line text-muted"}`}>
            <span className="tabular-nums">{i + 1}</span> {STAGE_LABELS[s].split(" (")[0]}
          </li>
        );
      })}
      {off && <li className="rounded-full border border-bad/30 bg-bad/10 px-3 py-1 text-xs text-bad">{STAGE_LABELS[stage as Stage] ?? stage}</li>}
    </ol>
  );
}

export async function OverviewTab({ actor, data }: P) {
  const { kase, people } = data;
  const product = getProduct(kase.productCode);
  const structure = JSON.parse(kase.structure) as Record<string, string>;
  const pricing = buildSchedule({ model: product.pricing, amount: kase.amount, tenorMonths: kase.tenorMonths, profitRate: kase.profitRate, repayment: kase.repayment, startDate: kase.activatedAt ?? new Date(), structure });
  const isBank = actor.kind === "BANK";
  const compliance = isBank ? await evaluateCompliance(db, kase) : null;
  const isRm = actor.userId === kase.rmId;
  const editable = ["DRAFT", "RETURNED"].includes(kase.stage);
  const returns = [
    ...kase.clearances.filter((c) => c.status === "RETURNED").map((c) => ({ who: TRACK_LABELS[c.track as Track], why: c.comments, at: c.decidedAt })),
    ...kase.approvals.filter((a) => a.status === "RETURNED").map((a) => ({ who: roleLabel(a.role), why: a.comments, at: a.decidedAt })),
  ];
  const comments = kase.comments.filter((c) => isBank || !c.internal);
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: kase.tenantId } });

  return (
    <div className="space-y-6">
      <Card>
        <StageTracker stage={kase.stage} />
        {kase.stage === "RETURNED" && returns.length > 0 && (
          <div className="mt-4 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm">
            <strong>Returned for rework:</strong>
            <ul className="mt-1 list-disc pl-5">
              {returns.map((r, i) => (
                <li key={i}>
                  {r.who}: {r.why} <span className="text-muted">({fmtDateTime(r.at)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isRm && editable && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
            <Link href={`/cases/${kase.id}/edit`} className="btn">
              Edit request
            </Link>
            <details>
              <summary className="btn cursor-pointer">Cancel request</summary>
              <ActionForm action={cancelCaseAction.bind(null, kase.id)} submitLabel="Confirm cancellation" submitClass="btn btn-danger" className="mt-2">
                <input name="reason" placeholder="Reason" className="input" required />
              </ActionForm>
            </details>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Facility terms" className="lg:col-span-2">
          <KeyValues
            items={[
              ["Mode", `${product.name} (${product.family})`],
              ["Purpose", kase.purpose],
              ["Amount", pkr(kase.amount)],
              ["Tenor", `${kase.tenorMonths} months`],
              ["Profit rate", `${kase.profitRate}% p.a. — ${kase.benchmark}`],
              ["Repayment", REPAYMENT_LABELS[kase.repayment]?.en ?? kase.repayment],
              ["Security", kase.securityType === "CLEAN" ? "Clean (R-9)" : kase.collateral],
              ["Liquid lien (R-5)", pkr(kase.liquidLien)],
              ...product.fields.map((f) => [f.label, f.options?.find((o) => o.value === structure[f.name])?.label ?? structure[f.name] ?? "—"] as [string, string]),
              ...(structure.guarantorName ? [["Guarantor", structure.guarantorName] as [string, string]] : []),
            ]}
          />
        </Card>
        <Card title="Pricing (indicative)">
          <KeyValues
            cols={2}
            items={[
              ["Cost / principal", pkr(pricing.cost)],
              ["Profit / rental", pkr(pricing.profit)],
              ["Total payable", pkr(pricing.totalPayable)],
              ["Instalments", `${pricing.instalments} × ${pkr(pricing.instalmentAmount)}`],
            ]}
          />
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
            <div>RM: {kase.rm.fullName}</div>
            <div>Submitted: {fmtDateTime(kase.submittedAt)}</div>
            <div className={kase.tatDueAt && kase.tatDueAt < new Date() && ["UNDER_REVIEW", "PENDING_APPROVAL"].includes(kase.stage) ? "font-medium text-bad" : ""}>
              TAT due ({parseSettings(tenant.settings).tatWorkingDays} working days, R-16): {fmtDate(kase.tatDueAt)}
            </div>
            <div>Sanctioned: {fmtDateTime(kase.sanctionedAt)}</div>
            <div>Accepted: {fmtDateTime(kase.acceptedAt)}</div>
            <div>Activated: {fmtDateTime(kase.activatedAt)}</div>
          </div>
        </Card>
      </div>

      {compliance && (
        <Card title="Regulatory & Shariah checks" actions={compliance.blocking ? <Badge tone="bad">Blocking issues</Badge> : <Badge tone="ok">No blocking issues</Badge>}>
          <ul className="divide-y divide-line">
            {compliance.regulatory.map((c) => (
              <li key={c.code} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
                <StatusBadge status={c.status} />
                <span className="w-44 shrink-0 font-medium">
                  {c.title} <span className="text-xs font-normal text-muted">({c.rule})</span>
                </span>
                <span className="min-w-0 flex-1 text-muted">{c.detail}</span>
              </li>
            ))}
            {compliance.shariah.map((s, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
                <StatusBadge status="FAIL" />
                <span className="w-44 shrink-0 font-medium">Shariah precondition</span>
                <span className="text-muted">{s}</span>
              </li>
            ))}
            {compliance.shariah.length === 0 && (
              <li className="flex items-start gap-3 py-2.5 text-sm">
                <StatusBadge status="PASS" />
                <span className="w-44 shrink-0 font-medium">Shariah preconditions</span>
                <span className="text-muted">All {product.name} structural preconditions satisfied.</span>
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card title={isBank ? "Case notes & customer messages" : "Messages with the bank"}>
        {comments.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          <ul className="mb-4 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.internal ? "border-line bg-surface-2" : "border-brand/20 bg-brand/5"}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <strong className="text-ink">{people[c.authorId]?.fullName}</strong> {roleLabel(people[c.authorId]?.role ?? "")} · {fmtDateTime(c.createdAt)}
                  {c.internal ? <Badge>internal</Badge> : <Badge tone="brand">shared with customer</Badge>}
                </div>
                {c.body}
              </li>
            ))}
          </ul>
        )}
        {actor.role !== "AUDITOR" && (
          <ActionForm action={commentAction.bind(null, kase.id)} submitLabel="Post" resetOnSuccess>
            <textarea name="body" rows={2} className="input" placeholder={isBank ? "Add a note…" : "Ask your Relationship Manager a question…"} required />
            {isBank && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="internal" defaultChecked /> Internal note (not visible to the customer)
              </label>
            )}
          </ActionForm>
        )}
      </Card>
    </div>
  );
}

// --- Clearances -------------------------------------------------------------------------

export function ClearancesTab({ actor, data }: P) {
  const { kase, people } = data;
  if (!kase.clearances.length) return <Empty>Clearances open when the RM submits the request.</Empty>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {kase.clearances.map((cl) => {
        const track = cl.track as Track;
        const mine = actor.role === TRACK_ROLE[track] && cl.status === "PENDING" && kase.stage === "UNDER_REVIEW";
        const checklist = JSON.parse(cl.checklist || "{}") as Record<string, boolean>;
        return (
          <Card key={cl.id} title={TRACK_LABELS[track]} actions={<StatusBadge status={cl.status} />}>
            {cl.status !== "PENDING" && (
              <div className="space-y-2 text-sm">
                <div className="text-muted">
                  {people[cl.decidedById ?? ""]?.fullName} · {fmtDateTime(cl.decidedAt)} · round {cl.round}
                </div>
                {cl.riskRating && <div>Risk rating: {cl.riskRating}</div>}
                <p>{cl.comments}</p>
                <ul className="space-y-1 text-xs text-muted">
                  {Object.entries(checklist).map(([k, v]) => (
                    <li key={k}>
                      {v ? "☑" : "☐"} {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {mine && (
              <ActionForm
                action={clearanceAction.bind(null, kase.id, track)}
                geo
                buttons={[
                  { label: "Clear", name: "decision", value: "CLEARED" },
                  { label: "Return to RM", name: "decision", value: "RETURNED", className: "btn" },
                ]}
              >
                <fieldset className="space-y-1.5">
                  {TRACK_CHECKLISTS[track].map((c) => (
                    <label key={c} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="checklist" value={c} className="mt-1" /> {c}
                    </label>
                  ))}
                </fieldset>
                {track === "CREDIT" && (
                  <select name="riskRating" className="input">
                    <option value="">Internal risk rating…</option>
                    {RISK_RATINGS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                )}
                <textarea name="comments" rows={3} className="input" placeholder="Assessment / reasons" required />
              </ActionForm>
            )}
            {cl.status === "PENDING" && !mine && <p className="text-sm text-muted">Awaiting {roleLabel(TRACK_ROLE[track])}.</p>}
          </Card>
        );
      })}
    </div>
  );
}

// --- Approvals ----------------------------------------------------------------------------

export function ApprovalsTab({ actor, data }: P) {
  const { kase, people } = data;
  if (!kase.approvals.length) return <Empty>The approval chain opens once all clearances are obtained.</Empty>;
  const current = kase.approvals.find((a) => a.status === "PENDING");
  const mine = current && kase.stage === "PENDING_APPROVAL" && current.role === actor.role && actor.userId !== kase.rmId;
  const rounds = [...new Set(kase.approvals.map((a) => a.round))];
  return (
    <div className="space-y-6">
      {rounds.map((r) => (
        <Card key={r} title={`Delegated authority — round ${r}`}>
          <ol className="space-y-3">
            {kase.approvals
              .filter((a) => a.round === r)
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-line p-3 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{a.level}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {roleLabel(a.role)} — {a.action === "RECOMMEND" ? "recommends" : "approves"}
                      {a.limit ? <span className="text-muted"> (limit {pkr(a.limit)})</span> : null}
                    </div>
                    {a.decidedAt && (
                      <div className="text-xs text-muted">
                        {people[a.decidedById ?? ""]?.fullName} · {fmtDateTime(a.decidedAt)} — {a.comments}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
          </ol>
        </Card>
      ))}
      {mine && (
        <Card title={`Your decision — level ${current.level}`}>
          <ActionForm
            action={approvalAction.bind(null, kase.id)}
            geo
            buttons={[
              { label: current.action === "RECOMMEND" ? "Recommend" : "Approve & sanction", name: "decision", value: "APPROVE" },
              { label: "Return to RM", name: "decision", value: "RETURN", className: "btn" },
              { label: "Decline", name: "decision", value: "REJECT", className: "btn btn-danger" },
            ]}
          >
            <textarea name="comments" rows={3} className="input" placeholder="Approval note / conditions" required />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

// --- Documents ----------------------------------------------------------------------------

export function DocumentsTab({ actor, data }: P) {
  const { kase } = data;
  const docs = kase.documents.filter((d) => d.status !== "VOID" || actor.kind === "BANK");
  if (!docs.length) return <Empty>Documents are generated from Shariah- and Legal-approved templates at sanction and as execution steps unlock.</Empty>;
  const ready = new Set(kase.steps.filter((s) => s.status === "READY").map((s) => s.key));
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Signatures</th>
              <th>Waiting for</th>
              <th>Hash</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const plan = JSON.parse(d.signerPlan) as SignerSlot[];
              const myTurn = isMyTurnToSign(actor, d, kase, !d.stepKey || ready.has(d.stepKey));
              return (
                <tr key={d.id}>
                  <td>
                    <Link href={`/documents/${d.id}`} className="link">
                      {d.title}
                    </Link>
                    <div className="text-xs text-muted">
                      v{d.version} · template v{d.template.version}
                    </div>
                  </td>
                  <td className="text-xs">
                    {plan.map((p, i) => {
                      const sig = d.signatures.find((s) => s.slot === i && s.decision === "SIGNED");
                      return (
                        <div key={i} className={sig ? "text-ok" : "text-muted"}>
                          {sig ? "✓" : "○"} {p.capacity}
                          {sig && ` — ${sig.signerName}`}
                        </div>
                      );
                    })}
                  </td>
                  <td className="text-xs">
                    {d.status === "ISSUED" ? (
                      myTurn ? (
                        <Badge tone="warn">You</Badge>
                      ) : d.stepKey && !ready.has(d.stepKey) ? (
                        <span className="text-muted">earlier steps</span>
                      ) : (
                        (plan[d.signatures.filter((x) => x.decision === "SIGNED").length]?.capacity ?? "—")
                      )
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <Hash value={d.contentHash} />
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>
                    {myTurn && (
                      <Link href={`/documents/${d.id}`} className="btn btn-primary btn-sm">
                        Review & sign
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// --- Evidence ----------------------------------------------------------------------------

export function EvidenceTab({ actor, data }: P) {
  const { kase, people } = data;
  const steps = Object.fromEntries(kase.steps.map((s) => [s.key, s]));
  if (!kase.evidence.length) return <Empty>No evidence captured yet. Evidence steps appear in the Execution tab as they unlock.</Empty>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {kase.evidence.map((e) => {
        const st = e.stepKey ? steps[e.stepKey] : undefined;
        const spec = st ? stepSpec(st).evidence : undefined;
        const canVerify = e.status === "SUBMITTED" && !!spec?.verifiers.includes(actor.role as never) && e.capturedById !== actor.userId;
        const preview = e.stampedFileId ?? e.fileId;
        const mime = (e.stampedFile ?? e.file).mimeType;
        const device = JSON.parse(e.device || "{}") as Record<string, string>;
        return (
          <Card key={e.id} title={<span className="text-sm">{e.description}</span>} actions={<StatusBadge status={e.status} />}>
            <div className="mb-3 overflow-hidden rounded-lg border border-line bg-surface-2">
              {mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${preview}`} alt={e.description} loading="lazy" className="max-h-64 w-full object-contain" />
              ) : mime.startsWith("video/") ? (
                <video src={`/api/files/${preview}`} controls preload="none" className="max-h-64 w-full" />
              ) : (
                <a href={`/api/files/${preview}`} target="_blank" className="link block p-4 text-sm">
                  Open {e.file.originalName}
                </a>
              )}
            </div>
            <KeyValues
              items={[
                ["Category", EVIDENCE_LABELS[e.category] ?? e.category],
                ["Step", st?.title ?? "General attachment"],
                ["Captured by", `${people[e.capturedById]?.fullName ?? "—"} (${roleLabel(people[e.capturedById]?.role ?? "")})`],
                ["Server time (trusted)", fmtDateTime(e.serverTime)],
                ["Device time", e.clientTime ? fmtDateTime(e.clientTime) : "—"],
                ["Location", <GeoLink key="g" lat={e.lat} lng={e.lng} accuracy={e.accuracy} />],
                ["Asset ref.", e.assetRef || "—"],
                ["Device / IP", `${device.platform ?? "—"} · ${device.network ?? ""} · ${e.ip}`],
                ["Original SHA-256", <Hash key="h" value={e.file.sha256} />],
                ["Stamped copy", e.stampedFile ? <Hash key="s" value={e.stampedFile.sha256} /> : "—"],
                ...(e.verifiedAt ? [["Verified", `${people[e.verifiedById ?? ""]?.fullName} · ${fmtDateTime(e.verifiedAt)} — ${e.verifyRemarks}`] as [string, string]] : []),
              ]}
            />
            <div className="mt-3 flex gap-2 text-xs">
              <a className="link" href={`/api/files/${e.fileId}?download`}>
                Download original
              </a>
            </div>
            {canVerify && spec && (
              <ActionForm
                action={verifyEvidenceAction.bind(null, e.id)}
                className="mt-4 border-t border-line pt-4"
                geo
                buttons={[
                  { label: "Verify", name: "decision", value: "VERIFIED" },
                  { label: "Reject", name: "decision", value: "REJECTED", className: "btn" },
                ]}
              >
                <fieldset className="space-y-1">
                  {spec.checklist.map((c) => (
                    <label key={c} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="checklist" value={c} className="mt-1" /> {c}
                    </label>
                  ))}
                </fieldset>
                <input name="remarks" className="input" placeholder="Verification remarks" required />
                <p className="text-xs text-muted">The step completes when the minimum number of items is verified with all checklist items confirmed.</p>
              </ActionForm>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// --- Schedule & monitoring --------------------------------------------------------------------

export function ScheduleTab({ actor, data }: P) {
  const { kase } = data;
  const product = getProduct(kase.productCode);
  const structure = JSON.parse(kase.structure) as Record<string, string>;
  const projected = !kase.schedule.length;
  const lines = projected
    ? buildSchedule({ model: product.pricing, amount: kase.amount, tenorMonths: kase.tenorMonths, profitRate: kase.profitRate, repayment: kase.repayment, startDate: new Date(), structure }).lines.map((l) => ({ ...l, id: String(l.seq), paidAmount: 0, status: "PROJECTED" }))
    : kase.schedule;
  const firstDue = kase.schedule.find((i) => i.status !== "PAID");
  const outstanding = kase.schedule.reduce((s, i) => s + (i.total - i.paidAmount), 0);
  const dm = product.pricing === "DM_UNITS";

  return (
    <div className="space-y-6">
      {kase.stage === "ACTIVE" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Classification (R-17)">
            <div className="flex items-center gap-3">
              <StatusBadge status={kase.classification === "REGULAR" ? "PASS" : "FAIL"} label={kase.classification.toLowerCase()} />
              <span className="text-sm text-muted">{kase.daysPastDue} days past due</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Provision rate before FSV benefit: {(PROVISION_RATE[kase.classification as Classification] * 100).toFixed(0)}% (Annexure I). Outstanding {pkr(outstanding)}.
            </p>
            {["OPERATIONS", "CREDIT_RISK"].includes(actor.role) && (
              <ActionForm action={dpdAction.bind(null, kase.id)} submitLabel="Update DPD" submitClass="btn btn-sm" className="mt-3">
                <input name="dpd" type="number" min={0} defaultValue={kase.daysPastDue} className="input" />
                <p className="text-xs text-muted">Normally fed nightly from core banking.</p>
              </ActionForm>
            )}
          </Card>
          {actor.role === "OPERATIONS" && firstDue && (
            <Card title={`Post repayment — instalment #${firstDue.seq}`} className="lg:col-span-2">
              <ActionForm action={repaymentAction.bind(null, firstDue.id)} submitLabel="Post receipt" geo>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="amount" type="number" step="0.01" defaultValue={(firstDue.total - firstDue.paidAmount).toFixed(2)} className="input" />
                  <input name="reference" placeholder="CBS receipt reference" className="input" required />
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      )}
      <Card title={projected ? "Projected schedule (fixed at execution)" : "Repayment schedule"}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Due</th>
                <th className="text-right">{dm ? "Unit price" : "Principal / cost"}</th>
                <th className="text-right">{dm ? "Rental" : product.pricing === "RENTAL" ? "Rental return" : "Profit"}</th>
                <th className="text-right">Instalment</th>
                {dm && <th className="text-right">Bank share after</th>}
                <th className="text-right">Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="tabular-nums">{l.seq}</td>
                  <td>{fmtDate(l.dueDate)}</td>
                  <td className="text-right tabular-nums">{pkr(l.principal)}</td>
                  <td className="text-right tabular-nums">{pkr(l.profit)}</td>
                  <td className="text-right font-medium tabular-nums">{pkr(l.total)}</td>
                  {dm && <td className="text-right tabular-nums">{l.bankShare.toFixed(2)}%</td>}
                  <td className="text-right tabular-nums">{l.paidAmount ? pkr(l.paidAmount) : "—"}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Late payments are directed to charity per the Shariah Board policy and do not form part of the bank&apos;s income.</p>
      </Card>
    </div>
  );
}

// --- Audit ------------------------------------------------------------------------------------

export async function AuditTab({ actor, data }: P) {
  const { kase } = data;
  const [events, chain] = await Promise.all([db.auditEvent.findMany({ where: { tenantId: actor.tenantId, caseId: kase.id }, orderBy: { seq: "asc" } }), verifyChain(actor.tenantId)]);
  return (
    <Card
      title={`Case audit trail — ${events.length} events`}
      actions={chain.ok ? <Badge tone="ok">Hash chain verified ({chain.checked} events)</Badge> : <Badge tone="bad">Chain broken at #{chain.brokenAtSeq}: {chain.reason}</Badge>}
    >
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>When (PKT)</th>
              <th>Who</th>
              <th>What</th>
              <th>Where / device</th>
              <th>Hashes</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.seq}</td>
                <td className="text-xs whitespace-nowrap">{fmtDateTime(e.occurredAt)}</td>
                <td className="text-xs">
                  <div className="font-medium">{e.actorName}</div>
                  <div className="text-muted">{roleLabel(e.actorRole)}</div>
                </td>
                <td className="text-sm">
                  <Badge tone="info">{e.eventType}</Badge>
                  <div className="mt-1">{e.summary}</div>
                </td>
                <td className="text-xs">
                  <GeoLink lat={e.lat} lng={e.lng} accuracy={e.accuracy} />
                  <div className="text-muted">{e.ip}</div>
                </td>
                <td className="text-xs">
                  {e.docHash && (
                    <div>
                      doc <Hash value={e.docHash} />
                    </div>
                  )}
                  <div>
                    evt <Hash value={e.hash} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
