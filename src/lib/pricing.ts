// Pricing & repayment schedules per Islamic mode.
//  - COST_PLUS (Murabaha, Tijarah, Istisna, Salam): fixed sale price = cost + profit,
//    instalments derived from an annuity at the agreed profit rate (price fixed at sale).
//  - RENTAL (Ijarah): level rentals recovering asset cost plus return.
//  - DM_UNITS (Diminishing Musharakah): equal unit purchases + rental on bank's outstanding share.
//  - PROFIT_SHARE (Running Musharakah): provisional profit per period, settled on actuals.
import type { PricingModel } from "./products/types";

export type ScheduleLine = {
  seq: number;
  dueDate: Date;
  principal: number;
  profit: number;
  total: number;
  units: number;
  bankShare: number;
};

export type PricingInput = {
  model: PricingModel;
  amount: number;
  tenorMonths: number;
  profitRate: number; // % p.a.
  repayment: string;
  startDate: Date;
  structure: Record<string, string>;
};

export type PricingSummary = {
  cost: number;
  profit: number;
  totalPayable: number;
  instalments: number;
  instalmentAmount: number;
  labels: { principal: string; profit: string };
  lines: ScheduleLine[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;

function periods(repayment: string, tenorMonths: number) {
  if (repayment === "BULLET") return { count: 1, months: tenorMonths };
  const months = repayment === "QUARTERLY" ? 3 : 1;
  return { count: Math.max(1, Math.round(tenorMonths / months)), months };
}

function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

function annuity(principal: number, ratePerPeriod: number, count: number) {
  if (ratePerPeriod === 0) return principal / count;
  return (principal * ratePerPeriod) / (1 - Math.pow(1 + ratePerPeriod, -count));
}

export function buildSchedule(p: PricingInput): PricingSummary {
  const { count, months } = periods(p.repayment, p.tenorMonths);
  const r = p.profitRate / 100;
  const lines: ScheduleLine[] = [];

  if (p.model === "DM_UNITS") {
    const total = Number(p.structure.totalAssetValue) || p.amount;
    const unitPrice = p.amount / count;
    let outstanding = p.amount;
    for (let i = 1; i <= count; i++) {
      const rent = outstanding * r * (months / 12);
      outstanding -= unitPrice;
      lines.push({
        seq: i,
        dueDate: addMonths(p.startDate, months * i),
        principal: round2(unitPrice),
        profit: round2(rent),
        total: round2(unitPrice + rent),
        units: 1,
        bankShare: round2(Math.max(0, outstanding) / total * 100),
      });
    }
    return summarise(p.amount, lines, { principal: "Unit purchase price", profit: "Rental on bank's share" });
  }

  if (p.model === "PROFIT_SHARE") {
    const expected = Number(p.structure.expectedProfitRate) || p.profitRate;
    const share = (Number(p.structure.bankProfitShare) || 0) / 100;
    const q = Math.max(1, Math.round(p.tenorMonths / 3));
    for (let i = 1; i <= q; i++) {
      const prov = p.amount * (expected / 100) * share * 0.25;
      const principal = i === q ? p.amount : 0;
      lines.push({ seq: i, dueDate: addMonths(p.startDate, 3 * i), principal, profit: round2(prov), total: round2(principal + prov), units: 0, bankShare: 0 });
    }
    return summarise(p.amount, lines, { principal: "Capital redemption", profit: "Provisional profit (settled on actuals)" });
  }

  if (p.repayment === "BULLET") {
    const profit = p.amount * r * (p.tenorMonths / 12);
    lines.push({ seq: 1, dueDate: addMonths(p.startDate, p.tenorMonths), principal: round2(p.amount), profit: round2(profit), total: round2(p.amount + profit), units: 0, bankShare: 0 });
  } else {
    const rp = r * (months / 12);
    const inst = annuity(p.amount, rp, count);
    let outstanding = p.amount;
    for (let i = 1; i <= count; i++) {
      const profit = outstanding * rp;
      const principal = i === count ? outstanding : inst - profit;
      outstanding -= principal;
      lines.push({
        seq: i,
        dueDate: addMonths(p.startDate, months * i),
        principal: round2(principal),
        profit: round2(profit),
        total: round2(principal + profit),
        units: 0,
        bankShare: 0,
      });
    }
  }
  return summarise(
    p.amount,
    lines,
    p.model === "RENTAL" ? { principal: "Rental (cost recovery)", profit: "Rental (return)" } : { principal: "Cost component", profit: "Profit component" },
  );
}

function summarise(cost: number, lines: ScheduleLine[], labels: PricingSummary["labels"]): PricingSummary {
  const profit = round2(lines.reduce((s, l) => s + l.profit, 0));
  const totalPayable = round2(lines.reduce((s, l) => s + l.total, 0));
  return { cost, profit, totalPayable, instalments: lines.length, instalmentAmount: lines[0]?.total ?? 0, labels, lines };
}

// --- formatting ------------------------------------------------------------------

export function pkr(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function pkrMillions(n: number): string {
  return `PKR ${(n / 1_000_000).toLocaleString("en-PK", { maximumFractionDigits: 2 })}m`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest >= 20) parts.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`);
  else if (rest) parts.push(ONES[rest]);
  return parts.join(" ");
}

/** Amount in words using the South Asian system (Crore / Lakh / Thousand). */
export function amountInWords(amount: number): string {
  let n = Math.floor(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? amountInWords(crore).replace(/^Rupees | Only$/g, "") : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return `Rupees ${parts.join(" ")} Only`;
}
