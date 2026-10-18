// End-to-end: every Islamic product goes from request to ACTIVE through the
// real engine, with the correct role-holder performing every step.
import { describe, expect, it } from "vitest";
import { verifyChain } from "../src/lib/audit";
import { db } from "../src/lib/db";
import { autopilot, shariahSignOff } from "../src/lib/demo/autopilot";
import { createCase } from "../src/lib/engine/cases";
import { verifyDocumentIntegrity } from "../src/lib/engine/documents";
import { actor, fixture, future } from "./helpers";

const M = 1_000_000;

const CASES: Record<string, { repayment: string; tenorMonths: number; amount: number; structure: Record<string, string> }> = {
  MURABAHA: { repayment: "MONTHLY", tenorMonths: 12, amount: 10 * M, structure: { assetDescription: "Cotton yarn 30s", quantity: "50 MT", supplierName: "Yarn Mills Ltd", quotationRef: "Q-1", deliveryLocation: "Lahore", purchaseMode: "CUSTOMER_AGENT", guarantorName: "Test Guarantor" } },
  TIJARAH: { repayment: "BULLET", tenorMonths: 6, amount: 8 * M, structure: { goodsDescription: "Finished greige fabric", quantity: "200,000 m", warehouseLocation: "Lahore", targetBuyers: "Exporters" } },
  ISTISNA: { repayment: "QUARTERLY", tenorMonths: 36, amount: 20 * M, structure: { specifications: "Boiler 10 TPH", contractorName: "Boilers Co", siteAddress: "Lahore", deliveryDate: future(200), milestones: "2" } },
  ISTISNA_WC: { repayment: "BULLET", tenorMonths: 6, amount: 9 * M, structure: { goodsSpecifications: "Knitted garments", quantity: "50,000 pcs", deliveryDate: future(120), deliveryPlace: "Lahore" } },
  DIMINISHING_MUSHARAKAH: { repayment: "MONTHLY", tenorMonths: 36, amount: 15 * M, structure: { assetDescription: "Warehouse", assetType: "PROPERTY", totalAssetValue: String(20 * M), vendorName: "Estate Co", assetLocation: "Lahore" } },
  IJARAH: { repayment: "MONTHLY", tenorMonths: 36, amount: 6 * M, structure: { assetDescription: "Delivery truck", assetType: "VEHICLE", vendorName: "Motors Ltd", securityDeposit: "600000" } },
  SALAM: { repayment: "BULLET", tenorMonths: 6, amount: 7 * M, structure: { commodity: "Basmati rice", quantity: "300 MT", qualitySpecs: "Super Kernel, 2% broken max", deliveryDate: future(150), deliveryPlace: "Gujranwala" } },
  RUNNING_MUSHARAKAH: { repayment: "QUARTERLY", tenorMonths: 12, amount: 12 * M, structure: { businessDescription: "Yarn trading", bankProfitShare: "60", expectedProfitRate: "25" } },
};

describe("product workflows run end to end", () => {
  for (const [productCode, c] of Object.entries(CASES)) {
    it(`${productCode}: request → sanction → offer → execution → active`, async () => {
      const f = await fixture();
      const rm = await actor("rm.ali");
      const kase = await createCase(rm, {
        customerId: f.customer.id,
        productCode,
        purpose: `Test ${productCode} facility`,
        amount: c.amount,
        tenorMonths: c.tenorMonths,
        profitRate: 15,
        repayment: c.repayment,
        securityType: "SECURED",
        collateral: "Charge over assets with 25% margin",
        structure: c.structure,
      });
      const done = await autopilot(kase.id, "ACTIVE");
      expect(done.stage).toBe("ACTIVE");
      expect(done.shariahReviewStatus).toBe("PENDING");
      await shariahSignOff(kase.id);
      // every execution actor is in the simple loop: RCAD, RM, TL, UH, customer
      const actors = await db.auditEvent.findMany({ where: { caseId: kase.id, eventType: { in: ["DOCUMENT_SIGNED", "STEP_COMPLETED", "EVIDENCE_CAPTURED", "EVIDENCE_VERIFIED", "DISBURSEMENT_INITIATED", "DISBURSEMENT_AUTHORISED"] } }, select: { actorRole: true } });
      const loopRoles = new Set(["RCAD", "RM", "TEAM_LEADER", "UNIT_HEAD", "CUSTOMER_SIGNATORY", "CUSTOMER_USER", "GUARANTOR"]);
      expect([...new Set(actors.map((a) => a.actorRole))].filter((r) => !loopRoles.has(r))).toEqual([]);

      const steps = await db.executionStep.findMany({ where: { caseId: kase.id } });
      expect(steps.every((s) => s.status === "DONE")).toBe(true);
      const docs = await db.document.findMany({ where: { caseId: kase.id } });
      expect(docs.every((d) => d.status === "EXECUTED")).toBe(true);
      for (const d of docs) expect((await verifyDocumentIntegrity(d.id, f.tenant.id)).ok).toBe(true);
      expect(await db.installment.count({ where: { caseId: kase.id } })).toBeGreaterThan(0);
      const sig = await db.signature.findFirst({ where: { document: { caseId: kase.id }, party: "CUSTOMER" } });
      expect(sig?.lat).toBeTypeOf("number");
      expect((await verifyChain(f.tenant.id)).ok).toBe(true);
    });
  }
});

describe("routing", () => {
  it("'RM' in a signing or evidence slot means the case's own RM (second RM in the same team)", async () => {
    const f = await fixture();
    const { seedCustomer } = await import("../src/lib/demo/seed");
    const cust = await seedCustomer(db, f.tenant.id, f.userIds["rm.sara"], {
      legalName: "Second RM Traders", legalForm: "PARTNERSHIP", ntn: "7654321-0", sector: "Wholesale & retail trade", city: "Lahore", address: "2 Test Road",
      annualTurnover: 50 * M, establishedOn: new Date("2018-01-01"), kycCleared: true,
      people: [{ fullName: "Partner One", cnic: "35202-2222222-2", role: "PARTNER", sharePct: 100 }],
      users: [{ username: `${f.code.toLowerCase()}.second`, fullName: "Partner One", role: "CUSTOMER_SIGNATORY" }],
    });
    const kase = await createCase(await actor("rm.sara"), {
      customerId: cust.id, productCode: "MURABAHA", purpose: "Stock purchase", amount: 3 * M, tenorMonths: 6, profitRate: 15, repayment: "MONTHLY",
      securityType: "SECURED", collateral: "Hypothecation", structure: { assetDescription: "Rice bags", quantity: "100 MT", supplierName: "Mills Ltd", quotationRef: "Q", deliveryLocation: "Lahore", purchaseMode: "CUSTOMER_AGENT" },
    });
    expect((await autopilot(kase.id, "ACTIVE")).stage).toBe("ACTIVE");
    const rmSigs = await db.signature.findMany({ where: { document: { caseId: kase.id }, signerRole: "RM" } });
    expect(rmSigs.every((s) => s.signerId === f.userIds["rm.sara"])).toBe(true);
    const notified = await db.notification.findMany({ where: { userId: f.userIds["rm.ali"], link: { contains: kase.id } } });
    expect(notified).toHaveLength(0);
  });
});
