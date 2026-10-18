import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader, StatusBadge, fmtDate } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";

export default async function TemplatesPage() {
  const { actor } = await requireActor();
  if (!(can(actor.role, "template.author") || can(actor.role, "template.shariah") || can(actor.role, "template.legal"))) redirect("/dashboard");
  const templates = await db.template.findMany({ where: { tenantId: actor.tenantId }, orderBy: [{ code: "asc" }, { version: "desc" }] });
  return (
    <>
      <PageHeader title="Document templates" subtitle="Version-controlled model agreements. A version can generate documents only after Shariah Board and Legal approval (SBP: model agreements may be modified only with Shariah approval)." />
      <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
        The seeded templates are structured drafts for demonstration. Replace them with your Shariah Board- and Legal-vetted texts before production use.
      </div>
      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Version</th>
              <th>Shariah</th>
              <th>Legal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/admin/templates/${t.id}`} className="link">
                    {t.title}
                  </Link>
                  <div className="mono text-muted">{t.code}</div>
                </td>
                <td>v{t.version}</td>
                <td className="text-xs">{t.shariahApprovedAt ? `${fmtDate(t.shariahApprovedAt)} — ${t.shariahRef}` : "pending"}</td>
                <td className="text-xs">{t.legalApprovedAt ? `${fmtDate(t.legalApprovedAt)} — ${t.legalRef}` : "pending"}</td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
