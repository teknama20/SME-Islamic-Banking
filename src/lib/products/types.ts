import type { BankRole, Role } from "../rbac";

export type Party = "CUSTOMER" | "GUARANTOR" | "BANK";

/** One signature position on a document, signed strictly in order. */
export type SignerSlot = {
  party: Party;
  capacity: string;
  /** For BANK slots: which roles may sign as authorised signatory. */
  roles?: BankRole[];
};

export type DocSpec = {
  code: string;
  title: string;
  signers: SignerSlot[];
  /** Counterparty who signs outside the platform (e.g. contractor); signed copy uploaded as evidence. */
  offPlatformCounterparty?: string;
};

export type EvidenceCategory =
  | "POSSESSION"
  | "DELIVERY"
  | "INSPECTION"
  | "MILESTONE"
  | "SITE_VISIT"
  | "INVOICE"
  | "TITLE"
  | "TAKAFUL"
  | "VALUATION"
  | "COUNTERPARTY_CONTRACT"
  | "OTHER";

export type StepKind = "SIGN" | "EVIDENCE" | "ACTION" | "CHECK";

export type StepSpec = {
  key: string;
  title: string;
  kind: StepKind;
  dependsOn: string[];
  /** Why this step exists / its Shariah or regulatory rationale. */
  note?: string;
  /** SIGN */
  docCode?: string;
  /** EVIDENCE */
  evidence?: {
    categories: EvidenceCategory[];
    minItems: number;
    capturers: Role[];
    verifiers: BankRole[];
    requireGps: boolean;
    checklist: string[];
  };
  /** ACTION */
  action?: {
    roles: BankRole[];
    fields: { name: string; label: string; type: "text" | "number" | "date" }[];
    effect?: "DISBURSE" | "ACTIVATE";
  };
  /** CHECK (a role-owned checklist sign-off) */
  check?: { roles: BankRole[]; checklist: string[] };
};

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
};

export type PricingModel = "COST_PLUS" | "RENTAL" | "DM_UNITS" | "PROFIT_SHARE";

export type CaseShape = {
  amount: number;
  tenorMonths: number;
  profitRate: number;
  repayment: string;
  securityType: string;
  structure: Record<string, string>;
};

export type ProductDef = {
  code: string;
  name: string;
  nameUrdu: string;
  family: "Trade (sale)" | "Lease" | "Partnership" | "Manufacturing (sale)" | "Forward sale";
  summary: string;
  useCases: string[];
  aaoifi: string[];
  sbp: string[];
  pricing: PricingModel;
  repaymentOptions: ("MONTHLY" | "QUARTERLY" | "BULLET")[];
  maxTenorMonths: number;
  requiresTrade: boolean;
  fields: FieldSpec[];
  /** Shariah & structural preconditions; returns blocking errors. */
  preconditions: (c: CaseShape) => string[];
  documents: DocSpec[];
  /** Product-specific execution steps (security & common steps are added by the engine). */
  steps: (c: CaseShape) => StepSpec[];
  /** Key Shariah rules surfaced to every stakeholder. */
  shariahRules: string[];
};
