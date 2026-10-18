import { notFound } from "next/navigation";
import { approveTemplateAction, newTemplateVersionAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { renderMarkdown } from "@/lib/render";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireActor();
  const t = await db.template.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!t) notFound();
  const draft = t.status === "DRAFT";
  const notAuthor = t.createdById !== actor.userId;

  return (
    <>
      <PageHeader back={{ href: "/admin/templates", label: "Templates" }} title={`${t.title} — v${t.version}`} subtitle={<StatusBadge status={t.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Preview (placeholders shown as missing)">
          <article className="doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(t.body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, "[[MISSING: $1]]")) }} />
        </Card>
        <div className="space-y-6">
          {draft && notAuthor && can(actor.role, "template.shariah") && !t.shariahApprovedAt && (
            <Card title="Shariah approval">
              <ActionForm action={approveTemplateAction.bind(null, t.id, "SHARIAH")} submitLabel="Approve (Shariah)" geo>
                <input name="ref" placeholder="Shariah Board resolution / fatwa ref." className="input" required />
              </ActionForm>
            </Card>
          )}
          {draft && notAuthor && can(actor.role, "template.legal") && !t.legalApprovedAt && (
            <Card title="Legal approval">
              <ActionForm action={approveTemplateAction.bind(null, t.id, "LEGAL")} submitLabel="Approve (Legal)" geo>
                <input name="ref" placeholder="Legal vetting memo ref." className="input" required />
              </ActionForm>
            </Card>
          )}
          {can(actor.role, "template.author") && t.status !== "RETIRED" && (
            <Card title="Draft a new version">
              <ActionForm action={newTemplateVersionAction.bind(null, t.id)} submitLabel="Save as new draft version">
                <textarea name="body" defaultValue={t.body} rows={22} className="input font-mono text-xs" />
                <p className="text-xs text-muted">
                  Markdown subset: #, ##, lists, | tables |, **bold**, &gt; quotes, and <code>:::urdu … :::</code> for right-to-left Urdu blocks. Placeholders like {"{{case.amount}}"}.
                </p>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
