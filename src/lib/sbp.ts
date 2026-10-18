// SBP Prudential Regulations for SME Financing (updated 16 July 2026) and
// Shariah screening rules, encoded as pure functions. Each rule cites its
// source so compliance results are explainable in the case file.

const M = 1_000_000;

// --- Part I: definitions ------------------------------------------------------

export type SmeCategory = "MICRO" | "SMALL" | "MEDIUM" | "NOT_SME";

export const SME_BANDS = [
  { category: "MICRO", max: 30 * M, label: "Micro Enterprise", criteria: "Annual sales turnover up to PKR 30 million" },
  { category: "SMALL", max: 400 * M, label: "Small Enterprise", criteria: "Above PKR 30 million to PKR 400 million" },
  { category: "MEDIUM", max: 2_000 * M, label: "Medium Enterprise", criteria: "Above PKR 400 million to PKR 2,000 million" },
] as const;

export const SME_LABELS: Record<SmeCategory, string> = {
  MICRO: "Micro Enterprise",
  SMALL: "Small Enterprise",
  MEDIUM: "Medium Enterprise",
  NOT_SME: "Not an SME (route to Corporate)",
};

export function classifySme(annualTurnover: number, establishedOn?: Date | null, asOf = new Date()) {
  const band = SME_BANDS.find((b) => annualTurnover <= b.max);
  const category: SmeCategory = band ? band.category : "NOT_SME";
  let isStartup = false;
  if (establishedOn && category !== "NOT_SME") {
    const fiveYears = new Date(establishedOn);
    fiveYears.setFullYear(fiveYears.getFullYear() + 5);
    isStartup = asOf <= fiveYears;
  }
  return { category, isStartup };
}

// --- R-5 / R-9 limits ---------------------------------------------------------

/** R-5: aggregate funded + non-funded limit from all banks/DFIs/MFBs. */
export function perPartyLimit(category: SmeCategory): number {
  if (category === "MICRO" || category === "SMALL") return 100 * M;
  if (category === "MEDIUM") return 500 * M;
  return 0;
}

/** R-9: clean (personal-guarantee-only) exposure cap per SME. */
export const CLEAN_EXPOSURE_CAP = 50 * M;

/** R-16: processing turnaround for complete applications. */
export const TAT_WORKING_DAYS = 15;

export type ComplianceCheck = {
  code: string;
  rule: string;
  title: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

export type ExposureInput = {
  smeCategory: SmeCategory;
  requested: number;
  securityType: "SECURED" | "CLEAN";
  liquidLien: number;
  /** Outstanding/sanctioned limits with this bank, excluding the request. */
  existingBankExposure: number;
  existingCleanExposure: number;
  otherBankExposure: number;
  relatedParty: boolean;
  ecibCheckedAt?: Date | null;
  ecibOverdue: boolean;
  ecibJustification: string;
  collateral: string;
  kycStatus: string;
  sector: string;
};

const fmt = (n: number) => `PKR ${(n / M).toLocaleString("en-PK", { maximumFractionDigits: 2 })}m`;

export function runRegulatoryChecks(i: ExposureInput): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  checks.push(
    i.smeCategory === "NOT_SME"
      ? { code: "SME_DEF", rule: "SME PR Part-I", title: "SME definition", status: "FAIL", detail: "Annual turnover exceeds PKR 2,000m — not eligible under SME PRs." }
      : { code: "SME_DEF", rule: "SME PR Part-I", title: "SME definition", status: "PASS", detail: `Classified as ${SME_LABELS[i.smeCategory]}.` },
  );

  const limit = perPartyLimit(i.smeCategory);
  const aggregate = i.existingBankExposure + i.otherBankExposure + i.requested - i.liquidLien;
  checks.push({
    code: "R5",
    rule: "R-5",
    title: "Per-party exposure limit",
    status: limit > 0 && aggregate <= limit ? "PASS" : "FAIL",
    detail: `Aggregate exposure across all banks ${fmt(aggregate)} (this bank ${fmt(i.existingBankExposure)}, other banks ${fmt(i.otherBankExposure)}, request ${fmt(i.requested)}, less liquid lien ${fmt(i.liquidLien)}) vs limit ${fmt(limit)}.`,
  });

  if (i.securityType === "CLEAN") {
    const clean = i.existingCleanExposure + i.requested;
    checks.push({
      code: "R9",
      rule: "R-9",
      title: "Clean facility cap",
      status: clean <= CLEAN_EXPOSURE_CAP ? "PASS" : "FAIL",
      detail: `Clean exposure ${fmt(clean)} vs cap ${fmt(CLEAN_EXPOSURE_CAP)} (excludes sponsors' consumer limits).`,
    });
  } else {
    checks.push({
      code: "R13",
      rule: "R-13",
      title: "Securities & margin",
      status: i.collateral.trim() ? "PASS" : "FAIL",
      detail: i.collateral.trim() ? `Security: ${i.collateral}` : "Secured facility requires security details per bank policy.",
    });
  }

  checks.push({
    code: "R11",
    rule: "R-11",
    title: "Related-party restriction",
    status: i.relatedParty ? "FAIL" : "PASS",
    detail: i.relatedParty
      ? "Customer is flagged as related to a director, 5%+ shareholder or the CEO — exposure prohibited."
      : "No related-party interest declared.",
  });

  if (!i.ecibCheckedAt) {
    checks.push({ code: "R7", rule: "R-7", title: "Credit information report", status: "WARN", detail: "Latest e-CIB / CIB report not yet obtained — RCAD must obtain it before clearance." });
  } else if (i.ecibOverdue) {
    checks.push({
      code: "R7",
      rule: "R-7",
      title: "Credit information report",
      status: i.ecibJustification.trim() ? "WARN" : "FAIL",
      detail: i.ecibJustification.trim()
        ? `Overdues reported; documented justification: ${i.ecibJustification}`
        : "e-CIB shows overdues — reasons for allowing financing must be documented in the approval form.",
    });
  } else {
    checks.push({ code: "R7", rule: "R-7", title: "Credit information report", status: "PASS", detail: `e-CIB obtained ${i.ecibCheckedAt.toISOString().slice(0, 10)}; no overdues.` });
  }

  const prohibited = prohibitedSector(i.sector);
  checks.push({
    code: "SHARIAH_SECTOR",
    rule: "Shariah screening",
    title: "Permissible business activity",
    status: prohibited ? "FAIL" : "PASS",
    detail: prohibited ? `Business activity "${i.sector}" is not Shariah-permissible.` : "Business activity is Shariah-permissible.",
  });

  checks.push({
    code: "KYC",
    rule: "AML/CFT Regulations",
    title: "KYC / CDD",
    status: i.kycStatus === "CLEARED" ? "PASS" : "WARN",
    detail: i.kycStatus === "CLEARED" ? "Customer KYC/CDD cleared by RCAD." : "KYC/CDD pending — RCAD clearance will be blocked until cleared.",
  });

  return checks;
}

// --- Shariah screening ----------------------------------------------------------

export const PROHIBITED_SECTORS = [
  "Alcohol & liquor",
  "Pork & non-halal meat",
  "Gambling & casinos",
  "Conventional banking / insurance",
  "Adult entertainment",
  "Interest-based lending",
  "Tobacco manufacturing",
];

export const SECTORS = [
  "Textiles & apparel",
  "Food processing (halal)",
  "Agriculture & agri-trading",
  "Auto parts & engineering",
  "Pharmaceuticals",
  "Construction materials",
  "Wholesale & retail trade",
  "Leather & footwear",
  "Surgical instruments",
  "Sports goods",
  "IT & software services",
  "Logistics & transport",
  "Furniture",
  "Plastics & packaging",
  "Education services",
  "Healthcare services",
  ...PROHIBITED_SECTORS,
];

export function prohibitedSector(sector: string): boolean {
  return PROHIBITED_SECTORS.some((p) => p.toLowerCase() === sector.toLowerCase());
}

// --- R-16 turnaround time ---------------------------------------------------------

/** Adds working days (Mon–Fri) excluding the supplied public holidays (YYYY-MM-DD). */
export function addWorkingDays(start: Date, days: number, holidays: string[] = []): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidays.includes(d.toISOString().slice(0, 10))) continue;
    added++;
  }
  return d;
}

export function workingDaysBetween(from: Date, to: Date, holidays: string[] = []): number {
  let count = 0;
  const d = new Date(from);
  while (d < to) {
    d.setDate(d.getDate() + 1);
    if (d > to) break;
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.includes(d.toISOString().slice(0, 10))) count++;
  }
  return count;
}

// --- R-17 / Annexure I & II: classification & provisioning -----------------------

export type Classification = "REGULAR" | "SUBSTANDARD" | "DOUBTFUL" | "LOSS";

export function classifyByDpd(daysPastDue: number, tradeBill = false): Classification {
  if (daysPastDue >= 365 || (tradeBill && daysPastDue >= 180)) return "LOSS";
  if (daysPastDue >= 180) return "DOUBTFUL";
  if (daysPastDue >= 90) return "SUBSTANDARD";
  return "REGULAR";
}

export const PROVISION_RATE: Record<Classification, number> = { REGULAR: 0, SUBSTANDARD: 0.25, DOUBTFUL: 0.5, LOSS: 1 };

export type CollateralForFsv = {
  kind: "MORTGAGED_PROPERTY" | "PLANT_MACHINERY" | "PLEDGED_STOCK" | "HYPOTHECATED" | "OTHER";
  fsv: number;
};

/** Annexure II FSV benefit by year since classification (1-based). */
export function fsvBenefitRate(kind: CollateralForFsv["kind"], yearSinceClassification: number): number {
  const y = yearSinceClassification;
  if (kind === "MORTGAGED_PROPERTY") return [0.75, 0.6, 0.45, 0.3, 0.2][y - 1] ?? 0;
  if (kind === "PLANT_MACHINERY") return [0.3, 0.2, 0.1][y - 1] ?? 0;
  if (kind === "PLEDGED_STOCK") return y <= 3 ? 0.4 : 0;
  return 0; // hypothecated / second / floating charges get no benefit
}

export function requiredProvision(opts: {
  classification: Classification;
  outstandingPrincipal: number;
  liquidAssets: number;
  collateral: CollateralForFsv[];
  yearSinceClassification: number;
  ifrs9Ecl?: number;
}) {
  const fsvBenefit = opts.collateral.reduce((s, c) => s + c.fsv * fsvBenefitRate(c.kind, opts.yearSinceClassification), 0);
  const base = Math.max(0, opts.outstandingPrincipal - opts.liquidAssets - fsvBenefit);
  const prProvision = base * PROVISION_RATE[opts.classification];
  return { fsvBenefit, base, prProvision, provision: Math.max(prProvision, opts.ifrs9Ecl ?? 0) };
}

// --- R-18 restructuring ------------------------------------------------------------

export function canDeclassifyAfterRestructuring(opts: { outstanding: number; cashRecovered: number; monthsPerformingSinceRestructure: number }) {
  const pct = opts.outstanding > 0 ? opts.cashRecovered / opts.outstanding : 0;
  if (pct >= 0.35) return { allowed: true, reason: "35%+ of outstanding recovered in cash." };
  if (pct >= 0.1 && opts.monthsPerformingSinceRestructure >= 6) return { allowed: true, reason: "10%+ recovered in cash and six months of performance." };
  return { allowed: false, reason: "Requires 10% cash recovery with six months' performance, or 35% cash recovery." };
}
