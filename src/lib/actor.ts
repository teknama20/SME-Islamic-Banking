// The authenticated principal plus request forensics (IP, device, GPS).
// Every engine operation receives an Actor so that business logic is
// independent of the HTTP layer and every audit event is fully attributed.

export type Geo = { lat: number; lng: number; accuracy?: number | null };

export type Actor = {
  tenantId: string;
  userId: string;
  name: string;
  role: string;
  kind: "BANK" | "CUSTOMER" | "SYSTEM";
  orgUnitId?: string | null;
  orgPath?: string | null;
  customerId?: string | null;
  approvalLimit?: number | null;
  ip?: string;
  userAgent?: string;
  geo?: Geo | null;
  device?: Record<string, unknown>;
};

export function systemActor(tenantId: string): Actor {
  return { tenantId, userId: "system", name: "System", role: "SYSTEM", kind: "SYSTEM" };
}

export function parseGeo(lat: unknown, lng: unknown, accuracy?: unknown): Geo | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || (la === 0 && ln === 0) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  const acc = Number(accuracy);
  return { lat: la, lng: ln, accuracy: Number.isFinite(acc) ? acc : null };
}
