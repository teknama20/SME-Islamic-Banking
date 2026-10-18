import type { Track } from "./rbac";

export const STAGES = [
  "DRAFT",
  "UNDER_REVIEW",
  "RETURNED",
  "PENDING_APPROVAL",
  "SANCTIONED",
  "OFFERED",
  "EXECUTION",
  "ACTIVE",
  "CLOSED",
  "DECLINED",
  "REJECTED",
  "CANCELLED",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review (RCAD · Credit · Trade · Shariah · Legal)",
  RETURNED: "Returned to RM",
  PENDING_APPROVAL: "Pending approval",
  SANCTIONED: "Sanctioned",
  OFFERED: "Offer issued to customer",
  EXECUTION: "Documentation & execution",
  ACTIVE: "Active / disbursed",
  CLOSED: "Closed",
  DECLINED: "Offer declined by customer",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** Main path shown in the stage tracker. */
export const STAGE_PATH: Stage[] = ["DRAFT", "UNDER_REVIEW", "PENDING_APPROVAL", "SANCTIONED", "OFFERED", "EXECUTION", "ACTIVE", "CLOSED"];

/** Stages counted as this bank's exposure for R-5 / R-9. */
export const EXPOSURE_STAGES: Stage[] = ["SANCTIONED", "OFFERED", "EXECUTION", "ACTIVE"];

export const TRACK_LABELS: Record<Track, string> = {
  RCAD: "RCAD — KYC / AML / CDD",
  CREDIT: "Credit & Risk",
  TRADE: "Trade",
  SHARIAH: "Shariah Compliance",
  LEGAL: "Legal",
};

export const TRACK_CHECKLISTS: Record<Track, string[]> = {
  RCAD: [
    "KYC / CDD complete and customer KYC cleared",
    "Sanctions, PEP and adverse-media screening clear",
    "Ultimate beneficial owners identified",
    "Latest e-CIB / CIB report obtained (SME PR R-7)",
    "Mandatory documents verified against originals / NADRA",
  ],
  CREDIT: [
    "Financial spreading and ratio analysis completed",
    "Cash-flow and repayment capacity assessed",
    "Internal risk rating assigned",
    "Credit score obtained (SME PR R-15)",
    "Security & margin adequate per policy (SME PR R-13)",
    "Per-party and clean exposure limits verified (R-5 / R-9)",
  ],
  TRADE: [
    "Supplier / contractor / buyer validated",
    "Quotation / proforma invoice verified",
    "Trade cycle and delivery terms verified",
    "Import / export documents (if any) in order",
  ],
  SHARIAH: [
    "Mode is appropriate to the underlying need",
    "Asset and business activity are Shariah-permissible",
    "Contract sequence and possession requirements configured",
    "No buy-back (Inah), hidden interest or conditional sale",
    "Shariah Board-approved model agreements in use",
  ],
  LEGAL: [
    "Capacity & authority of signatories verified (board resolution / partnership deed)",
    "Approved templates and security documents selected",
    "Stamp duty and registration requirements identified",
    "Title and enforceability of security confirmed",
  ],
};

export const RISK_RATINGS = ["ORR-1 (Excellent)", "ORR-2 (Strong)", "ORR-3 (Good)", "ORR-4 (Satisfactory)", "ORR-5 (Acceptable)", "ORR-6 (Watch)", "ORR-7 (Weak)"];

export const EVIDENCE_LABELS: Record<string, string> = {
  POSSESSION: "Possession",
  DELIVERY: "Delivery",
  INSPECTION: "Inspection",
  MILESTONE: "Milestone",
  SITE_VISIT: "Site visit",
  INVOICE: "Invoice / challan",
  TITLE: "Title / registration",
  TAKAFUL: "Takaful cover",
  VALUATION: "Valuation report",
  COUNTERPARTY_CONTRACT: "Counterparty-signed contract",
  OTHER: "Other",
};

export const KYC_DOC_TYPES = [
  "CNIC of proprietor / directors / partners",
  "NTN certificate",
  "SECP incorporation / partnership deed",
  "Board resolution / authority letter",
  "Financial statements (last 2 years)",
  "Bank statements (last 12 months)",
  "Tax returns",
  "Business premises proof",
  "e-CIB report",
  "Other",
];

export const LEGAL_FORMS: Record<string, string> = {
  SOLE_PROPRIETOR: "Sole Proprietorship",
  PARTNERSHIP: "Partnership",
  PRIVATE_LIMITED: "Private Limited Company",
  PUBLIC_LIMITED: "Public Limited Company",
  AOP: "Association of Persons",
};

export const REPAYMENT_LABELS: Record<string, { en: string; ur: string }> = {
  MONTHLY: { en: "Monthly", ur: "ماہانہ اقساط" },
  QUARTERLY: { en: "Quarterly", ur: "سہ ماہی اقساط" },
  BULLET: { en: "Bullet (at maturity)", ur: "مدت کے اختتام پر یکمشت" },
};
