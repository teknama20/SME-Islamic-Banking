import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { PRODUCTS } from "@/lib/products/catalog";

/** Generic lifecycle with the stakeholder sign-off arrangement (R = responsible, A = approves / signs, C = consulted, I = informed). */
const LIFECYCLE: { stage: string; what: string; raci: Record<string, string> }[] = [
  { stage: "1. Onboarding", what: "Digital KYC/CDD, geo-tagged premises, UBOs, e-CIB (R-7), related-party (R-11), SBP SME classification", raci: { RM: "R", Customer: "C", RCAD: "A", "Credit/Risk": "I" } },
  { stage: "2. Financing request", what: "Standardised application (R-6), product structure, Shariah preconditions, R-5/R-9/R-13 checks, CPTM number & auto-acknowledgement (R-19)", raci: { RM: "R", Customer: "C", "Team Leader": "I" } },
  { stage: "3. Parallel clearances", what: "RCAD (KYC/AML), Credit (rating, score, security), Trade (supplier/contractor), Shariah (mode & sequence), Legal (capacity, security) — 15-working-day TAT (R-16)", raci: { RCAD: "A", "Credit/Risk": "A", Trade: "A", Shariah: "A", Legal: "A", RM: "C" } },
  { stage: "4. Delegated approval", what: "Matrix by amount: TL recommends → UH → RH → CH; maker ≠ checker; regional scope; personal limits", raci: { "Team Leader": "A", "Unit Head": "A", "Regional Head": "A", "Country Head": "A", RM: "I" } },
  { stage: "5. Sanction & offer", what: "Offer letter + bilingual Key Fact Statement (R-12) generated from approved templates; bank signatory signs; RM issues", raci: { "Unit Head": "A", RM: "R", Customer: "I" } },
  { stage: "6. Acceptance", what: "Customer signs offer and acknowledges KFS with OTP + typed name + GPS; or declines with reason", raci: { Customer: "A", RM: "I" } },
  { stage: "7. Documentation & execution", what: "Product-specific sequence: agreements, guarantees, security, purchase/possession evidence, Shariah checks — each signature sealed to the document hash", raci: { Customer: "A", Guarantor: "A", "Unit Head": "A", Operations: "R", Shariah: "A", Legal: "R", Trade: "R", RCAD: "C" } },
  { stage: "8. Disbursement", what: "Payment to supplier/vendor/contractor — Operations maker initiates, second officer authorises; capped at sanctioned amount", raci: { Operations: "R", "Unit Head": "A", RM: "I" } },
  { stage: "9. Activation & monitoring", what: "Schedule booked; repayments; DPD → classification & provisioning (R-17, Annexure I/II); restructuring rules (R-18)", raci: { Operations: "R", "Credit/Risk": "A", Customer: "R", RM: "I" } },
  { stage: "10. Audit", what: "Read-only access to case files, hash-chain verification, execution pack & evidence bundle export", raci: { "Internal Audit": "A", Shariah: "C" } },
];

const STAKEHOLDERS = ["RM", "Team Leader", "Unit Head", "Regional Head", "Country Head", "RCAD", "Credit/Risk", "Trade", "Shariah", "Legal", "Operations", "Customer", "Guarantor", "Internal Audit"];

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
