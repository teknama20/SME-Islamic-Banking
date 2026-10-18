import { notFound, redirect } from "next/navigation";
import { updateCaseAction } from "@/app/actions/workflow";
import { Card, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { CaseForm } from "../../case-form";
import { productOptions } from "../../products";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireActor();
  const c = await db.financingCase.findFirst({ where: { id, tenantId: actor.tenantId }, include: { customer: true } });
  if (!c) notFound();
  if (c.rmId !== actor.userId || !["DRAFT", "RETURNED"].includes(c.stage)) redirect(`/cases/${id}`);
  return (
    <>
      <PageHeader title={`Edit ${c.ref}`} subtitle="All amendments are recorded with before/after values in the audit trail." back={{ href: `/cases/${id}`, label: c.ref }} />
      <Card>
        <CaseForm
          action={updateCaseAction.bind(null, id)}
          customers={[{ id: c.customerId, label: c.customer.legalName }]}
          products={productOptions}
          editing
          defaults={{ ...c, structure: JSON.parse(c.structure) }}
        />
      </Card>
    </>
  );
}
