import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { EVIDENCE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { stepSpec } from "@/lib/engine/execution";
import { roleLabel } from "@/lib/rbac";
import { canSeeCase } from "@/lib/scope";
import { EvidenceCapture } from "./evidence-capture";

export default async function CapturePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
  const { actor, session } = await requireActor();
  const kase = await db.financingCase.findFirst({ where: { id, tenantId: actor.tenantId }, include: { steps: true } });
  if (!kase || !canSeeCase(actor, kase)) notFound();
  const st = step ? kase.steps.find((s) => s.key === step) : undefined;
  const spec = st ? stepSpec(st).evidence : undefined;
  const categories = (spec?.categories ?? (Object.keys(EVIDENCE_LABELS) as string[])).map((c) => ({ value: c, label: EVIDENCE_LABELS[c] ?? c }));

  return (
    <>
      <PageHeader back={{ href: `/cases/${id}?tab=execution`, label: kase.ref }} title="Capture evidence" subtitle={st ? `${st.title} — ${st.status === "READY" ? "open" : "not yet open"}` : "General case attachment"} />
      <EvidenceCapture
        caseId={kase.id}
        caseRef={kase.ref}
        stepKey={st?.key}
        stepTitle={st?.title ?? "Case attachment"}
        categories={categories}
        requireGps={spec?.requireGps ?? false}
        checklist={spec?.checklist ?? []}
        userLabel={`${session.user.fullName} · ${roleLabel(actor.role)}`}
      />
    </>
  );
}
