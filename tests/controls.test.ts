// Negative tests: every control must refuse the wrong actor / wrong order.
import { describe, expect, it } from "vitest";
import { GENESIS_HASH, verifyChain } from "../src/lib/audit";
import { TRACK_CHECKLISTS } from "../src/lib/constants";
import { db } from "../src/lib/db";
import { autopilot, step } from "../src/lib/demo/autopilot";
import { demoPng } from "../src/lib/demo/png";
import { createCase, decideApproval, decideClearance, submitCase } from "../src/lib/engine/cases";
import { requestSigningOtp, signDocument } from "../src/lib/engine/documents";
import { SHARIAH_REVIEW_CHECKLIST, completeAction, shariahReview, submitEvidence, verifyEvidence } from "../src/lib/engine/execution";
import { actor, fixture } from "./helpers";

const M = 1_000_000;

async function murabaha(overrides: Record<string, unknown> = {}, structure: Record<string, string> = {}) {
  const f = await fixture();
  return createCase(await actor("rm.ali"), {
    customerId: f.customer.id,
    productCode: "MURABAHA",
    purpose: "Raw material purchase",
    amount: 5 * M,
    tenorMonths: 12,
    profitRate: 16,
    repayment: "MONTHLY",
    securityType: "SECURED",
    collateral: "Hypothecation of stocks",
    structure: { assetDescription: "Cotton bales", quantity: "500 bales", supplierName: "Ginners Ltd", quotationRef: "Q-9", deliveryLocation: "Lahore", purchaseMode: "CUSTOMER_AGENT", ...structure },
    ...overrides,
  });
}

describe("submission gates", () => {
  it("blocks exposure above the R-5 per-party limit", async () => {
    const c = await murabaha({ amount: 120 * M, tenorMonths: 12 });
    await expect(submitCase(await actor("rm.ali"), c.id)).rejects.toThrow(/R-5/);
  });
  it("blocks clean exposure above PKR 50m (R-9)", async () => {
    const c = await murabaha({ amount: 55 * M, securityType: "CLEAN", collateral: "" });
    await expect(submitCase(await actor("rm.ali"), c.id)).rejects.toThrow(/R-9/);
  });
  it("blocks Murabaha on cash / non-tangible subject matter", async () => {
    const c = await murabaha({}, { assetDescription: "Cash for salary payments" });
    await expect(submitCase(await actor("rm.ali"), c.id)).rejects.toThrow(/Shariah/);
  });
  it("blocks Salam on gold", async () => {
    const f = await fixture();
    const c = await createCase(await actor("rm.ali"), {
      customerId: f.customer.id, productCode: "SALAM", purpose: "Gold forward", amount: 2 * M, tenorMonths: 6, profitRate: 15, repayment: "BULLET", securityType: "SECURED", collateral: "Lien",
      structure: { commodity: "Gold bars", quantity: "1 kg", qualitySpecs: "24k", deliveryDate: "2027-01-01", deliveryPlace: "Karachi" },
    });
    await expect(submitCase(await actor("rm.ali"), c.id)).rejects.toThrow(/Gold, silver/);
  });
  it("rejects product terms outside the product definition", async () => {
    await expect(murabaha({ tenorMonths: 90 })).rejects.toThrow(/maximum tenor/);
  });
});

describe("segregation of duties", () => {
  it("only the owning role may decide a clearance track", async () => {
    const c = await murabaha();
    await submitCase(await actor("rm.ali"), c.id);
    await expect(decideClearance(await actor("legal.officer"), c.id, "RCAD", { decision: "CLEARED", checklist: TRACK_CHECKLISTS.RCAD, comments: "cleared by legal?" })).rejects.toThrow(/RCAD/);
  });
  it("the initiating RM cannot approve and levels follow the matrix", async () => {
    const c = await murabaha();
    await autopilot(c.id, "PENDING_APPROVAL");
    await expect(decideApproval(await actor("uh.gulberg"), c.id, { decision: "APPROVE", comments: "skip TL" })).rejects.toThrow(/Team Leader/);
    await expect(decideApproval(await actor("rm.ali"), c.id, { decision: "APPROVE", comments: "self" })).rejects.toThrow();
  });
  it("a head outside the case's region cannot approve", async () => {
    const c = await murabaha({ amount: 40 * M });
    await autopilot(c.id, "PENDING_APPROVAL");
    await step(c.id, "ACTIVE"); // TL recommends
    await step(c.id, "ACTIVE"); // UH recommends
    await expect(decideApproval(await actor("rh.south"), c.id, { decision: "APPROVE", comments: "not my region" })).rejects.toThrow(/delegated area/);
  });
});

describe("signing & execution controls", () => {
  it("documentation loop: RCAD → bank → customer → RCAD/RM, with OTP and typed name", async () => {
    const c = await murabaha();
    await autopilot(c.id, "EXECUTION");
    const mmfa = await db.document.findFirstOrThrow({ where: { caseId: c.id, code: "MMFA" } });
    const ceo = await actor("ceo");
    const rcad = await actor("rcad.officer");
    const sign = async (a: Awaited<ReturnType<typeof actor>>) => {
      const otp = await requestSigningOtp(a, mmfa.id);
      await signDocument(a, mmfa.id, { challengeId: otp.challengeId, otp: otp.devCode!, typedName: a.name, consent: true, decision: "SIGNED" });
    };
    // 1. RCAD prepares first — nobody else can jump the queue
    await expect(requestSigningOtp(ceo, mmfa.id)).rejects.toThrow(/reserved for: RCAD/);
    await sign(rcad);
    // 2. bank signatories (RM allowed), four eyes between the two bank signatures
    await expect(requestSigningOtp(ceo, mmfa.id)).rejects.toThrow(/reserved for: Bank/);
    const rm = await actor("rm.ali");
    await sign(rm);
    await expect(requestSigningOtp(rm, mmfa.id)).rejects.toThrow(/reserved for: Bank — Second/);
    await sign(await actor("tl.gulberg"));
    // 3. customer: wrong OTP and wrong name are refused
    const otp = await requestSigningOtp(ceo, mmfa.id);
    await expect(signDocument(ceo, mmfa.id, { challengeId: otp.challengeId, otp: otp.devCode === "000000" ? "111111" : "000000", typedName: ceo.name, consent: true, decision: "SIGNED" })).rejects.toThrow(/Incorrect OTP/);
    await expect(signDocument(ceo, mmfa.id, { challengeId: otp.challengeId, otp: otp.devCode!, typedName: "Someone Else", consent: true, decision: "SIGNED" })).rejects.toThrow(/full name/);
    await signDocument(ceo, mmfa.id, { challengeId: otp.challengeId, otp: otp.devCode!, typedName: ceo.name, consent: true, decision: "SIGNED" });
    expect((await db.otpChallenge.findUniqueOrThrow({ where: { id: otp.challengeId } })).attempts).toBe(1);
    // 4. back to RCAD / RM to verify — then the document is executed
    await expect(requestSigningOtp(ceo, mmfa.id)).rejects.toThrow(/reserved for: RCAD \/ RM/);
    await sign(rcad);
    expect((await db.document.findUniqueOrThrow({ where: { id: mmfa.id } })).status).toBe("EXECUTED");
  });

  it("Murabaha sale cannot happen before possession; possession requires GPS; maker-checker on payment & evidence", async () => {
    const c = await murabaha();
    await autopilot(c.id, "EXECUTION");
    expect(await db.document.count({ where: { caseId: c.id, code: "MURABAHA_DECLARATION" } })).toBe(0);
    const ceo = await actor("ceo");
    const meta = { caseId: c.id, stepKey: "possession", category: "POSSESSION", description: "Bales at godown", assetRef: "", clientTime: "", locationNote: "" };
    const file = { buffer: demoPng(1), name: "p.png", type: "image/png" };
    await expect(submitEvidence(ceo, meta, file)).rejects.toThrow(/Preceding steps/);

    for (let i = 0; i < 40; i++) {
      const st = await db.executionStep.findUniqueOrThrow({ where: { caseId_key: { caseId: c.id, key: "supplier_payment" } } });
      if (st.status === "READY") break;
      await step(c.id, "ACTIVE");
    }
    const pay = await db.executionStep.findUniqueOrThrow({ where: { caseId_key: { caseId: c.id, key: "supplier_payment" } } });
    expect(pay.status).toBe("READY");
    const maker = await actor("rcad.officer");
    await expect(completeAction(await actor("rm.ali"), pay.id, { paymentRef: "X", amount: String(5 * M), payee: "Ginners" })).rejects.toThrow(/RCAD/);
    await expect(completeAction(maker, pay.id, { paymentRef: "X", amount: String(6 * M), payee: "Ginners" })).rejects.toThrow(/exceeds the sanctioned amount/);
    await completeAction(maker, pay.id, { paymentRef: "PAY-1", amount: String(5 * M), payee: "Ginners Ltd" });
    await expect(completeAction(maker, pay.id, {}, true)).rejects.toThrow(/Team Leader or Unit Head/);
    await completeAction(await actor("uh.gulberg"), pay.id, {}, true);

    await expect(submitEvidence({ ...ceo, geo: null }, meta, file)).rejects.toThrow(/GPS/);
    const rm = await actor("rm.ali");
    const ev = await submitEvidence(rm, meta, file);
    await expect(verifyEvidence(rm, ev.id, "VERIFIED", "self check")).rejects.toThrow(/Maker-checker/);
  });

  it("offer reaches the customer automatically once the bank signs; Shariah reviews after disbursement", async () => {
    const c = await murabaha();
    await autopilot(c.id, "OFFERED");
    expect((await db.financingCase.findUniqueOrThrow({ where: { id: c.id } })).offeredAt).not.toBeNull();
    const done = await autopilot(c.id, "ACTIVE");
    expect(done.shariahReviewStatus).toBe("PENDING");
    await expect(shariahReview(await actor("rcad.officer"), c.id, { decision: "COMPLIANT", checklist: SHARIAH_REVIEW_CHECKLIST, comments: "not mine to do" })).rejects.toThrow(/Shariah Compliance Officer/);
    await expect(shariahReview(await actor("shariah.officer"), c.id, { decision: "COMPLIANT", checklist: [], comments: "incomplete checklist" })).rejects.toThrow(/Confirm all items/);
    await shariahReview(await actor("shariah.officer"), c.id, { decision: "COMPLIANT", checklist: SHARIAH_REVIEW_CHECKLIST, comments: "Sequence and possession compliant." });
    expect((await db.financingCase.findUniqueOrThrow({ where: { id: c.id } })).shariahReviewStatus).toBe("COMPLIANT");
  });
});

describe("tamper evidence", () => {
  it("database refuses to alter audit events, signatures or executed text", async () => {
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET "summary" = 'edited'`)).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe(`DELETE FROM "Signature"`)).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe(`UPDATE "Document" SET "content" = 'forged'`)).rejects.toThrow(/immutable/);
  });

  it("hash chain detects edits made by bypassing the triggers", async () => {
    const f = await fixture();
    expect((await verifyChain(f.tenant.id)).ok).toBe(true);
    await db.$executeRawUnsafe(`DROP TRIGGER "AuditEvent_no_update"`);
    try {
      await db.$executeRawUnsafe(`UPDATE "AuditEvent" SET "summary" = 'forged' WHERE "tenantId" = ? AND "seq" = 2`, f.tenant.id);
      const v = await verifyChain(f.tenant.id);
      expect(v.ok).toBe(false);
      expect(v.brokenAtSeq).toBe(2);
    } finally {
      await db.$executeRawUnsafe(`CREATE TRIGGER "AuditEvent_no_update" BEFORE UPDATE ON "AuditEvent" BEGIN SELECT RAISE(ABORT, 'AuditEvent is append-only'); END;`);
    }
    expect(GENESIS_HASH).toHaveLength(64);
  });
});
