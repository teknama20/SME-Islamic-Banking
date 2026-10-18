import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, StageBadge, Tabs } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { pkr } from "@/lib/pricing";
import { getProduct } from "@/lib/products/catalog";
import { can } from "@/lib/rbac";
import { SME_LABELS, type SmeCategory } from "@/lib/sbp";
import { ActionCentre } from "./action-centre";
import { ExecutionTab } from "./execution-tab";
import { loadCase } from "./load";
import { ApprovalsTab, AuditTab, ClearancesTab, DocumentsTab, EvidenceTab, OverviewTab, ScheduleTab, ShariahTab } from "./sections";

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; done?: string }> }) {
  const { id } = await params;
  const { tab = "overview", done } = await searchParams;
  const { actor } = await requireActor();
  const loaded = await loadCase(actor, id);
  if (!loaded) notFound();
  const { kase } = loaded;
  const product = getProduct(kase.productCode);
  const isBank = actor.kind === "BANK";

  const tabs = [
    { key: "overview", label: "Overview" },
    ...(isBank ? [{ key: "clearances", label: "Clearances", count: kase.clearances.filter((c) => c.status === "CLEARED").length }] : []),
    ...(isBank ? [{ key: "approvals", label: "Approvals" }] : []),
    { key: "documents", label: "Documents", count: kase.documents.filter((d) => d.status !== "VOID").length },
    { key: "execution", label: "Execution", count: kase.steps.length },
    { key: "evidence", label: "Evidence", count: kase.evidence.length },
    { key: "schedule", label: "Schedule" },
    ...(isBank ? [{ key: "shariah", label: kase.shariahReviewStatus === "PENDING" ? "Shariah review •" : "Shariah review" }] : []),
    ...(isBank ? [{ key: "audit", label: "Audit trail" }] : []),
  ];
  const current = tabs.some((t) => t.key === tab) ? tab : "overview";

  return (
    <>
      <PageHeader
        back={{ href: "/cases", label: "Cases" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {kase.ref} · {product.name} <span className="font-urdu text-xl font-normal text-muted">{product.nameUrdu}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StageBadge stage={kase.stage} />
            <span>
              <Link href={`/customers/${kase.customerId}`} className="link">
                {kase.customer.legalName}
              </Link>{" "}
              · {pkr(kase.amount)} · {kase.tenorMonths} months · {kase.profitRate}% p.a.
            </span>
            <Badge tone="brand">{SME_LABELS[kase.customer.smeCategory as SmeCategory]}</Badge>
            {kase.cptmNo && <span className="mono">{kase.cptmNo}</span>}
          </span>
        }
        actions={
          isBank && (
            <>
              <Link href={`/cases/${kase.id}/pack`} className="btn">
                Execution pack
              </Link>
              {(can(actor.role, "audit.view") || ["RCAD", "SHARIAH", "LEGAL", "OPERATIONS", "CREDIT_RISK"].includes(actor.role) || actor.userId === kase.rmId) && (
                <a href={`/api/cases/${kase.id}/bundle`} className="btn">
                  Evidence bundle (JSON)
                </a>
              )}
            </>
          )
        }
      />
      <ActionCentre actor={actor} kase={kase} done={done} />
      <Tabs base={`/cases/${kase.id}`} current={current} tabs={tabs} />
      {current === "overview" && <OverviewTab actor={actor} data={loaded} />}
      {current === "clearances" && <ClearancesTab actor={actor} data={loaded} />}
      {current === "approvals" && <ApprovalsTab actor={actor} data={loaded} />}
      {current === "documents" && <DocumentsTab actor={actor} data={loaded} />}
      {current === "execution" && <ExecutionTab actor={actor} data={loaded} />}
      {current === "evidence" && <EvidenceTab actor={actor} data={loaded} />}
      {current === "schedule" && <ScheduleTab actor={actor} data={loaded} />}
      {current === "shariah" && <ShariahTab actor={actor} data={loaded} />}
      {current === "audit" && <AuditTab actor={actor} data={loaded} />}
    </>
  );
}
