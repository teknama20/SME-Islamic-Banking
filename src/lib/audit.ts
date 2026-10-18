// Tamper-evident audit trail.
//
// Each event stores prevHash and hash = SHA-256(canonical(event incl. prevHash)),
// forming a per-tenant hash chain. The AuditEvent table additionally has
// database triggers that reject UPDATE and DELETE (see prisma/migrations).
// Any edit to a historical row, or removal of a row, breaks verification.
import type { AuditEvent } from "@prisma/client";
import type { Actor } from "./actor";
import { canonicalJson, sha256 } from "./crypto";
import { db, type Tx } from "./db";

export const GENESIS_HASH = "0".repeat(64);

export type AuditInput = {
  eventType: string;
  action: string;
  summary: string;
  caseId?: string | null;
  customerId?: string | null;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  docHash?: string;
};

function stringify(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  return typeof v === "string" ? v : canonicalJson(v);
}

type HashFields = Omit<AuditEvent, "id" | "hash">;

export function computeAuditHash(e: HashFields): string {
  return sha256(
    canonicalJson({
      tenantId: e.tenantId,
      seq: e.seq,
      eventType: e.eventType,
      action: e.action,
      summary: e.summary,
      caseId: e.caseId ?? null,
      customerId: e.customerId ?? null,
      entityType: e.entityType,
      entityId: e.entityId,
      actorId: e.actorId ?? null,
      actorName: e.actorName,
      actorRole: e.actorRole,
      before: e.before,
      after: e.after,
      docHash: e.docHash,
      ip: e.ip,
      userAgent: e.userAgent,
      lat: e.lat ?? null,
      lng: e.lng ?? null,
      accuracy: e.accuracy ?? null,
      occurredAt: new Date(e.occurredAt).toISOString(),
      prevHash: e.prevHash,
    }),
  );
}

/** Appends one event to the tenant chain. Call inside the business transaction. */
export async function audit(tx: Tx, actor: Actor, input: AuditInput): Promise<AuditEvent> {
  const last = await tx.auditEvent.findFirst({
    where: { tenantId: actor.tenantId },
    orderBy: { seq: "desc" },
    select: { seq: true, hash: true },
  });
  const fields: HashFields = {
    tenantId: actor.tenantId,
    seq: (last?.seq ?? 0) + 1,
    eventType: input.eventType,
    action: input.action,
    summary: input.summary,
    caseId: input.caseId ?? null,
    customerId: input.customerId ?? null,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? "",
    actorId: actor.kind === "SYSTEM" ? null : actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    before: stringify(input.before),
    after: stringify(input.after),
    docHash: input.docHash ?? "",
    ip: actor.ip ?? "",
    userAgent: (actor.userAgent ?? "").slice(0, 400),
    lat: actor.geo?.lat ?? null,
    lng: actor.geo?.lng ?? null,
    accuracy: actor.geo?.accuracy ?? null,
    occurredAt: new Date(),
    prevHash: last?.hash ?? GENESIS_HASH,
  };
  return tx.auditEvent.create({ data: { ...fields, hash: computeAuditHash(fields) } });
}

/** Convenience for audit-only events outside a business transaction. */
export async function auditNow(actor: Actor, input: AuditInput): Promise<AuditEvent> {
  return db.$transaction((tx) => audit(tx, actor, input));
}

export type ChainVerification = {
  ok: boolean;
  checked: number;
  brokenAtSeq?: number;
  reason?: string;
  headHash?: string;
};

/** Re-computes the whole tenant chain and reports the first break, if any. */
export async function verifyChain(tenantId: string): Promise<ChainVerification> {
  const events = await db.auditEvent.findMany({ where: { tenantId }, orderBy: { seq: "asc" } });
  let prev = GENESIS_HASH;
  let expectedSeq = 1;
  for (const e of events) {
    if (e.seq !== expectedSeq) return { ok: false, checked: expectedSeq - 1, brokenAtSeq: expectedSeq, reason: `Event #${expectedSeq} is missing` };
    if (e.prevHash !== prev) return { ok: false, checked: e.seq - 1, brokenAtSeq: e.seq, reason: "Link to previous event does not match" };
    if (computeAuditHash(e) !== e.hash) return { ok: false, checked: e.seq - 1, brokenAtSeq: e.seq, reason: "Event content has been altered" };
    prev = e.hash;
    expectedSeq++;
  }
  return { ok: true, checked: events.length, headHash: prev };
}
