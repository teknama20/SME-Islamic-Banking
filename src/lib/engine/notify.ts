import type { Tx } from "../db";
import { TENANT_WIDE_ROLES, type BankRole } from "../rbac";

/**
 * Users holding one of `roles`. Hierarchy roles are restricted to the case's
 * org subtree (their org unit must be an ancestor of the case's team), and the
 * RM role always means the case's own Relationship Manager.
 */
export async function usersForRoles(tx: Tx, tenantId: string, roles: string[], kase?: { orgPath: string; rmId?: string } | string) {
  const scope = typeof kase === "string" ? { orgPath: kase } : kase;
  const users = await tx.user.findMany({
    where: { tenantId, role: { in: roles }, status: "ACTIVE", kind: "BANK" },
    include: { orgUnit: true },
  });
  return users.filter((u) => {
    if (!scope) return true;
    if (u.role === "RM" && scope.rmId) return u.id === scope.rmId;
    return TENANT_WIDE_ROLES.includes(u.role as BankRole) || (!!u.orgUnit && scope.orgPath.startsWith(u.orgUnit.path));
  });
}

export async function customerUsers(tx: Tx, customerId: string, roles?: string[]) {
  return tx.user.findMany({ where: { customerId, status: "ACTIVE", ...(roles ? { role: { in: roles } } : {}) } });
}

export async function notify(tx: Tx, tenantId: string, userIds: string[], title: string, body: string, link: string) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await tx.notification.createMany({ data: unique.map((userId) => ({ tenantId, userId, title, body, link })) });
}
