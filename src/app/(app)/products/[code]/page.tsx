import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { EVIDENCE_LABELS } from "@/lib/constants";
import { PRODUCTS, allDocSpecs, buildExecutionPlan } from "@/lib/products/catalog";
import type { StepSpec } from "@/lib/products/types";
import { roleLabel } from "@/lib/rbac";

function actors(s: StepSpec, signers: Record<string, string[]>) {
  if (s.kind === "SIGN") return signers[s.docCode!] ?? [];
  if (s.kind === "EVIDENCE") return [`Capture: ${s.evidence!.capturers.map(roleLabel).join(", ")}`, `Verify: ${s.evidence!.verifiers.map(roleLabel).join(", ")}`];
  if (s.kind === "ACTION") return [s.action!.roles.map(roleLabel).join(", ") + (s.action!.effect === "DISBURSE" ? " (maker) → Operations / Unit Head (checker)" : "")];
  return s.check!.roles.map(roleLabel);
}

export default async function ProductPage({ params }: { params: Promise<{ code: string }> }) {
  await requireActor();
  const { code } = await params;
  const p = PRODUCTS.find((x) => x.code === code);
  if (!p) notFound();
  const sample = { amount: 10_000_000, tenorMonths: 24, profitRate: 15, repayment: p.repaymentOptions[0], securityType: "SECURED", structure: { guarantorName: "Guarantor", milestones: "2", purchaseMode: "CUSTOMER_AGENT" } };
  const plan = buildExecutionPlan(p, sample);
  const docs = allDocSpecs(p);
  const signers = Object.fromEntries(docs.map((d) => [d.code, d.signers.map((s, i) => `${i + 1}. ${s.capacity}${s.roles ? ` (${s.roles.map(roleLabel).join(" / ")})` : ""}`)]));

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Products & workflows" }}
        title={
          <span>
            {p.name} <span className="font-urdu text-xl font-normal text-muted">{p.nameUrdu}</span>
          </span>
        }
        subtitle={p.summary}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Shariah rules enforced">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {p.shariahRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
        <Card title="Standards & references">
          <div className="space-y-3 text-sm">
            <div>
              <div className="label">AAOIFI</div>
              {p.aaoifi.map((a) => (
                <div key={a}>{a}</div>
              ))}
            </div>
            <div>
              <div className="label">SBP</div>
              {p.sbp.map((a) => (
                <div key={a}>{a}</div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Use cases & terms">
          <div className="mb-3 flex flex-wrap gap-1">
            {p.useCases.map((u) => (
              <Badge key={u}>{u}</Badge>
            ))}
          </div>
          <div className="text-sm">Repayment: {p.repaymentOptions.join(", ")}</div>
          <div className="text-sm">Max tenor: {p.maxTenorMonths} months</div>
          <div className="text-sm">Trade clearance: {p.requiresTrade ? "required" : "not required"}</div>
          <div className="mt-2 text-xs text-muted">Data captured: {p.fields.map((f) => f.label).join(" · ")}</div>
        </Card>
      </div>

      <Card title="Documents & signing order" className="mt-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Signers (strict order)</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.code}>
                  <td className="font-medium">
                    {d.title}
                    {d.offPlatformCounterparty && <div className="text-xs font-normal text-muted">+ {d.offPlatformCounterparty} signs off-platform; signed copy uploaded and verified</div>}
                  </td>
                  <td className="text-sm">
                    {signers[d.code].map((s) => (
                      <div key={s}>{s}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Offer Letter and Key Fact Statement are common to all products. The Personal Guarantee applies when a guarantor is named, and the charge documents apply to secured facilities.</p>
      </Card>

      <Card title="Execution sequence (enforced by the workflow engine)" className="mt-6">
        <ol className="space-y-3">
          {plan.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-brand text-xs text-white">{i + 1}</span>
                <span className="font-medium">{s.title}</span>
                <Badge>{s.kind}</Badge>
                {s.action?.effect === "DISBURSE" && <Badge tone="warn">Payment — maker/checker</Badge>}
                {s.evidence?.requireGps && <Badge tone="info">GPS mandatory</Badge>}
              </div>
              <div className="mt-1 text-sm">{actors(s, signers).join(" · ")}</div>
              {s.evidence && (
                <div className="mt-1 text-xs text-muted">
                  Evidence: {s.evidence.categories.map((c) => EVIDENCE_LABELS[c]).join(", ")} (min {s.evidence.minItems}) — checks: {s.evidence.checklist.join("; ")}
                </div>
              )}
              {s.check && <div className="mt-1 text-xs text-muted">Checklist: {s.check.checklist.join("; ")}</div>}
              {s.note && <div className="mt-1 text-xs text-muted">{s.note}</div>}
              {s.dependsOn.length > 0 && <div className="mt-1 text-xs text-muted">Unlocks after: {s.dependsOn.map((d) => plan.find((x) => x.key === d)?.title ?? d).join(", ")}</div>}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
