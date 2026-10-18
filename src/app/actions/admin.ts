"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { hashPassword, passwordPolicyError } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AccessError, BANK_ROLES, RuleError, can } from "@/lib/rbac";
import { parseSettings, type TenantSettings } from "@/lib/tenant";
import { run, str } from "./run";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0b5d3b");

export async function brandingAction(_: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, "admin.manage")) throw new AccessError();
    const input = z
      .object({ name: z.string().min(3), legalName: z.string().min(3), primaryColor: hex, accentColor: hex, logoText: z.string().min(1).max(4), tagline: z.string().max(60), shariahBoardRef: z.string().max(120) })
      .parse(Object.fromEntries(["name", "legalName", "primaryColor", "accentColor", "logoText", "tagline", "shariahBoardRef"].map((k) => [k, str(fd, k)])));
    await db.$transaction(async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
      await tx.tenant.update({ where: { id: actor.tenantId }, data: input });
      await audit(tx, actor, { eventType: "TENANT_BRANDING_UPDATED", action: "UPDATE", summary: "White-label branding updated", entityType: "Tenant", entityId: actor.tenantId, before: { name: before.name, primaryColor: before.primaryColor, accentColor: before.accentColor, logoText: before.logoText }, after: input });
    });
    return "Branding saved.";
  });
}

export async function settingsAction(_: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, "admin.manage")) throw new AccessError();
    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
      const before = parseSettings(tenant.settings);
      const limits = before.approvalMatrix.map((l, i) => ({ role: l.role, limit: i === 0 ? 0 : Number(str(fd, `limit_${l.role}`)) || l.limit }));
      for (let i = 2; i < limits.length; i++) if ((limits[i].limit ?? 0) <= (limits[i - 1].limit ?? 0)) throw new RuleError("Each approval level must have a higher limit than the one below.");
      const after: TenantSettings = {
        ...before,
        approvalMatrix: limits,
        cleanEscalationAmount: Number(str(fd, "cleanEscalationAmount")) || before.cleanEscalationAmount,
        mfaRequired: fd.get("mfaRequired") === "on",
        sessionIdleMinutes: Math.min(60, Math.max(5, Number(str(fd, "sessionIdleMinutes")) || before.sessionIdleMinutes)),
        maxFailedLogins: Math.min(10, Math.max(3, Number(str(fd, "maxFailedLogins")) || before.maxFailedLogins)),
        otpDelivery: str(fd, "otpDelivery") === "sms" ? "sms" : "screen",
        tatWorkingDays: Math.min(15, Math.max(1, Number(str(fd, "tatWorkingDays")) || before.tatWorkingDays)),
        reviewTracks: fd.getAll("reviewTracks").map(String).filter((t): t is "CREDIT" | "TRADE" | "LEGAL" | "SHARIAH" => ["CREDIT", "TRADE", "LEGAL", "SHARIAH"].includes(t)),
      };
      await tx.tenant.update({ where: { id: actor.tenantId }, data: { settings: JSON.stringify(after) } });
      await audit(tx, actor, { eventType: "TENANT_SETTINGS_UPDATED", action: "UPDATE", summary: "Security policy / approval matrix updated", entityType: "Tenant", entityId: actor.tenantId, before, after });
    });
    return "Settings saved.";
  });
}

export async function createBankUserAction(_: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, "admin.manage")) throw new AccessError();
    const input = z
      .object({
        username: z.string().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, "3–32 chars: letters, digits, . _ -"),
        fullName: z.string().min(3),
        email: z.string().email(),
        mobile: z.string().min(10),
        employeeId: z.string().min(2),
        role: z.enum(BANK_ROLES),
        orgUnitId: z.string().min(1),
        password: z.string(),
        approvalLimit: z.preprocess((v) => (v === "" ? undefined : Number(v)), z.number().positive().optional()),
      })
      .parse(Object.fromEntries(["username", "fullName", "email", "mobile", "employeeId", "role", "orgUnitId", "password", "approvalLimit"].map((k) => [k, str(fd, k)])));
    const policy = passwordPolicyError(input.password);
    if (policy) throw new RuleError(policy);
    await db.$transaction(async (tx) => {
      const org = await tx.orgUnit.findFirst({ where: { id: input.orgUnitId, tenantId: actor.tenantId } });
      if (!org) throw new RuleError("Select a valid org unit.");
      if (await tx.user.findUnique({ where: { tenantId_username: { tenantId: actor.tenantId, username: input.username } } })) throw new RuleError("Username already exists.");
      const { password, ...rest } = input;
      const user = await tx.user.create({ data: { ...rest, tenantId: actor.tenantId, kind: "BANK", passwordHash: hashPassword(password) } });
      await audit(tx, actor, { eventType: "BANK_USER_CREATED", action: "CREATE", summary: `User ${input.username} (${input.role}) onboarded to ${org.name}`, entityType: "User", entityId: user.id, after: rest });
    });
    return "User created.";
  });
}

export async function userStatusAction(userId: string, status: "ACTIVE" | "DISABLED", _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, "admin.manage")) throw new AccessError();
    if (userId === actor.userId) throw new RuleError("You cannot change your own status.");
    await db.$transaction(async (tx) => {
      const u = await tx.user.findFirstOrThrow({ where: { id: userId, tenantId: actor.tenantId } });
      await tx.user.update({ where: { id: userId }, data: { status, failedLogins: 0 } });
      if (status === "DISABLED") await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(tx, actor, { eventType: "USER_STATUS_CHANGED", action: "UPDATE", summary: `${u.username}: ${u.status} → ${status}`, entityType: "User", entityId: userId, before: { status: u.status }, after: { status } });
    });
  });
}

export async function createOrgUnitAction(_: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, "admin.manage")) throw new AccessError();
    const parentId = str(fd, "parentId");
    const name = str(fd, "name");
    const code = str(fd, "code").toUpperCase();
    if (name.length < 3 || code.length < 2) throw new RuleError("Name and code are required.");
    await db.$transaction(async (tx) => {
      const parent = await tx.orgUnit.findFirstOrThrow({ where: { id: parentId, tenantId: actor.tenantId } });
      const type = { COUNTRY: "REGION", REGION: "UNIT", UNIT: "TEAM" }[parent.type];
      if (!type) throw new RuleError("Teams cannot have child units.");
      const unit = await tx.orgUnit.create({ data: { tenantId: actor.tenantId, parentId, type, name, code, path: "pending" } });
      await tx.orgUnit.update({ where: { id: unit.id }, data: { path: `${parent.path}${unit.id}/` } });
      await audit(tx, actor, { eventType: "ORG_UNIT_CREATED", action: "CREATE", summary: `${type} ${name} (${code}) created under ${parent.name}`, entityType: "OrgUnit", entityId: unit.id });
    });
  });
}

// --- Template governance -----------------------------------------------------------

export async function newTemplateVersionAction(templateId: string, _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, "template.author")) throw new AccessError();
    const body = String(fd.get("body") ?? "");
    if (body.trim().length < 50) throw new RuleError("Template body is too short.");
    await db.$transaction(async (tx) => {
      const base = await tx.template.findFirstOrThrow({ where: { id: templateId, tenantId: actor.tenantId } });
      const latest = await tx.template.findFirstOrThrow({ where: { tenantId: actor.tenantId, code: base.code }, orderBy: { version: "desc" } });
      if (latest.status === "DRAFT") throw new RuleError(`Version ${latest.version} is already a draft awaiting approval.`);
      const t = await tx.template.create({ data: { tenantId: actor.tenantId, code: base.code, title: base.title, version: latest.version + 1, body, status: "DRAFT", createdById: actor.userId } });
      await audit(tx, actor, { eventType: "TEMPLATE_VERSION_DRAFTED", action: "CREATE", summary: `${base.title} v${t.version} drafted`, entityType: "Template", entityId: t.id, before: { version: latest.version }, after: { version: t.version } });
    });
    return "Draft version created. It needs Shariah and Legal approval before use.";
  });
}

export async function approveTemplateAction(templateId: string, kind: "SHARIAH" | "LEGAL", _: ActionState, fd: FormData) {
  return run(fd, async (actor) => {
    if (!can(actor.role, kind === "SHARIAH" ? "template.shariah" : "template.legal")) throw new AccessError();
    const ref = str(fd, "ref");
    if (ref.length < 3) throw new RuleError(kind === "SHARIAH" ? "Enter the Shariah Board resolution / fatwa reference." : "Enter the legal vetting reference.");
    await db.$transaction(async (tx) => {
      const t = await tx.template.findFirstOrThrow({ where: { id: templateId, tenantId: actor.tenantId } });
      if (t.status !== "DRAFT") throw new RuleError("Only draft versions can be approved.");
      if (t.createdById === actor.userId) throw new RuleError("Maker-checker: the author cannot approve the template.");
      const data = kind === "SHARIAH" ? { shariahRef: ref, shariahApprovedBy: actor.userId, shariahApprovedAt: new Date() } : { legalRef: ref, legalApprovedBy: actor.userId, legalApprovedAt: new Date() };
      const updated = await tx.template.update({ where: { id: t.id }, data });
      const both = updated.shariahApprovedAt && updated.legalApprovedAt;
      if (both) {
        await tx.template.updateMany({ where: { tenantId: actor.tenantId, code: t.code, status: "APPROVED" }, data: { status: "RETIRED" } });
        await tx.template.update({ where: { id: t.id }, data: { status: "APPROVED" } });
      }
      await audit(tx, actor, { eventType: "TEMPLATE_APPROVED", action: "APPROVE", summary: `${t.title} v${t.version}: ${kind} approval (${ref})${both ? " — now in force" : ""}`, entityType: "Template", entityId: t.id, after: { kind, ref } });
    });
  });
}
