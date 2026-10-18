import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { PRODUCTS } from "@/lib/products/catalog";

/** Generic lifecycle with the stakeholder sign-off arrangement (R = responsible, A = approves / signs, C = consulted, I = informed). */
const LIFECYCLE: { stage: string; what: string; raci: Record<string, string> }[] = [
  { stage: "1. Onboarding", what: "Digital KYC/CDD, geo-tagged premises, UBOs, e-CIB (R-7), related-party (R-11), SBP SME classification", raci: { RCAD: "A", RM: "R", Customer: "C" } },
  { stage: "2. Financing request", what: "Standardised application (R-6), Shariah preconditions and R-5/R-9/R-13 checks run automatically; CPTM number & customer acknowledgement (R-19)", raci: { RM: "R", Customer: "C" } },
  { stage: "3. Review", what: "RCAD (KYC/AML, documentation) and Credit (rating, security) review in parallel; Trade / Legal can be enabled per bank", raci: { RCAD: "A", "Credit/Risk": "A", RM: "C" } },
  { stage: "4. Approval", what: "Delegated authority by amount: TL recommends → UH → RH → CH", raci: { "Team Leader": "A", "Unit Head": "A", "Regional/Country Head": "A", RM: "I" } },
  { stage: "5. Documentation loop", what: "For every document: RCAD prepares → RM / TL / UH sign → Customer (or Guarantor) signs → RCAD / RM verifies. Offer & Key Fact Statement first, then each product agreement in Shariah order", raci: { RCAD: "R", RM: "A", "Team Leader": "A", "Unit Head": "A", Customer: "A" } },
  { stage: "6. Evidence loop", what: "Customer / RM capture geo-tagged purchase, possession and delivery evidence → RCAD / RM verify (never the capturer)", raci: { Customer: "R", RM: "R", RCAD: "A" } },
  { stage: "7. Disbursement", what: "RCAD prepares payment to supplier / vendor (maker) → Team Leader / Unit Head authorises (checker); capped at the sanctioned amount", raci: { RCAD: "R", "Team Leader": "A", "Unit Head": "A", RM: "I" } },
  { stage: "8. Activation & monitoring", what: "RCAD books the facility; repayments, DPD → classification & provisioning (R-17), restructuring (R-18)", raci: { RCAD: "R", "Credit/Risk": "C", Customer: "R", RM: "I" } },
  { stage: "9. Shariah review (final)", what: "After disbursement Shariah reviews the complete file: sequence, possession evidence, executed documents, pricing — compliant or rectification + charity purification", raci: { Shariah: "A", RCAD: "C", RM: "I" } },
  { stage: "10. Audit", what: "Read-only case files, hash-chain verification, execution pack & evidence bundle", raci: { "Internal Audit": "A" } },
];

const STAKEHOLDERS = ["RCAD", "RM", "Team Leader", "Unit Head", "Regional/Country Head", "Credit/Risk", "Customer", "Shariah", "Internal Audit"];

export default async function ProductsPage() {
  await requireActor();
  return (
    <>
      <PageHeader title="Products & workflows" subtitle="Shariah-compliant SME financing modes, their transaction workflows and the digital sign-off arrangement — the same definitions the workflow engine enforces." />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PRODUCTS.map((p) => (
          <Link key={p.code} href={`/products/${p.code}`} className="card block transition hover:border-brand">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{p.name}</div>
              <span className="font-urdu text-lg text-muted">{p.nameUrdu}</span>
            </div>
            <Badge tone="brand">{p.family}</Badge>
            <p className="mt-2 line-clamp-4 text-sm text-muted">{p.summary}</p>
            <div className="mt-3 text-xs text-muted">
              {p.documents.length + 2} documents · {p.aaoifi[0]}
            </div>
          </Link>
        ))}
      </div>

      <Card title="End-to-end lifecycle & stakeholder sign-off (RACI)">
        <div className="overflow-x-auto">
          <table className="table text-xs">
            <thead>
              <tr>
                <th className="min-w-56">Stage</th>
                {STAKEHOLDERS.map((s) => (
                  <th key={s} className="text-center whitespace-nowrap">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIFECYCLE.map((l) => (
                <tr key={l.stage}>
                  <td>
                    <div className="font-medium">{l.stage}</div>
                    <div className="text-muted">{l.what}</div>
                  </td>
                  {STAKEHOLDERS.map((s) => (
                    <td key={s} className="text-center">
                      {l.raci[s] && <Badge tone={l.raci[s] === "A" ? "ok" : l.raci[s] === "R" ? "brand" : "neutral"}>{l.raci[s]}</Badge>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">A = approves / signs off · R = performs · C = consulted · I = informed. Every action is time-stamped (server time, PKT), geo-tagged where the device permits, and chained into the tamper-evident audit trail.</p>
      </Card>
    </>
  );
}
