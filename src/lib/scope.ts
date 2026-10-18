// Data visibility: customer users see only their company; RMs their own
// book; hierarchy heads their org subtree; control functions the whole bank.
import type { Prisma } from "@prisma/client";
import type { Actor } from "./actor";
import { AccessError, TENANT_WIDE_ROLES, type BankRole } from "./rbac";

export function caseScope(actor: Actor): Prisma.FinancingCaseWhereInput {
  const base: Prisma.FinancingCaseWhereInput = { tenantId: actor.tenantId };
  if (actor.kind === "CUSTOMER") return { ...base, customerId: actor.customerId ?? "__none__" };
  if (TENANT_WIDE_ROLES.includes(actor.role as BankRole)) return base;
  if (actor.role === "RM") return { ...base, rmId: actor.userId };
  return { ...base, orgPath: { startsWith: actor.orgPath ?? "__none__" } };
}

export function customerScope(actor: Actor): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = { tenantId: actor.tenantId };
  if (actor.kind === "CUSTOMER") return { ...base, id: actor.customerId ?? "__none__" };
  if (TENANT_WIDE_ROLES.includes(actor.role as BankRole)) return base;
  if (actor.role === "RM") return { ...base, rmId: actor.userId };
  return { ...base, orgPath: { startsWith: actor.orgPath ?? "__none__" } };
}

export function canSeeCase(actor: Actor, c: { tenantId: string; customerId: string; rmId: string; orgPath: string }): boolean {
  if (c.tenantId !== actor.tenantId) return false;
  if (actor.kind === "CUSTOMER") return c.customerId === actor.customerId;
  if (TENANT_WIDE_ROLES.includes(actor.role as BankRole)) return true;
  if (actor.role === "RM") return c.rmId === actor.userId;
  return !!actor.orgPath && c.orgPath.startsWith(actor.orgPath);
}

export function assertCaseAccess(actor: Actor, c: { tenantId: string; customerId: string; rmId: string; orgPath: string }) {
  if (!canSeeCase(actor, c)) throw new AccessError("This case is outside your portfolio.");
}
