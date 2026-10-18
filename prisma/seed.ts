// Seeds two white-label tenants and demo cases at different lifecycle stages.
// Run with: npm run db:reset   (drops, migrates and seeds the database)
import { db } from "../src/lib/db";
import { createCase } from "../src/lib/engine/cases";
import { recordRepayment } from "../src/lib/engine/execution";
import { actorOf, autopilot } from "../src/lib/demo/autopilot";
import { DEMO_PASSWORD, IBP_ORGS, IBP_USERS, seedCustomer, seedTenant } from "../src/lib/demo/seed";

const M = 1_000_000;

async function main() {
  const ibp = await seedTenant(
    db,
    {
      code: "IBP",
      name: "Islamic Bank of Pakistan",
      legalName: "Islamic Bank of Pakistan Limited",
      bankType: "ISLAMIC",
      primaryColor: "#0b5d3b",
      accentColor: "#c8a24a",
      logoText: "IBP",
      tagline: "SME Islamic Banking",
      shariahBoardRef: "Shariah Board Resolution SB/2026/07",
    },
    IBP_ORGS,
    IBP_USERS,
  );

  // Second tenant shows the white-label model (conventional bank, Islamic window).
  await seedTenant(
    db,
    {
      code: "DCB",
      name: "Demo Commercial Bank — Islamic Banking",
      legalName: "Demo Commercial Bank Limited (Islamic Banking Division)",
      bankType: "CONVENTIONAL_IBW",
      primaryColor: "#1d3f8f",
      accentColor: "#f0a500",
      logoText: "DCB",
      tagline: "Islamic SME Finance",
      shariahBoardRef: "Shariah Board Resolution DCB-IBD/2026/03",
      settings: { approvalMatrix: [{ role: "TEAM_LEADER", limit: 0 }, { role: "UNIT_HEAD", limit: 15 * M }, { role: "REGIONAL_HEAD", limit: 75 * M }, { role: "COUNTRY_HEAD", limit: 500 * M }] },
    },
    [
      { code: "PK", type: "COUNTRY", name: "Pakistan" },
      { code: "C", type: "REGION", name: "Central Region", parent: "PK" },
      { code: "C-FSD", type: "UNIT", name: "Faisalabad Unit", parent: "C" },
      { code: "C-FSD-T1", type: "TEAM", name: "Faisalabad SME Team", parent: "C-FSD" },
    ],
    [
      { username: "admin", fullName: "DCB Administrator", role: "BANK_ADMIN", org: "PK" },
      { username: "rm.dcb", fullName: "Naveed Akhtar", role: "RM", org: "C-FSD-T1" },
      { username: "shariah.dcb", fullName: "Mufti Saad Ahmed", role: "SHARIAH", org: "PK" },
      { username: "legal.dcb", fullName: "Saima Bukhari", role: "LEGAL", org: "PK" },
    ],
  );

  const u = ibp.userIds;
  const alNoor = await seedCustomer(db, ibp.tenant.id, u["rm.ali"], {
    legalName: "Al-Noor Textiles (Pvt) Ltd",
    legalForm: "PRIVATE_LIMITED",
    ntn: "4231567-8",
    sector: "Textiles & apparel",
    city: "Lahore",
    address: "Plot 42, Sundar Industrial Estate, Raiwind Road",
    annualTurnover: 350 * M,
    establishedOn: new Date("2012-03-01"),
    kycCleared: true,
    people: [
      { fullName: "Muhammad Noor", cnic: "35202-1234567-1", role: "DIRECTOR", sharePct: 60 },
      { fullName: "Asma Noor", cnic: "35202-7654321-2", role: "DIRECTOR", sharePct: 40 },
    ],
    users: [
      { username: "noor.ceo", fullName: "Muhammad Noor", role: "CUSTOMER_SIGNATORY" },
      { username: "noor.accounts", fullName: "Kashif Ali", role: "CUSTOMER_USER" },
      { username: "noor.guarantor", fullName: "Asma Noor", role: "GUARANTOR" },
    ],
  });
  const barakah = await seedCustomer(db, ibp.tenant.id, u["rm.sara"], {
    legalName: "Barakah Agro Traders",
    legalForm: "PARTNERSHIP",
    ntn: "3398712-4",
    sector: "Agriculture & agri-trading",
    city: "Okara",
    address: "Grain Market, Depalpur Road",
    annualTurnover: 28 * M,
    establishedOn: new Date("2022-06-15"),
    kycCleared: true,
    womenLed: true,
    people: [
      { fullName: "Rashida Mahmood", cnic: "35301-2223334-4", role: "PARTNER", sharePct: 50 },
      { fullName: "Tahir Mahmood", cnic: "35301-5556667-5", role: "PARTNER", sharePct: 50 },
    ],
    users: [{ username: "barakah.partner", fullName: "Rashida Mahmood", role: "CUSTOMER_SIGNATORY" }],
  });
  const crescent = await seedCustomer(db, ibp.tenant.id, u["rm.zain"], {
    legalName: "Crescent Auto Parts",
    legalForm: "SOLE_PROPRIETOR",
    ntn: "1122334-5",
    sector: "Auto parts & engineering",
    city: "Karachi",
    address: "B-17, SITE Industrial Area",
    annualTurnover: 900 * M,
    establishedOn: new Date("2008-01-10"),
    kycCleared: false,
    people: [{ fullName: "Javed Iqbal", cnic: "42201-9876543-1", role: "PROPRIETOR", sharePct: 100 }],
    users: [{ username: "crescent.owner", fullName: "Javed Iqbal", role: "CUSTOMER_SIGNATORY" }],
  });

  const rm = async (username: string) => actorOf(await db.user.findFirstOrThrow({ where: { tenantId: ibp.tenant.id, username }, include: { orgUnit: true } }));

  // 1) Murabaha — fully executed and active, one instalment paid
  const c1 = await createCase(await rm("rm.sara"), {
    customerId: barakah.id,
    productCode: "MURABAHA",
    purpose: "Purchase of wheat seed and fertiliser for Rabi season",
    amount: 8 * M,
    tenorMonths: 12,
    profitRate: 16.5,
    repayment: "MONTHLY",
    securityType: "SECURED",
    collateral: "Hypothecation of stocks and receivables with 25% margin; lien over PKR 1m Certificate of Islamic Investment",
    liquidLien: 1 * M,
    structure: { assetDescription: "Certified wheat seed (Akbar-2019) and DAP fertiliser", quantity: "40 MT seed; 800 bags DAP", supplierName: "Punjab Seed Corporation", quotationRef: "PSC/Q/2026/1182", deliveryLocation: "Barakah godown, Depalpur Road, Okara", purchaseMode: "CUSTOMER_AGENT" },
  });
  await autopilot(c1.id, "ACTIVE");
  const firstInst = await db.installment.findFirst({ where: { caseId: c1.id }, orderBy: { seq: "asc" } });
  if (firstInst) await recordRepayment(await rm("rcad.officer"), firstInst.id, firstInst.total, "CBS-RCPT-778812");

  // 2) Diminishing Musharakah — in execution (offer accepted, documents being signed)
  const c2 = await createCase(await rm("rm.ali"), {
    customerId: alNoor.id,
    productCode: "DIMINISHING_MUSHARAKAH",
    purpose: "Acquisition of 24 Tsudakoma air-jet looms",
    amount: 60 * M,
    tenorMonths: 60,
    profitRate: 15.75,
    repayment: "MONTHLY",
    securityType: "SECURED",
    collateral: "Exclusive charge over financed looms; equitable mortgage of factory land & building (FSV PKR 95m)",
    structure: { assetDescription: "24 Tsudakoma ZAX9200i air-jet weaving looms with accessories", assetType: "MACHINERY", totalAssetValue: String(80 * M), vendorName: "Textile Machinery Traders (Pvt) Ltd", assetLocation: "Plot 42, Sundar Industrial Estate, Lahore", guarantorName: "Asma Noor" },
  });
  await autopilot(c2.id, "EXECUTION");
  // progress a few execution steps so the demo shows a mixed state
  const { step } = await import("../src/lib/demo/autopilot");
  for (let i = 0; i < 3; i++) await step(c2.id, "ACTIVE");

  // 3) Murabaha — under review (Credit pending)
  const c3 = await createCase(await rm("rm.ali"), {
    customerId: alNoor.id,
    productCode: "MURABAHA",
    purpose: "Import of polyester yarn for export order",
    amount: 35 * M,
    tenorMonths: 6,
    profitRate: 16,
    repayment: "BULLET",
    securityType: "SECURED",
    collateral: "Pledge of yarn stocks under bank's muccadam with 20% margin",
    structure: { assetDescription: "Polyester filament yarn 150D/48F", quantity: "120 MT", supplierName: "Sinotex Fibres Co. (via LC)", quotationRef: "PI-SFC-26-0912", deliveryLocation: "Al-Noor warehouse, Raiwind Road", purchaseMode: "BANK_DIRECT" },
  });
  await autopilot(c3.id, "UNDER_REVIEW");
  const rcad = await rm("rcad.officer");
  const { decideClearance } = await import("../src/lib/engine/cases");
  const { TRACK_CHECKLISTS } = await import("../src/lib/constants");
  await decideClearance(rcad, c3.id, "RCAD", { decision: "CLEARED", checklist: TRACK_CHECKLISTS.RCAD, comments: "KYC current; e-CIB clean; UBO verified." });

  // 4) Istisna — draft (customer KYC still pending)
  await createCase(await rm("rm.zain"), {
    customerId: crescent.id,
    productCode: "ISTISNA",
    purpose: "Fabrication of CNC machining line",
    amount: 120 * M,
    tenorMonths: 48,
    profitRate: 15.5,
    repayment: "QUARTERLY",
    securityType: "SECURED",
    collateral: "Charge over CNC line; mortgage of SITE factory (FSV PKR 180m)",
    structure: { specifications: "3-axis CNC machining line: 4 × VMC-850, 2 × CNC lathes, conveyor & QC station per BOQ rev.3", contractorName: "Precision Engineering Works", siteAddress: "B-17, SITE Industrial Area, Karachi", deliveryDate: new Date(Date.now() + 240 * 86400_000).toISOString().slice(0, 10), milestones: "3" },
  });

  console.log(`Seeded tenants IBP & DCB. Demo password for every user: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
