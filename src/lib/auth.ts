// Session management (server-side sessions, opaque httpOnly cookie).
//   - scrypt passwords, account lockout after N failures
//   - second factor (OTP) before the session is usable
//   - idle timeout and absolute lifetime enforced server-side
//   - every login, failure, lockout and logout is audited
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "./actor";
import { audit, auditNow } from "./audit";
import { generateOtp, hashOtp, randomToken, safeEqualHex, sha256, verifyPassword } from "./crypto";
import { db } from "./db";
import { RuleError } from "./rbac";
import { parseSettings } from "./tenant";

const COOKIE = "sme_session";

export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  return { ip, userAgent: h.get("user-agent") ?? "" };
}

export type LoginResult = { ok: true; mfa: boolean; devCode?: string } | { ok: false; error: string };

export async function login(tenantCode: string, username: string, password: string): Promise<LoginResult> {
  const meta = await requestMeta();
  const tenant = await db.tenant.findUnique({ where: { code: tenantCode.trim().toUpperCase() } });
  const generic = { ok: false as const, error: "Invalid bank code, username or password." };
  if (!tenant || !tenant.active) return generic;
  const settings = parseSettings(tenant.settings);
  const user = await db.user.findUnique({ where: { tenantId_username: { tenantId: tenant.id, username: username.trim().toLowerCase() } } });
  const sys = { tenantId: tenant.id, userId: "system", name: "System", role: "SYSTEM", kind: "SYSTEM" as const, ...meta };

  if (!user) {
    await auditNow(sys, { eventType: "LOGIN_FAILED", action: "LOGIN", summary: `Failed login for unknown user "${username.slice(0, 40)}"` });
    return generic;
  }
  if (user.status !== "ACTIVE") {
    await auditNow(sys, { eventType: "LOGIN_BLOCKED", action: "LOGIN", summary: `Login attempt on ${user.status.toLowerCase()} account ${user.username}`, entityType: "User", entityId: user.id });
    return { ok: false, error: "Account is locked or disabled. Contact your administrator." };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    const failed = user.failedLogins + 1;
    const lock = failed >= settings.maxFailedLogins;
    await db.user.update({ where: { id: user.id }, data: { failedLogins: failed, status: lock ? "LOCKED" : user.status } });
    await auditNow(sys, {
      eventType: lock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
      action: "LOGIN",
      summary: lock ? `Account ${user.username} locked after ${failed} failed attempts` : `Failed password for ${user.username} (${failed}/${settings.maxFailedLogins})`,
      entityType: "User",
      entityId: user.id,
    });
    return lock ? { ok: false, error: "Account locked after repeated failures. Contact your administrator." } : generic;
  }

  const token = randomToken();
  const sessionId = sha256(token);
  const now = Date.now();
  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: { id: sessionId, userId: user.id, tenantId: tenant.id, mfaVerified: !settings.mfaRequired, ip: meta.ip, userAgent: meta.userAgent, expiresAt: new Date(now + settings.sessionMaxHours * 3600_000) },
    });
    await tx.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
    await audit(tx, { tenantId: tenant.id, userId: user.id, name: user.fullName, role: user.role, kind: user.kind as "BANK" | "CUSTOMER", ...meta }, {
      eventType: "LOGIN_PASSWORD_OK",
      action: "LOGIN",
      summary: `${user.username} passed password check${settings.mfaRequired ? "; OTP pending" : ""}`,
      entityType: "Session",
      entityId: sessionId.slice(0, 16),
    });
  });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: settings.sessionMaxHours * 3600 });

  if (!settings.mfaRequired) return { ok: true, mfa: false };
  const devCode = await issueLoginOtp(user.id, tenant.id, sessionId, settings.otpTtlSeconds);
  return { ok: true, mfa: true, devCode: settings.otpDelivery === "screen" ? devCode : undefined };
}

async function issueLoginOtp(userId: string, tenantId: string, sessionId: string, ttl: number) {
  const code = generateOtp();
  const ch = await db.otpChallenge.create({ data: { tenantId, userId, purpose: "LOGIN", refId: sessionId, codeHash: "pending", expiresAt: new Date(Date.now() + ttl * 1000) } });
  await db.otpChallenge.update({ where: { id: ch.id }, data: { codeHash: hashOtp(tenantId, ch.id, code) } });
  return code;
}

export async function resendLoginOtp(): Promise<string | undefined> {
  const raw = await readSession();
  if (!raw || raw.session.mfaVerified) return undefined;
  const settings = parseSettings(raw.tenant.settings);
  const code = await issueLoginOtp(raw.user.id, raw.tenant.id, raw.session.id, settings.otpTtlSeconds);
  return settings.otpDelivery === "screen" ? code : undefined;
}

export async function verifyLoginOtp(code: string): Promise<{ ok: boolean; error?: string }> {
  const raw = await readSession();
  if (!raw) return { ok: false, error: "Session expired. Sign in again." };
  const ch = await db.otpChallenge.findFirst({ where: { userId: raw.user.id, purpose: "LOGIN", refId: raw.session.id, consumedAt: null }, orderBy: { createdAt: "desc" } });
  const meta = await requestMeta();
  const actor: Actor = { tenantId: raw.tenant.id, userId: raw.user.id, name: raw.user.fullName, role: raw.user.role, kind: raw.user.kind as "BANK" | "CUSTOMER", ...meta };
  if (!ch || ch.expiresAt < new Date() || ch.attempts >= 5) return { ok: false, error: "OTP expired. Request a new code." };
  if (!safeEqualHex(hashOtp(raw.tenant.id, ch.id, code.trim()), ch.codeHash)) {
    await db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    await auditNow(actor, { eventType: "LOGIN_OTP_FAILED", action: "LOGIN", summary: `Incorrect login OTP for ${raw.user.username}` });
    return { ok: false, error: "Incorrect code." };
  }
  await db.$transaction(async (tx) => {
    await tx.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
    await tx.session.update({ where: { id: raw.session.id }, data: { mfaVerified: true, lastSeenAt: new Date() } });
    await tx.user.update({ where: { id: raw.user.id }, data: { lastLoginAt: new Date() } });
    await audit(tx, actor, { eventType: "LOGIN_SUCCESS", action: "LOGIN", summary: `${raw.user.username} signed in (password + OTP)`, entityType: "Session", entityId: raw.session.id.slice(0, 16) });
  });
  return { ok: true };
}

async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: { include: { orgUnit: true } } } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const settings = parseSettings(tenant.settings);
  if (Date.now() - session.lastSeenAt.getTime() > settings.sessionIdleMinutes * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;
  return { session, user: session.user, tenant };
}

export type SessionInfo = NonNullable<Awaited<ReturnType<typeof readSession>>>;

/** Returns the fully authenticated (MFA-verified) session, or null. */
export async function getSession(): Promise<SessionInfo | null> {
  const s = await readSession();
  if (!s || !s.session.mfaVerified) return null;
  if (Date.now() - s.session.lastSeenAt.getTime() > 60_000) {
    await db.session.update({ where: { id: s.session.id }, data: { lastSeenAt: new Date() } });
  }
  return s;
}

export async function getPendingMfaSession() {
  const s = await readSession();
  return s && !s.session.mfaVerified ? s : null;
}

export async function requireSession(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

function toActor(s: SessionInfo, meta: { ip: string; userAgent: string }): Actor {
  return {
    tenantId: s.tenant.id,
    userId: s.user.id,
    name: s.user.fullName,
    role: s.user.role,
    kind: s.user.kind as "BANK" | "CUSTOMER",
    orgUnitId: s.user.orgUnitId,
    orgPath: s.user.orgUnit?.path ?? null,
    customerId: s.user.customerId,
    approvalLimit: s.user.approvalLimit,
    ...meta,
  };
}

/** Actor for pages (redirects to login when unauthenticated). */
export async function requireActor(): Promise<{ actor: Actor; session: SessionInfo }> {
  const session = await requireSession();
  return { actor: toActor(session, await requestMeta()), session };
}

/** Actor for server actions / route handlers (throws instead of redirecting). */
export async function actorOrThrow(): Promise<Actor> {
  const session = await getSession();
  if (!session) throw new RuleError("Your session has expired. Sign in again.");
  return toActor(session, await requestMeta());
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const s = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
    if (s && !s.revokedAt) {
      await db.$transaction(async (tx) => {
        await tx.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
        await audit(tx, { tenantId: s.tenantId, userId: s.userId, name: s.user.fullName, role: s.user.role, kind: s.user.kind as "BANK" | "CUSTOMER", ...(await requestMeta()) }, { eventType: "LOGOUT", action: "LOGOUT", summary: `${s.user.username} signed out` });
      });
    }
  }
  store.delete(COOKIE);
}
