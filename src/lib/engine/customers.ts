// Customer (SME) onboarding, KYC/CDD and customer-user provisioning.
import { z } from "zod";
import type { Actor } from "../actor";
import { audit } from "../audit";
import { hashPassword, passwordPolicyError } from "../crypto";
import { db } from "../db";
import { AccessError, RuleError, can } from "../rbac";
import { classifySme } from "../sbp";
import { customerScope } from "../scope";
import { zBool, zOptDate, zOptNumber } from "../zod-helpers";
import { notify, usersForRoles } from "./notify";

export const customerInput = z.object({
  legalName: z.string().trim().min(3),
  tradeName: z.string().trim().optional().default(""),
  legalForm: z.enum(["SOLE_PROPRIETOR", "PARTNERSHIP", "PRIVATE_LIMITED", "PUBLIC_LIMITED", "AOP"]),
  ntn: z.string().trim().regex(/^[0-9A-Za-z-]{7,15}$/, "Enter a valid NTN"),
  strn: z.string().trim().optional().default(""),
  registrationNo: z.string().trim().optional().default(""),
  establishedOn: zOptDate,
  sector: z.string().trim().min(2),
  businessActivity: z.string().trim().optional().default(""),
  address: z.string().trim().min(5),
  city: z.string().trim().min(2),
  annualTurnover: z.coerce.number().positive(),
  womenLed: zBool,
  premisesLat: zOptNumber,
  premisesLng: zOptNumber,
  people: z
    .array(
      z.object({
        fullName: z.string().trim().min(3),
        cnic: z.string().trim().regex(/^\d{5}-\d{7}-\d$/, "CNIC format 00000-0000000-0"),
        role: z.enum(["PROPRIETOR", "DIRECTOR", "PARTNER", "UBO", "GUARANTOR", "SIGNATORY"]),
        sharePct: z.coerce.number().min(0).max(100).optional().default(0),
        mobile: z.string().trim().optional().default(""),
      }),
    )
    .min(1, "At least one owner / signatory is required"),
});
export type CustomerInput = z.infer<typeof customerInput>;

export async function createCustomer(actor: Actor, raw: unknown) {
  if (!can(actor.role, "customer.create")) throw new AccessError();
  const input = customerInput.parse(raw);
  const { category, isStartup } = classifySme(input.annualTurnover, input.establishedOn);

  return db.$transaction(async (tx) => {
    const rm = await tx.user.findUniqueOrThrow({ where: { id: actor.userId }, include: { orgUnit: true } });
    if (!rm.orgUnit) throw new RuleError("Your user is not attached to a team.");
    const count = await tx.customer.count({ where: { tenantId: actor.tenantId } });
    const cif = `CIF${String(100001 + count)}`;
    const customer = await tx.customer.create({
      data: {
        tenantId: actor.tenantId,
        cif,
        legalName: input.legalName,
        tradeName: input.tradeName,
        legalForm: input.legalForm,
        ntn: input.ntn,
        strn: input.strn,
        registrationNo: input.registrationNo,
        establishedOn: input.establishedOn,
        sector: input.sector,
        businessActivity: input.businessActivity,
        address: input.address,
        city: input.city,
        annualTurnover: input.annualTurnover,
        smeCategory: category,
        isStartup,
        womenLed: input.womenLed,
        premisesLat: input.premisesLat ?? actor.geo?.lat,
        premisesLng: input.premisesLng ?? actor.geo?.lng,
        rmId: rm.id,
        orgUnitId: rm.orgUnit.id,
        orgPath: rm.orgUnit.path,
        people: { create: input.people },
      },
    });
    await audit(tx, actor, {
      eventType: "CUSTOMER_ONBOARDED",
      action: "CREATE",
      summary: `Customer ${customer.legalName} (${cif}) onboarded — ${category}${isStartup ? ", start-up" : ""}`,
      customerId: customer.id,
      entityType: "Customer",
      entityId: customer.id,
      after: { ...input, smeCategory: category, isStartup },
    });
    const rcad = await usersForRoles(tx, actor.tenantId, ["RCAD"]);
    await notify(tx, actor.tenantId, rcad.map((u) => u.id), "KYC/CDD required", `${customer.legalName} awaits KYC/CDD clearance.`, `/customers/${customer.id}`);
    return customer;
  });
}

export const kycInput = z.object({
  decision: z.enum(["CLEARED", "RETURNED"]),
  riskCategory: z.enum(["LOW", "MEDIUM", "HIGH"]),
  ecibObtained: zBool,
  ecibOverdue: zBool,
  ecibRemarks: z.string().trim().optional().default(""),
  otherBankExposure: z.coerce.number().min(0).default(0),
  relatedParty: zBool,
  remarks: z.string().trim().min(3, "Remarks are required"),
});

/** RCAD records KYC/CDD outcome, e-CIB results (R-7) and related-party status (R-11). */
export async function recordKyc(actor: Actor, customerId: string, raw: unknown) {
  if (!can(actor.role, "customer.kyc")) throw new AccessError();
  const input = kycInput.parse(raw);
  if (input.decision === "CLEARED" && !input.ecibObtained) throw new RuleError("e-CIB report must be obtained before clearing KYC (SME PR R-7).");
  return db.$transaction(async (tx) => {
    const before = await tx.customer.findFirstOrThrow({ where: { id: customerId, tenantId: actor.tenantId } });
    if (before.rmId === actor.userId) throw new RuleError("Maker-checker: you cannot clear KYC for a customer you manage.");
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        kycStatus: input.decision,
        riskCategory: input.riskCategory,
        kycRemarks: input.remarks,
        kycClearedAt: input.decision === "CLEARED" ? new Date() : null,
        kycClearedById: input.decision === "CLEARED" ? actor.userId : null,
        ecibCheckedAt: input.ecibObtained ? new Date() : before.ecibCheckedAt,
        ecibOverdue: input.ecibOverdue,
        ecibRemarks: input.ecibRemarks,
        otherBankExposure: input.otherBankExposure,
        relatedParty: input.relatedParty,
      },
    });
    await audit(tx, actor, {
      eventType: "KYC_DECISION",
      action: input.decision === "CLEARED" ? "APPROVE" : "RETURN",
      summary: `KYC/CDD ${input.decision.toLowerCase()} for ${before.legalName}; risk ${input.riskCategory}`,
      customerId,
      entityType: "Customer",
      entityId: customerId,
      before: { kycStatus: before.kycStatus, riskCategory: before.riskCategory, ecibOverdue: before.ecibOverdue, otherBankExposure: before.otherBankExposure, relatedParty: before.relatedParty },
      after: input,
    });
    await notify(tx, actor.tenantId, [before.rmId], `KYC ${input.decision.toLowerCase()}`, `${before.legalName}: ${input.remarks}`, `/customers/${customerId}`);
    return updated;
  });
}

export const customerUserInput = z.object({
  fullName: z.string().trim().min(3),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{4,32}$/, "4–32 chars: letters, digits, . _ -"),
  email: z.string().trim().email(),
  mobile: z.string().trim().min(10),
  role: z.enum(["CUSTOMER_SIGNATORY", "CUSTOMER_USER", "GUARANTOR"]),
  password: z.string().min(10),
});

/** RM / admin provisions a customer-side user (signatory, accountant or guarantor). */
export async function createCustomerUser(actor: Actor, customerId: string, raw: unknown) {
  if (!can(actor.role, "customer.edit") && !can(actor.role, "admin.manage")) throw new AccessError();
  const input = customerUserInput.parse(raw);
  const policy = passwordPolicyError(input.password);
  if (policy) throw new RuleError(policy);
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirstOrThrow({ where: { ...customerScope(actor), id: customerId } });
    const exists = await tx.user.findUnique({ where: { tenantId_username: { tenantId: actor.tenantId, username: input.username } } });
    if (exists) throw new RuleError("Username already exists.");
    const user = await tx.user.create({
      data: {
        tenantId: actor.tenantId,
        username: input.username,
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        passwordHash: hashPassword(input.password),
        kind: "CUSTOMER",
        role: input.role,
        customerId: customer.id,
      },
    });
    await audit(tx, actor, {
      eventType: "CUSTOMER_USER_CREATED",
      action: "CREATE",
      summary: `${input.role} user ${input.username} linked to ${customer.legalName}`,
      customerId,
      entityType: "User",
      entityId: user.id,
      after: { username: input.username, fullName: input.fullName, role: input.role, email: input.email, mobile: input.mobile },
    });
    return user;
  });
}
