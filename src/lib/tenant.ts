// Per-bank configuration (white-label): approval matrix, security policy, TAT.
import type { BankRole } from "./rbac";

export type ApprovalLevel = { role: BankRole; limit: number | null };

export type TenantSettings = {
  /** Delegated authority, lowest first. The first level always recommends. */
  approvalMatrix: ApprovalLevel[];
  /** Clean facilities above this amount need at least `cleanMinApprover`. */
  cleanEscalationAmount: number;
  cleanMinApprover: BankRole;
  /** Credit/Risk concurrence is always required; Trade only where the product needs it. */
  mfaRequired: boolean;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  maxFailedLogins: number;
  otpTtlSeconds: number;
  /** "screen" shows OTPs on screen for demos; "sms" would call the bank's SMS gateway. */
  otpDelivery: "screen" | "sms";
  tatWorkingDays: number;
  publicHolidays: string[];
  helpline: string;
};

export const DEFAULT_SETTINGS: TenantSettings = {
  approvalMatrix: [
    { role: "TEAM_LEADER", limit: 0 },
    { role: "UNIT_HEAD", limit: 25_000_000 },
    { role: "REGIONAL_HEAD", limit: 100_000_000 },
    { role: "COUNTRY_HEAD", limit: 500_000_000 },
  ],
  cleanEscalationAmount: 10_000_000,
  cleanMinApprover: "REGIONAL_HEAD",
  mfaRequired: true,
  sessionIdleMinutes: 15,
  sessionMaxHours: 10,
  maxFailedLogins: 5,
  otpTtlSeconds: 300,
  otpDelivery: "screen",
  tatWorkingDays: 15,
  publicHolidays: ["2026-02-05", "2026-03-23", "2026-05-01", "2026-08-14", "2026-11-09", "2026-12-25"],
  helpline: "111-000-SME",
};

export function parseSettings(json: string | null | undefined): TenantSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(json || "{}") as Partial<TenantSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Builds the approval chain for an amount: every level up to (and including)
 * the first one whose limit covers the amount. Lower levels recommend; the
 * last level approves.
 */
export function approvalChain(settings: TenantSettings, amount: number, clean: boolean): { role: BankRole; action: "RECOMMEND" | "APPROVE"; limit: number | null }[] {
  const matrix = settings.approvalMatrix;
  let idx = matrix.findIndex((l, i) => i > 0 && (l.limit === null || amount <= l.limit));
  if (idx === -1) idx = matrix.length - 1;
  if (clean && amount > settings.cleanEscalationAmount) {
    const min = matrix.findIndex((l) => l.role === settings.cleanMinApprover);
    if (min > idx) idx = min;
  }
  return matrix.slice(0, idx + 1).map((l, i) => ({ role: l.role, action: i === idx ? "APPROVE" : "RECOMMEND", limit: l.limit }));
}
