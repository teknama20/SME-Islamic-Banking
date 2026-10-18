// Demo tenants, hierarchy, users, customers and templates.
import type { PrismaClient } from "@prisma/client";
import { systemActor } from "../actor";
import { audit } from "../audit";
import { hashPassword } from "../crypto";
import { classifySme } from "../sbp";
import { TEMPLATE_LIBRARY } from "../templates/library";
import { DEFAULT_SETTINGS, type TenantSettings } from "../tenant";

// Hosted demos set DEMO_PASSWORD so the published default is never used online.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Bank@12345";

type OrgSpec = { code: string; type: string; name: string; parent?: string };

export async function seedTenant(
  db: PrismaClient,
  t: { code: string; name: string; legalName: string; bankType: string; primaryColor: string; accentColor: string; logoText: string; tagline: string; shariahBoardRef: string; settings?: Partial<TenantSettings> },
  orgs: OrgSpec[],
  users: { username: string; fullName: string; role: string; org: string; approvalLimit?: number }[],
) {
  const tenant = await db.tenant.create({
    data: { ...t, settings: JSON.stringify({ ...DEFAULT_SETTINGS, ...(t.settings ?? {}) }) },
  });
  const orgIds: Record<string, { id: string; path: string }> = {};
  for (const o of orgs) {
    const parent = o.parent ? orgIds[o.parent] : undefined;
    const created = await db.orgUnit.create({ data: { tenantId: tenant.id, code: o.code, type: o.type, name: o.name, parentId: parent?.id, path: "pending" } });
    const path = `${parent?.path ?? "/"}${created.id}/`;
    await db.orgUnit.update({ where: { id: created.id }, data: { path } });
    orgIds[o.code] = { id: created.id, path };
  }
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const created = await db.user.create({
      data: {
        tenantId: tenant.id,
        username: u.username,
        fullName: u.fullName,
        email: `${u.username}@${t.code.toLowerCase()}.example.pk`,
        mobile: "+92 300 0000000",
        employeeId: `E${Math.floor(10000 + Math.random() * 89999)}`,
        passwordHash,
        kind: "BANK",
        role: u.role,
        orgUnitId: orgIds[u.org].id,
        approvalLimit: u.approvalLimit,
      },
    });
    userIds[u.username] = created.id;
  }
  // Templates: v1 of every model agreement, approved by Shariah + Legal.
  const shariah = users.find((u) => u.role === "SHARIAH");
  const legal = users.find((u) => u.role === "LEGAL");
  for (const tpl of TEMPLATE_LIBRARY) {
    await db.template.create({
      data: {
        tenantId: tenant.id,
        code: tpl.code,
        title: tpl.title,
        version: 1,
        body: tpl.body,
        status: "APPROVED",
        shariahRef: `${t.shariahBoardRef} (demo — replace with bank-vetted text)`,
        shariahApprovedBy: shariah ? userIds[shariah.username] : null,
        shariahApprovedAt: new Date(),
        legalRef: "Legal Dept. vetting memo LD/2026/014 (demo)",
        legalApprovedBy: legal ? userIds[legal.username] : null,
        legalApprovedAt: new Date(),
      },
    });
  }
  await db.$transaction((tx) =>
    audit(tx, systemActor(tenant.id), {
      eventType: "TENANT_PROVISIONED",
      action: "CREATE",
      summary: `Tenant ${t.name} provisioned with ${orgs.length} org units, ${users.length} bank users and ${TEMPLATE_LIBRARY.length} templates`,
      entityType: "Tenant",
      entityId: tenant.id,
    }),
  );
  return { tenant, orgIds, userIds };
}

export async function seedCustomer(
  db: PrismaClient,
  tenantId: string,
  rmId: string,
  c: {
    legalName: string;
    legalForm: string;
    ntn: string;
    sector: string;
    city: string;
    address: string;
    annualTurnover: number;
    establishedOn: Date;
    kycCleared: boolean;
    womenLed?: boolean;
    people: { fullName: string; cnic: string; role: string; sharePct?: number }[];
    users: { username: string; fullName: string; role: string }[];
  },
) {
  const rm = await db.user.findUniqueOrThrow({ where: { id: rmId }, include: { orgUnit: true } });
  const count = await db.customer.count({ where: { tenantId } });
  const { category, isStartup } = classifySme(c.annualTurnover, c.establishedOn);
  const customer = await db.customer.create({
    data: {
      tenantId,
      cif: `CIF${100001 + count}`,
      legalName: c.legalName,
      legalForm: c.legalForm,
      ntn: c.ntn,
      sector: c.sector,
      businessActivity: c.sector,
      address: c.address,
      city: c.city,
      annualTurnover: c.annualTurnover,
      establishedOn: c.establishedOn,
      smeCategory: category,
      isStartup,
      womenLed: c.womenLed ?? false,
      riskCategory: "MEDIUM",
      kycStatus: c.kycCleared ? "CLEARED" : "PENDING",
      kycClearedAt: c.kycCleared ? new Date() : null,
      kycRemarks: c.kycCleared ? "CDD complete; NADRA Verisys and sanctions screening clear." : "",
      ecibCheckedAt: c.kycCleared ? new Date() : null,
      premisesLat: 31.5204,
      premisesLng: 74.3587,
      rmId,
      orgUnitId: rm.orgUnitId!,
      orgPath: rm.orgUnit!.path,
      people: { create: c.people.map((p) => ({ ...p, sharePct: p.sharePct ?? 0 })) },
    },
  });
  const passwordHash = hashPassword(DEMO_PASSWORD);
  for (const u of c.users) {
    await db.user.create({
      data: { tenantId, username: u.username, fullName: u.fullName, email: `${u.username}@customer.example.pk`, mobile: "+92 321 0000000", passwordHash, kind: "CUSTOMER", role: u.role, customerId: customer.id },
    });
  }
  return customer;
}

export const IBP_ORGS: OrgSpec[] = [
  { code: "PK", type: "COUNTRY", name: "Pakistan — SME & Commercial Banking" },
  { code: "NR", type: "REGION", name: "North Region (Lahore)", parent: "PK" },
  { code: "LHR-GUL", type: "UNIT", name: "Lahore Gulberg Unit", parent: "NR" },
  { code: "LHR-GUL-T1", type: "TEAM", name: "Gulberg SME Team 1", parent: "LHR-GUL" },
  { code: "SR", type: "REGION", name: "South Region (Karachi)", parent: "PK" },
  { code: "KHI-SITE", type: "UNIT", name: "Karachi SITE Unit", parent: "SR" },
  { code: "KHI-SITE-T1", type: "TEAM", name: "SITE SME Team 1", parent: "KHI-SITE" },
];

export const IBP_USERS = [
  { username: "admin", fullName: "Platform Administrator", role: "BANK_ADMIN", org: "PK" },
  { username: "ch.ahmed", fullName: "Ahmed Raza", role: "COUNTRY_HEAD", org: "PK" },
  { username: "rh.north", fullName: "Sadia Malik", role: "REGIONAL_HEAD", org: "NR" },
  { username: "rh.south", fullName: "Kamran Siddiqui", role: "REGIONAL_HEAD", org: "SR" },
  { username: "uh.gulberg", fullName: "Bilal Hussain", role: "UNIT_HEAD", org: "LHR-GUL" },
  { username: "uh.site", fullName: "Farah Naz", role: "UNIT_HEAD", org: "KHI-SITE" },
  { username: "tl.gulberg", fullName: "Usman Tariq", role: "TEAM_LEADER", org: "LHR-GUL-T1" },
  { username: "tl.site", fullName: "Hina Qureshi", role: "TEAM_LEADER", org: "KHI-SITE-T1" },
  { username: "rm.ali", fullName: "Ali Hassan", role: "RM", org: "LHR-GUL-T1" },
  { username: "rm.sara", fullName: "Sara Khan", role: "RM", org: "LHR-GUL-T1" },
  { username: "rm.zain", fullName: "Zain Abbas", role: "RM", org: "KHI-SITE-T1" },
  { username: "credit.officer", fullName: "Imran Shah", role: "CREDIT_RISK", org: "PK" },
  { username: "rcad.officer", fullName: "Ayesha Siddiqa", role: "RCAD", org: "PK" },
  { username: "trade.officer", fullName: "Faisal Mehmood", role: "TRADE", org: "PK" },
  { username: "shariah.officer", fullName: "Mufti Abdullah Khan", role: "SHARIAH", org: "PK" },
  { username: "legal.officer", fullName: "Nadia Rehman", role: "LEGAL", org: "PK" },
  { username: "ops.officer", fullName: "Hamza Iqbal", role: "OPERATIONS", org: "PK" },
  { username: "ops.checker", fullName: "Rabia Anwar", role: "OPERATIONS", org: "PK" },
  { username: "auditor", fullName: "Tariq Jamil", role: "AUDITOR", org: "PK" },
];
