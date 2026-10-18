// Roles, permissions and segregation-of-duties rules.
// Pure module (no Next.js imports) so it can be used by the engine, tests and seed.

export const BANK_ROLES = [
  "RM",
  "TEAM_LEADER",
  "UNIT_HEAD",
  "REGIONAL_HEAD",
  "COUNTRY_HEAD",
  "CREDIT_RISK",
  "RCAD",
  "TRADE",
  "SHARIAH",
  "LEGAL",
  "OPERATIONS",
  "AUDITOR",
  "BANK_ADMIN",
] as const;

export const CUSTOMER_ROLES = ["CUSTOMER_SIGNATORY", "CUSTOMER_USER", "GUARANTOR"] as const;

export type BankRole = (typeof BANK_ROLES)[number];
export type CustomerRole = (typeof CUSTOMER_ROLES)[number];
export type Role = BankRole | CustomerRole;

export const ROLE_LABELS: Record<Role, string> = {
  RM: "Relationship Manager",
  TEAM_LEADER: "Team Leader",
  UNIT_HEAD: "Unit Head",
  REGIONAL_HEAD: "Regional Head",
  COUNTRY_HEAD: "Country Head",
  CREDIT_RISK: "Credit / Risk Officer",
  RCAD: "RCAD Officer",
  TRADE: "Trade Officer",
  SHARIAH: "Shariah Compliance Officer",
  LEGAL: "Legal Officer",
  OPERATIONS: "Operations Officer",
  AUDITOR: "Internal Auditor",
  BANK_ADMIN: "Platform Administrator",
  CUSTOMER_SIGNATORY: "Customer — Authorised Signatory",
  CUSTOMER_USER: "Customer — User (Accountant)",
  GUARANTOR: "Guarantor",
};

/** Business hierarchy, lowest to highest. */
export const HIERARCHY: BankRole[] = ["RM", "TEAM_LEADER", "UNIT_HEAD", "REGIONAL_HEAD", "COUNTRY_HEAD"];

/** Org-unit type each hierarchy role is anchored to. */
export const HIERARCHY_UNIT: Partial<Record<BankRole, string>> = {
  RM: "TEAM",
  TEAM_LEADER: "TEAM",
  UNIT_HEAD: "UNIT",
  REGIONAL_HEAD: "REGION",
  COUNTRY_HEAD: "COUNTRY",
};

/** Review tracks and the role that owns each. */
export const TRACK_ROLE = {
  RCAD: "RCAD",
  CREDIT: "CREDIT_RISK",
  TRADE: "TRADE",
  SHARIAH: "SHARIAH",
  LEGAL: "LEGAL",
} as const satisfies Record<string, BankRole>;
export type Track = keyof typeof TRACK_ROLE;

export const PERMISSIONS = {
  "customer.create": ["RM", "TEAM_LEADER"],
  "customer.edit": ["RM", "TEAM_LEADER"],
  "customer.kyc": ["RCAD"],
  "case.create": ["RM"],
  "case.submit": ["RM"],
  "case.comment": ["RM", "TEAM_LEADER", "UNIT_HEAD", "REGIONAL_HEAD", "COUNTRY_HEAD", "CREDIT_RISK", "RCAD", "TRADE", "SHARIAH", "LEGAL", "OPERATIONS"],
  "offer.issue": ["RM", "TEAM_LEADER"],
  "evidence.capture": ["RM", "TEAM_LEADER", "OPERATIONS", "TRADE", "RCAD", "CUSTOMER_SIGNATORY", "CUSTOMER_USER"],
  "evidence.verify": ["RCAD", "TRADE", "SHARIAH", "OPERATIONS"],
  "ops.execute": ["OPERATIONS"],
  "repayment.record": ["OPERATIONS"],
  "audit.view": ["AUDITOR", "BANK_ADMIN", "COUNTRY_HEAD", "SHARIAH"],
  "admin.manage": ["BANK_ADMIN"],
  "template.shariah": ["SHARIAH"],
  "template.legal": ["LEGAL"],
  "template.author": ["LEGAL", "BANK_ADMIN"],
  "portfolio.view": ["TEAM_LEADER", "UNIT_HEAD", "REGIONAL_HEAD", "COUNTRY_HEAD", "CREDIT_RISK", "AUDITOR", "BANK_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function isBankRole(role: string): role is BankRole {
  return (BANK_ROLES as readonly string[]).includes(role);
}

export function isCustomerRole(role: string): role is CustomerRole {
  return (CUSTOMER_ROLES as readonly string[]).includes(role);
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

/** Roles that see every case in the tenant (functional / control roles). */
export const TENANT_WIDE_ROLES: BankRole[] = [
  "CREDIT_RISK",
  "RCAD",
  "TRADE",
  "SHARIAH",
  "LEGAL",
  "OPERATIONS",
  "AUDITOR",
  "BANK_ADMIN",
  "COUNTRY_HEAD",
];

/** Read-only roles never mutate business data. */
export const READ_ONLY_ROLES: Role[] = ["AUDITOR"];

export class AccessError extends Error {
  constructor(message = "You are not authorised to perform this action.") {
    super(message);
    this.name = "AccessError";
  }
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
