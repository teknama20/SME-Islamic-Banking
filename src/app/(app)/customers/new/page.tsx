import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { SECTORS } from "@/lib/sbp";
import { CustomerForm } from "./customer-form";

export default async function NewCustomerPage() {
  const { actor } = await requireActor();
  if (!can(actor.role, "customer.create")) redirect("/customers");
  return (
    <>
      <PageHeader title="Onboard SME customer" subtitle="End-to-end digital onboarding (SME PR R-14). Data captured here is reused across credit assessment." back={{ href: "/customers", label: "Customers" }} />
      <Card>
        <CustomerForm sectors={SECTORS} />
      </Card>
    </>
  );
}
