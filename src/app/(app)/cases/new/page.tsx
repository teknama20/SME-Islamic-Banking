import Link from "next/link";
import { redirect } from "next/navigation";
import { createCaseAction } from "@/app/actions/workflow";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { customerScope } from "@/lib/scope";
import { CaseForm } from "../case-form";
import { productOptions } from "../products";

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ customer?: string; product?: string }> }) {
  const { actor } = await requireActor();
  if (!can(actor.role, "case.create")) redirect("/cases");
  const sp = await searchParams;
  const customers = await db.customer.findMany({ where: { ...customerScope(actor), rmId: actor.userId }, orderBy: { legalName: "asc" } });

  return (
    <>
      <PageHeader title="New financing request" subtitle="Standardised SME application (SME PR R-6). Saved as a draft until you submit." back={{ href: "/cases", label: "Cases" }} />
      <Card>
        {customers.length === 0 ? (
          <Empty>
            You have no customers yet. <Link href="/customers/new" className="link">Onboard a customer</Link> first.
          </Empty>
        ) : (
          <CaseForm
            action={createCaseAction}
            customers={customers.map((c) => ({ id: c.id, label: `${c.legalName} (${c.cif})${c.kycStatus !== "CLEARED" ? " — KYC pending" : ""}` }))}
            products={productOptions}
            defaults={{ customerId: sp.customer, productCode: sp.product }}
          />
        )}
      </Card>
    </>
  );
}
