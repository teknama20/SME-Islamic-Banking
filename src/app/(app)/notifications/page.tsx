import Link from "next/link";
import { markAllReadAction } from "@/app/actions/workflow";
import { ActionForm } from "@/components/action-form";
import { Card, Empty, PageHeader, fmtDateTime } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NotificationsPage() {
  const { actor } = await requireActor();
  const items = await db.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Notifications" subtitle="In-app alerts. In production these are also sent by SMS / e-mail through the bank's gateways." actions={actor.role !== "AUDITOR" && <ActionForm action={markAllReadAction} submitLabel="Mark all read" submitClass="btn" />} />
      <Card>
        {items.length === 0 ? (
          <Empty>No notifications.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className={`py-3 ${n.readAt ? "opacity-60" : ""}`}>
                <Link href={n.link || "#"} className="block hover:text-brand">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{n.title}</span>
                    <span className="text-xs whitespace-nowrap text-muted">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <div className="text-sm text-muted">{n.body}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
