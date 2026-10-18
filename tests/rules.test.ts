import { describe, expect, it } from "vitest";
import { buildSchedule, amountInWords } from "../src/lib/pricing";
import { PRODUCTS, allDocSpecs, buildExecutionPlan } from "../src/lib/products/catalog";
import { merge, renderMarkdown } from "../src/lib/render";
import { addWorkingDays, canDeclassifyAfterRestructuring, classifyByDpd, classifySme, fsvBenefitRate, perPartyLimit, requiredProvision, runRegulatoryChecks } from "../src/lib/sbp";
import { TEMPLATE_LIBRARY } from "../src/lib/templates/library";
import { DEFAULT_SETTINGS, approvalChain } from "../src/lib/tenant";

const M = 1_000_000;

describe("SBP SME PR Part-I definitions", () => {
  it("classifies by annual turnover", () => {
    expect(classifySme(30 * M).category).toBe("MICRO");
    expect(classifySme(30 * M + 1).category).toBe("SMALL");
    expect(classifySme(400 * M).category).toBe("SMALL");
    expect(classifySme(400 * M + 1).category).toBe("MEDIUM");
    expect(classifySme(2000 * M).category).toBe("MEDIUM");
    expect(classifySme(2000 * M + 1).category).toBe("NOT_SME");
  });
  it("flags start-ups up to 5 years old", () => {
    const asOf = new Date("2026-10-18");
    expect(classifySme(10 * M, new Date("2022-01-01"), asOf).isStartup).toBe(true);
    expect(classifySme(10 * M, new Date("2020-01-01"), asOf).isStartup).toBe(false);
  });
});

describe("R-5 / R-9 limits and checks", () => {
  it("per-party limits", () => {
    expect(perPartyLimit("MICRO")).toBe(100 * M);
    expect(perPartyLimit("SMALL")).toBe(100 * M);
    expect(perPartyLimit("MEDIUM")).toBe(500 * M);
  });
  const base = { smeCategory: "SMALL" as const, requested: 60 * M, securityType: "SECURED" as const, liquidLien: 0, existingBankExposure: 20 * M, existingCleanExposure: 0, otherBankExposure: 15 * M, relatedParty: false, ecibCheckedAt: new Date(), ecibOverdue: false, ecibJustification: "", collateral: "Mortgage", kycStatus: "CLEARED", sector: "Textiles & apparel" };
  it("aggregates exposure across all banks and deducts liquid lien", () => {
    expect(runRegulatoryChecks(base).find((c) => c.code === "R5")?.status).toBe("PASS");
    expect(runRegulatoryChecks({ ...base, requested: 70 * M }).find((c) => c.code === "R5")?.status).toBe("FAIL");
    expect(runRegulatoryChecks({ ...base, requested: 70 * M, liquidLien: 10 * M }).find((c) => c.code === "R5")?.status).toBe("PASS");
  });
  it("caps clean exposure at PKR 50m", () => {
    expect(runRegulatoryChecks({ ...base, securityType: "CLEAN", requested: 50 * M, existingBankExposure: 0, otherBankExposure: 0 }).find((c) => c.code === "R9")?.status).toBe("PASS");
    expect(runRegulatoryChecks({ ...base, securityType: "CLEAN", requested: 51 * M, existingBankExposure: 0, otherBankExposure: 0 }).find((c) => c.code === "R9")?.status).toBe("FAIL");
  });
  it("blocks related parties and prohibited sectors", () => {
    expect(runRegulatoryChecks({ ...base, relatedParty: true }).find((c) => c.code === "R11")?.status).toBe("FAIL");
    expect(runRegulatoryChecks({ ...base, sector: "Alcohol & liquor" }).find((c) => c.code === "SHARIAH_SECTOR")?.status).toBe("FAIL");
  });
  it("requires documented reasons for e-CIB overdues (R-7)", () => {
    expect(runRegulatoryChecks({ ...base, ecibOverdue: true }).find((c) => c.code === "R7")?.status).toBe("FAIL");
    expect(runRegulatoryChecks({ ...base, ecibOverdue: true, ecibJustification: "Settled dispute" }).find((c) => c.code === "R7")?.status).toBe("WARN");
  });
});

describe("R-17 / Annexures I & II", () => {
  it("classifies by days past due", () => {
    expect(classifyByDpd(89)).toBe("REGULAR");
    expect(classifyByDpd(90)).toBe("SUBSTANDARD");
    expect(classifyByDpd(180)).toBe("DOUBTFUL");
    expect(classifyByDpd(365)).toBe("LOSS");
    expect(classifyByDpd(180, true)).toBe("LOSS");
  });
  it("applies the FSV benefit schedule", () => {
    expect(fsvBenefitRate("MORTGAGED_PROPERTY", 1)).toBe(0.75);
    expect(fsvBenefitRate("MORTGAGED_PROPERTY", 5)).toBe(0.2);
    expect(fsvBenefitRate("MORTGAGED_PROPERTY", 6)).toBe(0);
    expect(fsvBenefitRate("PLANT_MACHINERY", 3)).toBe(0.1);
    expect(fsvBenefitRate("PLEDGED_STOCK", 3)).toBe(0.4);
    expect(fsvBenefitRate("HYPOTHECATED", 1)).toBe(0);
  });
  it("computes provision as % of (principal − liquid − FSV benefit), or ECL if higher", () => {
    const p = requiredProvision({ classification: "DOUBTFUL", outstandingPrincipal: 100 * M, liquidAssets: 10 * M, collateral: [{ kind: "MORTGAGED_PROPERTY", fsv: 40 * M }], yearSinceClassification: 1 });
    expect(p.fsvBenefit).toBe(30 * M);
    expect(p.provision).toBe(30 * M); // 50% of 60m
    expect(requiredProvision({ classification: "SUBSTANDARD", outstandingPrincipal: 10 * M, liquidAssets: 0, collateral: [], yearSinceClassification: 1, ifrs9Ecl: 4 * M }).provision).toBe(4 * M);
  });
  it("R-18 declassification conditions", () => {
    expect(canDeclassifyAfterRestructuring({ outstanding: 100, cashRecovered: 35, monthsPerformingSinceRestructure: 0 }).allowed).toBe(true);
    expect(canDeclassifyAfterRestructuring({ outstanding: 100, cashRecovered: 10, monthsPerformingSinceRestructure: 5 }).allowed).toBe(false);
    expect(canDeclassifyAfterRestructuring({ outstanding: 100, cashRecovered: 10, monthsPerformingSinceRestructure: 6 }).allowed).toBe(true);
  });
  it("R-16 TAT skips weekends and holidays", () => {
    const fri = new Date("2026-10-16T09:00:00");
    expect(addWorkingDays(fri, 1).getDay()).toBe(1); // Monday
    expect(addWorkingDays(fri, 15).toISOString().slice(0, 10)).toBe("2026-11-06");
  });
});

describe("Approval matrix", () => {
  it("routes to the lowest authority covering the amount", () => {
    expect(approvalChain(DEFAULT_SETTINGS, 10 * M, false).map((x) => `${x.role}:${x.action}`)).toEqual(["TEAM_LEADER:RECOMMEND", "UNIT_HEAD:APPROVE"]);
    expect(approvalChain(DEFAULT_SETTINGS, 60 * M, false).at(-1)?.role).toBe("REGIONAL_HEAD");
    expect(approvalChain(DEFAULT_SETTINGS, 300 * M, false).at(-1)?.role).toBe("COUNTRY_HEAD");
  });
  it("escalates clean facilities", () => {
    expect(approvalChain(DEFAULT_SETTINGS, 12 * M, true).at(-1)?.role).toBe("REGIONAL_HEAD");
  });
});

describe("Pricing", () => {
  it("annuity schedule repays exactly the cost", () => {
    const s = buildSchedule({ model: "COST_PLUS", amount: 12 * M, tenorMonths: 12, profitRate: 18, repayment: "MONTHLY", startDate: new Date("2026-01-01"), structure: {} });
    expect(s.lines).toHaveLength(12);
    expect(s.lines.reduce((a, l) => a + l.principal, 0)).toBeCloseTo(12 * M, 0);
    expect(s.totalPayable).toBeGreaterThan(12 * M);
  });
  it("diminishing musharakah reduces bank share to zero", () => {
    const s = buildSchedule({ model: "DM_UNITS", amount: 60 * M, tenorMonths: 60, profitRate: 15, repayment: "MONTHLY", startDate: new Date(), structure: { totalAssetValue: String(80 * M) } });
    expect(s.lines).toHaveLength(60);
    expect(s.lines[0].bankShare).toBeCloseTo(73.75, 2);
    expect(s.lines.at(-1)?.bankShare).toBe(0);
    expect(s.lines[0].profit).toBeGreaterThan(s.lines.at(-1)!.profit);
  });
  it("amount in words (South Asian system)", () => {
    expect(amountInWords(8_000_000)).toBe("Rupees Eighty Lakh Only");
    expect(amountInWords(125_450_000)).toBe("Rupees Twelve Crore Fifty-Four Lakh Fifty Thousand Only");
  });
});

describe("Templates & rendering", () => {
  it("every product document has a seed template", () => {
    const codes = new Set(TEMPLATE_LIBRARY.map((t) => t.code));
    for (const p of PRODUCTS) for (const d of allDocSpecs(p)) expect(codes.has(d.code), `${p.code}/${d.code}`).toBe(true);
  });
  it("every SIGN step references a document of its product", () => {
    for (const p of PRODUCTS) {
      const plan = buildExecutionPlan(p, { amount: 10 * M, tenorMonths: 12, profitRate: 15, repayment: p.repaymentOptions[0], securityType: "SECURED", structure: { milestones: "2", guarantorName: "G" } });
      const keys = new Set(plan.map((s) => s.key));
      for (const s of plan) {
        if (s.kind === "SIGN") expect(allDocSpecs(p).some((d) => d.code === s.docCode)).toBe(true);
        for (const d of s.dependsOn) expect(keys.has(d), `${p.code}:${s.key} depends on ${d}`).toBe(true);
      }
    }
  });
  it("escapes HTML and flags missing placeholders", () => {
    const { text, missing } = merge("Hello {{a.b}} {{c}}", { a: { b: "<script>x</script>" } });
    expect(missing).toEqual(["c"]);
    const html = renderMarkdown(text);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("doc-missing");
  });
  it("renders RTL Urdu blocks and tables", () => {
    const html = renderMarkdown(":::urdu\n## عنوان\n:::\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("<th>a</th>");
  });
});
