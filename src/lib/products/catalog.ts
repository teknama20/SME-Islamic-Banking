// Islamic SME financing product catalogue.
//
// Each product encodes: required data, Shariah preconditions, the documents
// and their signing order, and the execution sequence (signatures, evidence,
// operational actions and Shariah checks) with dependencies. The sequence
// enforces the Shariah ordering rules, e.g. a Murabaha sale cannot be
// concluded before the bank owns and possesses the asset (AAOIFI SS 8 & 18).
import type { BankRole, Role } from "../rbac";
import type { CaseShape, DocSpec, ProductDef, SignerSlot, StepSpec } from "./types";

// --- Signatories -------------------------------------------------------------
//
// Every document follows the same documentation loop:
//   RCAD prepares & vets → bank signs (RM / Team Leader / Unit Head)
//   → customer (or guarantor) signs → RCAD / RM verifies the executed set.

export const RCAD_PREPARE: SignerSlot = { party: "RCAD", capacity: "RCAD — Prepared & vetted", roles: ["RCAD"] };
export const BANK_SIGN: SignerSlot = {
  party: "BANK",
  capacity: "Bank — Authorised Signatory (RM / Team Leader / Unit Head)",
  roles: ["RM", "TEAM_LEADER", "UNIT_HEAD"],
};
export const BANK_SIGN_SECOND: SignerSlot = {
  party: "BANK",
  capacity: "Bank — Second Signatory (Team Leader / Unit Head)",
  roles: ["TEAM_LEADER", "UNIT_HEAD"],
};
export const CUSTOMER_SIGN: SignerSlot = { party: "CUSTOMER", capacity: "Customer — Authorised Signatory" };
export const GUARANTOR_SIGN: SignerSlot = { party: "GUARANTOR", capacity: "Guarantor" };
export const RCAD_VERIFY: SignerSlot = { party: "RCAD", capacity: "RCAD / RM — Documentation verified", roles: ["RCAD", "RM"] };

/** RCAD → (parties) → RCAD/RM */
const loop = (...parties: SignerSlot[]): SignerSlot[] => [RCAD_PREPARE, ...parties, RCAD_VERIFY];
/** Main agreements: two bank signatures (four eyes), then the customer. */
const AGREEMENT = loop(BANK_SIGN, BANK_SIGN_SECOND, CUSTOMER_SIGN);
const BILATERAL = loop(BANK_SIGN, CUSTOMER_SIGN);
const CUSTOMER_ONLY = loop(CUSTOMER_SIGN);
const BANK_ONLY = loop(BANK_SIGN);

// Evidence: captured by the customer or RM, verified by RCAD / RM (never the capturer).
const CAPTURERS: Role[] = ["CUSTOMER_SIGNATORY", "CUSTOMER_USER", "RM"];
const BANK_CAPTURERS: Role[] = ["RM", "RCAD"];
const VERIFIERS: BankRole[] = ["RCAD", "RM"];

/** Disbursement: RCAD prepares (maker), Team Leader / Unit Head authorises (checker). */
export const DISBURSEMENT_MAKERS: BankRole[] = ["RCAD"];

// --- Common documents (all products) -------------------------------------------

export const COMMON_DOCS: DocSpec[] = [
  { code: "OFFER_LETTER", title: "Facility Offer Letter (Sanction Advice)", signers: BILATERAL },
  { code: "KFS", title: "Key Fact Statement (English / اردو)", signers: [RCAD_PREPARE, CUSTOMER_SIGN] },
  { code: "PERSONAL_GUARANTEE", title: "Personal Guarantee", signers: loop(GUARANTOR_SIGN) },
  { code: "SECURITY_DOCUMENTS", title: "Memorandum of Charge / Mortgage / Hypothecation", signers: BILATERAL },
];

// --- Step builders -------------------------------------------------------------

const sign = (key: string, title: string, docCode: string, dependsOn: string[], note?: string): StepSpec => ({
  key,
  title,
  kind: "SIGN",
  docCode,
  dependsOn,
  note,
});

const disburse = (key: string, title: string, dependsOn: string[], note?: string): StepSpec => ({
  key,
  title,
  kind: "ACTION",
  dependsOn,
  note,
  action: {
    roles: DISBURSEMENT_MAKERS,
    effect: "DISBURSE",
    fields: [
      { name: "paymentRef", label: "Payment / transaction reference", type: "text" },
      { name: "amount", label: "Amount paid (PKR)", type: "number" },
      { name: "payee", label: "Paid to", type: "text" },
    ],
  },
});

const activate = (dependsOn: string[], note: string): StepSpec => ({
  key: "activate",
  title: "Book facility in core banking & activate schedule",
  kind: "ACTION",
  dependsOn,
  note,
  action: {
    roles: ["RCAD"],
    effect: "ACTIVATE",
    fields: [{ name: "cbsRef", label: "Core banking account / deal reference", type: "text" }],
  },
});

const evidence = (
  key: string,
  title: string,
  dependsOn: string[],
  opts: Partial<NonNullable<StepSpec["evidence"]>> & { categories: NonNullable<StepSpec["evidence"]>["categories"]; checklist: string[] },
  note?: string,
): StepSpec => ({
  key,
  title,
  kind: "EVIDENCE",
  dependsOn,
  note,
  evidence: {
    minItems: 2,
    capturers: CAPTURERS,
    verifiers: VERIFIERS,
    requireGps: true,
    ...opts,
  },
});

const s = (c: CaseShape, k: string) => (c.structure[k] ?? "").trim();
const n = (c: CaseShape, k: string) => Number(c.structure[k] ?? NaN);

const REPAYMENT_ALL: ProductDef["repaymentOptions"] = ["MONTHLY", "QUARTERLY", "BULLET"];

// --- Products --------------------------------------------------------------------

const MURABAHA: ProductDef = {
  code: "MURABAHA",
  name: "Murabaha",
  nameUrdu: "مرابحہ",
  family: "Trade (sale)",
  summary:
    "Cost-plus sale. The bank (directly or through the customer as its agent) purchases an identified tangible asset, takes physical or constructive possession, then sells it to the customer at disclosed cost plus an agreed profit, payable on deferred terms.",
  useCases: ["Raw material & inventory", "Machinery & equipment", "Vehicles", "Trade goods"],
  aaoifi: ["SS 8 Murabahah", "SS 18 Possession (Qabd)", "SS 23 Agency", "SS 3 Procrastinating debtor (charity)"],
  sbp: ["SBP Essentials & Model Agreement — Murabaha", "SME PR R-12 (bilingual disclosure)", "SME PR R-14 (e-agreements)"],
  pricing: "COST_PLUS",
  repaymentOptions: REPAYMENT_ALL,
  maxTenorMonths: 60,
  requiresTrade: true,
  shariahRules: [
    "The asset must exist, be identified and owned by the bank before it is sold to the customer.",
    "Bank (or its agent) must take physical or constructive possession; risk passes to the bank before sale.",
    "Cost and profit must be disclosed and fixed at the time of sale; price cannot increase thereafter.",
    "The customer's promise to purchase is a unilateral undertaking, not a sale.",
    "Payment to the supplier should be made directly by the bank wherever possible.",
    "Late payment amounts go to charity and are not bank income.",
  ],
  fields: [
    { name: "assetDescription", label: "Asset / commodity description", type: "textarea", required: true },
    { name: "quantity", label: "Quantity & unit", type: "text", required: true },
    { name: "supplierName", label: "Supplier name", type: "text", required: true },
    { name: "quotationRef", label: "Quotation / proforma invoice ref.", type: "text", required: true },
    { name: "deliveryLocation", label: "Delivery location", type: "text", required: true },
    {
      name: "purchaseMode",
      label: "Purchase mode",
      type: "select",
      required: true,
      options: [
        { value: "CUSTOMER_AGENT", label: "Customer appointed as bank's agent (Wakalah)" },
        { value: "BANK_DIRECT", label: "Bank purchases directly from supplier" },
      ],
    },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    if (!s(c, "assetDescription")) e.push("Murabaha requires an identified tangible asset.");
    if (!s(c, "supplierName")) e.push("Murabaha requires a named supplier (the customer cannot be the supplier — buy-back is prohibited).");
    if (/\b(cash|currency|gold|silver|salary|rent|utility)\b/i.test(s(c, "assetDescription")))
      e.push("Murabaha cannot be used for cash, currencies, gold/silver or services such as salaries/utilities.");
    return e;
  },
  documents: [
    { code: "MMFA", title: "Master Murabaha Financing Agreement", signers: AGREEMENT },
    { code: "PROMISE_TO_PURCHASE", title: "Undertaking / Promise to Purchase", signers: CUSTOMER_ONLY },
    { code: "AGENCY_AGREEMENT", title: "Agency Agreement (Wakalah) for Purchase", signers: BILATERAL },
    { code: "MURABAHA_DECLARATION", title: "Murabaha Sale — Bank's Offer & Customer's Acceptance", signers: BILATERAL },
  ],
  steps: (c) => {
    const agent = s(c, "purchaseMode") !== "BANK_DIRECT";
    const steps: StepSpec[] = [
      sign("mmfa", "Execute Master Murabaha Financing Agreement", "MMFA", [], "Framework agreement; no sale occurs at this stage."),
      sign("promise", "Customer signs Promise to Purchase", "PROMISE_TO_PURCHASE", ["mmfa"], "Unilateral promise (wa'd) — binding on the promisor only."),
    ];
    if (agent) steps.push(sign("agency", "Execute Agency Agreement (customer as purchasing agent)", "AGENCY_AGREEMENT", ["promise"], "Customer purchases on the bank's behalf; asset risk remains with the bank."));
    steps.push(
      disburse("supplier_payment", "Pay supplier directly for the asset", [agent ? "agency" : "promise"], "Bank pays the supplier; invoice must be in the bank's name (or agent on bank's behalf)."),
      evidence("possession", "Capture purchase & possession evidence", ["supplier_payment"], {
        categories: ["INVOICE", "DELIVERY", "POSSESSION", "INSPECTION"],
        minItems: 2,
        checklist: [
          "Supplier invoice / delivery challan matches the quotation",
          "Asset physically identified (serial / lot / tag) and photographed at location",
          "Asset in the bank's (or agent's) possession; risk with the bank",
        "Bank's ownership established before sale", "Physical / constructive possession verified from evidence", "No sale to the customer has occurred before possession", "Supplier is a third party (no buy-back)"],
      }, "AAOIFI SS 18: geo-tagged, time-stamped proof of possession before onward sale."),
      sign("declaration", "Murabaha sale: bank's offer & customer's acceptance", "MURABAHA_DECLARATION", ["possession"], "Only after possession is verified. The Murabaha sale is concluded here; price (cost + profit) is fixed from this point."),
      activate(["declaration"], "Deferred sale price receivable booked; instalment schedule starts."),
    );
    return steps;
  },
};

const TIJARAH: ProductDef = {
  code: "TIJARAH",
  name: "Tijarah",
  nameUrdu: "تجارہ",
  family: "Trade (sale)",
  summary:
    "Post-sale working capital. The bank purchases the customer's finished goods on a cash basis, takes possession, and then sells them in the market — itself or through the customer as its sales agent — earning profit on resale.",
  useCases: ["Manufacturers' finished-goods inventory", "Post-production working capital", "Distributor stocks"],
  aaoifi: ["SS 8 Murabahah (sale principles)", "SS 18 Possession (Qabd)", "SS 23 Agency"],
  sbp: ["SBP Islamic Banking Product Handbook — Tijarah", "SME PR R-10 (monitoring, digital stock reports)"],
  pricing: "COST_PLUS",
  repaymentOptions: ["BULLET"],
  maxTenorMonths: 12,
  requiresTrade: true,
  shariahRules: [
    "Goods must be finished, identified and segregated as the bank's property.",
    "The bank must take possession (physical or constructive) before reselling.",
    "The sale back to the same customer is prohibited (no buy-back / Bai al-Inah).",
    "As sales agent the customer sells to third parties and remits proceeds; agency fee is fixed.",
  ],
  fields: [
    { name: "goodsDescription", label: "Finished goods description", type: "textarea", required: true },
    { name: "quantity", label: "Quantity & unit", type: "text", required: true },
    { name: "warehouseLocation", label: "Warehouse / godown location", type: "text", required: true },
    { name: "targetBuyers", label: "Target buyers / market", type: "text", required: true },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    if (!s(c, "goodsDescription")) e.push("Tijarah requires identified finished goods.");
    if (c.repayment !== "BULLET") e.push("Tijarah is settled from resale proceeds — repayment must be BULLET.");
    return e;
  },
  documents: [
    { code: "MTA", title: "Master Tijarah Agreement", signers: AGREEMENT },
    { code: "TIJARAH_SALE", title: "Tijarah Sale Deed (Customer sells goods to Bank)", signers: BILATERAL },
    { code: "SALES_AGENCY", title: "Sales Agency Agreement (Customer sells on Bank's behalf)", signers: BILATERAL },
  ],
  steps: () => [
    sign("mta", "Execute Master Tijarah Agreement", "MTA", []),
    sign("sale", "Bank purchases finished goods (Tijarah sale deed)", "TIJARAH_SALE", ["mta"]),
    disburse("purchase_payment", "Pay purchase price to customer", ["sale"], "Cash purchase of finished goods by the bank."),
    evidence("stock_possession", "Capture stock possession evidence at warehouse", ["purchase_payment"], {
      categories: ["POSSESSION", "INSPECTION"],
      minItems: 2,
      capturers: BANK_CAPTURERS,
      checklist: ["Goods segregated & marked as bank property", "Quantity & quality verified against sale deed", "Warehouse access / keys under bank control or agent", "Bank's ownership & possession established", "Resale will be to third parties, not the customer"],
    }),
    sign("agency", "Appoint customer as sales agent", "SALES_AGENCY", ["stock_possession"]),
    activate(["agency"], "Resale proceeds due at maturity; sale price includes bank's profit."),
  ],
};

const ISTISNA: ProductDef = {
  code: "ISTISNA",
  name: "Istisna (with Parallel Istisna)",
  nameUrdu: "استصناع",
  family: "Manufacturing (sale)",
  summary:
    "Order to manufacture/construct. The bank agrees to deliver a specified asset to the customer at a fixed price and separately orders it from a contractor under a Parallel Istisna. Contractor payments are released against certified milestones.",
  useCases: ["Plant & machinery fabrication", "Construction of factory / warehouse", "Custom equipment"],
  aaoifi: ["SS 11 Istisna'a and Parallel Istisna'a", "SS 18 Possession (Qabd)"],
  sbp: ["SBP Essentials — Istisna", "SME PR R-10 (monitoring)"],
  pricing: "COST_PLUS",
  repaymentOptions: REPAYMENT_ALL,
  maxTenorMonths: 84,
  requiresTrade: true,
  shariahRules: [
    "Specifications, price and delivery date must be fixed and unambiguous.",
    "The two contracts (Istisna & Parallel Istisna) are independent; customer obligations do not depend on the contractor's.",
    "Bank bears the risk of the asset until delivery to the customer.",
    "Milestone payments only against certified progress.",
  ],
  fields: [
    { name: "specifications", label: "Technical specifications / BOQ summary", type: "textarea", required: true },
    { name: "contractorName", label: "Contractor / manufacturer", type: "text", required: true },
    { name: "siteAddress", label: "Site / manufacturing location", type: "text", required: true },
    { name: "deliveryDate", label: "Delivery date", type: "date", required: true },
    { name: "milestones", label: "Number of payment milestones (1–6)", type: "number", required: true },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    if (!s(c, "specifications")) e.push("Istisna requires precise specifications.");
    const m = n(c, "milestones");
    if (!(m >= 1 && m <= 6)) e.push("Milestones must be between 1 and 6.");
    if (!s(c, "deliveryDate") || new Date(s(c, "deliveryDate")) <= new Date()) e.push("A future delivery date must be fixed.");
    return e;
  },
  documents: [
    { code: "ISTISNA_AGREEMENT", title: "Istisna Agreement (Bank as manufacturer, Customer as buyer)", signers: AGREEMENT },
    { code: "PARALLEL_ISTISNA", title: "Parallel Istisna Agreement (Bank with Contractor)", signers: BANK_ONLY, offPlatformCounterparty: "Contractor" },
    { code: "DELIVERY_CERTIFICATE", title: "Delivery & Acceptance Certificate", signers: BILATERAL },
  ],
  steps: (c) => {
    const m = Math.min(6, Math.max(1, Math.round(n(c, "milestones")) || 1));
    const steps: StepSpec[] = [
      sign("istisna", "Execute Istisna Agreement with customer", "ISTISNA_AGREEMENT", []),
      sign("parallel", "Execute Parallel Istisna with contractor", "PARALLEL_ISTISNA", ["istisna"], "Independent contract; contractor's counter-signed copy uploaded as evidence."),
      evidence("parallel_copy", "Upload contractor-signed Parallel Istisna", ["parallel"], {
        categories: ["COUNTERPARTY_CONTRACT"],
        minItems: 1,
        capturers: BANK_CAPTURERS,
        verifiers: VERIFIERS,
        requireGps: false,
        checklist: ["Contractor signature & stamp present", "Terms identical to platform version (hash compared)"],
      }),
    ];
    let prev = "parallel_copy";
    for (let i = 1; i <= m; i++) {
      steps.push(
        evidence(`milestone_${i}`, `Milestone ${i}: site progress & certification`, [prev], {
          categories: ["MILESTONE", "SITE_VISIT", "INSPECTION"],
          minItems: 2,
          capturers: BANK_CAPTURERS,
          verifiers: VERIFIERS,
          checklist: ["Consultant / engineer certificate attached", "Geo-tagged site photos / video", "Contractor invoice for milestone"],
        }),
        disburse(`milestone_pay_${i}`, `Release milestone ${i} payment to contractor`, [`milestone_${i}`]),
      );
      prev = `milestone_pay_${i}`;
    }
    steps.push(
      evidence("delivery", "Capture completion & delivery to bank", [prev], {
        categories: ["DELIVERY", "POSSESSION", "INSPECTION"],
        minItems: 2,
        capturers: BANK_CAPTURERS,
        checklist: ["Completion certificate", "Asset conforms to specifications", "Bank took possession from contractor", "Asset conforms to Istisna specifications", "Bank possessed the asset before delivering it to the customer", "Goods manufactured after contract", "Bank's possession verified before resale", "Price was paid in full at contract", "Goods delivered conform to specifications", "Any Parallel Salam is independent"],
      }),
      sign("handover", "Customer accepts delivery", "DELIVERY_CERTIFICATE", ["delivery"]),
      activate(["handover"], "Istisna price receivable from customer per agreed schedule."),
    );
    return steps;
  },
};

const ISTISNA_WC: ProductDef = {
  code: "ISTISNA_WC",
  name: "Istisna (Working Capital)",
  nameUrdu: "استصناع (ورکنگ کیپیٹل)",
  family: "Manufacturing (sale)",
  summary:
    "Pre-shipment / pre-production finance. The bank orders goods from the customer (as manufacturer) and pays the Istisna price in advance; on delivery the bank sells the goods in the market through the customer as its agent.",
  useCases: ["Textile & garment orders", "Export pre-shipment", "Seasonal manufacturing"],
  aaoifi: ["SS 11 Istisna'a", "SS 23 Agency", "SS 18 Possession (Qabd)"],
  sbp: ["SBP Essentials — Istisna"],
  pricing: "COST_PLUS",
  repaymentOptions: ["BULLET"],
  maxTenorMonths: 12,
  requiresTrade: true,
  shariahRules: [
    "Goods must be manufactured (not ready stock) and fully specified.",
    "Delivery to the bank (possession) must precede resale.",
    "Sale proceeds belong to the bank; the agent remits them and earns only the agreed fee.",
  ],
  fields: [
    { name: "goodsSpecifications", label: "Goods to be manufactured & specifications", type: "textarea", required: true },
    { name: "quantity", label: "Quantity & unit", type: "text", required: true },
    { name: "deliveryDate", label: "Delivery date", type: "date", required: true },
    { name: "deliveryPlace", label: "Delivery place", type: "text", required: true },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    if (!s(c, "goodsSpecifications")) e.push("Istisna requires specifications of goods to be manufactured.");
    if (c.repayment !== "BULLET") e.push("Working-capital Istisna is settled from sale proceeds — repayment must be BULLET.");
    return e;
  },
  documents: [
    { code: "ISTISNA_WC_AGREEMENT", title: "Istisna Agreement (Customer as manufacturer, Bank as buyer)", signers: AGREEMENT },
    { code: "SALES_AGENCY", title: "Sales Agency Agreement (Customer sells on Bank's behalf)", signers: BILATERAL },
  ],
  steps: () => [
    sign("istisna", "Execute Istisna Agreement", "ISTISNA_WC_AGREEMENT", []),
    disburse("advance", "Pay Istisna price to customer (manufacturer)", ["istisna"]),
    evidence("delivery", "Capture delivery of manufactured goods to bank", ["advance"], {
      categories: ["DELIVERY", "POSSESSION", "INSPECTION"],
      minItems: 2,
      capturers: BANK_CAPTURERS,
      checklist: ["Goods match specifications & quantity", "Goods segregated as bank property", "Inspection report attached"],
    }),
    sign("agency", "Appoint customer as sales agent", "SALES_AGENCY", ["delivery"]),
    activate(["agency"], "Sale proceeds (cost + profit) due at maturity."),
  ],
};

const DIMINISHING_MUSHARAKAH: ProductDef = {
  code: "DIMINISHING_MUSHARAKAH",
  name: "Diminishing Musharakah",
  nameUrdu: "شرکتِ متناقصہ",
  family: "Partnership",
  summary:
    "Co-ownership of a specified tangible asset. The bank leases its share to the customer for rental and the customer gradually buys the bank's units under a separate undertaking until it owns the asset outright.",
  useCases: ["Commercial property / factory", "Plant & machinery", "Vehicle fleet", "Solar & energy systems"],
  aaoifi: ["SS 12 Sharikah (Musharakah) — diminishing", "SS 9 Ijarah", "SS 5 Guarantees"],
  sbp: ["SBP Essentials — Diminishing Musharakah", "SME PR Annexure II (FSV valuations)"],
  pricing: "DM_UNITS",
  repaymentOptions: ["MONTHLY", "QUARTERLY"],
  maxTenorMonths: 120,
  requiresTrade: false,
  shariahRules: [
    "Limited to specified tangible assets — not an entire enterprise.",
    "Co-ownership (Shirkat-ul-Milk), lease of bank's share and unit purchases are separate contracts.",
    "Units are purchased at the price agreed at each purchase (or pre-agreed per undertaking); ownership must reflect payments.",
    "Major maintenance & Takaful of the asset are the owners' responsibility in proportion to ownership.",
  ],
  fields: [
    { name: "assetDescription", label: "Asset description", type: "textarea", required: true },
    {
      name: "assetType",
      label: "Asset type",
      type: "select",
      required: true,
      options: [
        { value: "PROPERTY", label: "Commercial / industrial property" },
        { value: "MACHINERY", label: "Plant & machinery" },
        { value: "VEHICLE", label: "Vehicle(s)" },
      ],
    },
    { name: "totalAssetValue", label: "Total asset value (PKR)", type: "number", required: true, help: "Bank's share = financing amount; customer contributes the rest." },
    { name: "vendorName", label: "Vendor / seller", type: "text", required: true },
    { name: "assetLocation", label: "Asset location", type: "text", required: true },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    const total = n(c, "totalAssetValue");
    if (!s(c, "assetDescription")) e.push("Diminishing Musharakah requires a specified tangible asset.");
    if (!(total > c.amount)) e.push("Customer must contribute equity: total asset value must exceed the bank's share.");
    else if (c.amount / total > 0.9) e.push("Bank's share should not exceed 90% of the asset value (minimum 10% customer equity).");
    return e;
  },
  documents: [
    { code: "MUSHARAKAH_AGREEMENT", title: "Musharakah (Shirkat-ul-Milk) Agreement", signers: AGREEMENT },
    { code: "UNDERTAKING_TO_PURCHASE", title: "Undertaking to Purchase Musharakah Units", signers: CUSTOMER_ONLY },
    { code: "DM_IJARAH", title: "Ijarah (Rental) Agreement for Bank's Share", signers: BILATERAL },
  ],
  steps: () => [
    sign("musharakah", "Execute Musharakah (co-ownership) Agreement", "MUSHARAKAH_AGREEMENT", []),
    sign("undertaking", "Customer signs Undertaking to Purchase Units", "UNDERTAKING_TO_PURCHASE", ["musharakah"]),
    evidence("valuation", "Upload independent valuation & title report", ["undertaking"], {
      categories: ["VALUATION", "TITLE"],
      minItems: 2,
      capturers: BANK_CAPTURERS,
      verifiers: VERIFIERS,
      requireGps: false,
      checklist: ["PBA-panel valuer report (full scope)", "Title search / legal opinion clear"],
    }, "SME PR Annexure II: valuation by PBA-panel evaluator."),
    disburse("vendor_payment", "Pay vendor (bank & customer contributions)", ["valuation"]),
    evidence("title_possession", "Capture asset title & possession evidence", ["vendor_payment"], {
      categories: ["TITLE", "POSSESSION", "SITE_VISIT"],
      minItems: 2,
      capturers: BANK_CAPTURERS,
      checklist: ["Title / registration reflects joint ownership or bank's interest", "Geo-tagged photos / video of asset", "Asset identifiers recorded"],
    }),
    evidence("takaful", "Upload Takaful cover for the asset", ["title_possession"], {
      categories: ["TAKAFUL"],
      minItems: 1,
      verifiers: VERIFIERS,
      requireGps: false,
      checklist: ["Takaful covers full asset value", "Bank noted as co-owner / loss payee", "Joint ownership created before lease", "Lease, co-ownership & unit undertaking are separate documents", "Rental applies only to the bank's share", "Bank owns the asset", "Asset exists and is deliverable", "No rental charged before delivery"],
    }),
    sign("ijarah", "Execute Ijarah of bank's share", "DM_IJARAH", ["takaful"], "Rental accrues only after the asset is acquired and delivered."),
    activate(["ijarah"], "Unit purchase & rental schedule starts; unit register maintained."),
  ],
};

const IJARAH: ProductDef = {
  code: "IJARAH",
  name: "Ijarah",
  nameUrdu: "اجارہ",
  family: "Lease",
  summary:
    "Operating lease. The bank purchases and owns the asset, leases its usufruct to the customer for rentals and, at maturity, transfers ownership through a separate sale or gift under a unilateral undertaking.",
  useCases: ["Vehicles", "Machinery & equipment", "Generators / solar systems"],
  aaoifi: ["SS 9 Ijarah and Ijarah Muntahia Bittamleek", "SS 18 Possession (Qabd)"],
  sbp: ["SBP Essentials — Ijarah", "IFAS-2 Ijarah accounting"],
  pricing: "RENTAL",
  repaymentOptions: ["MONTHLY", "QUARTERLY"],
  maxTenorMonths: 84,
  requiresTrade: false,
  shariahRules: [
    "The bank must own the asset and bear ownership risks (major maintenance, Takaful).",
    "Rental starts only after the asset is delivered to the lessee.",
    "Asset must be non-consumable with usufruct separable from the corpus.",
    "Transfer of ownership at maturity is by a separate document, not embedded in the lease.",
  ],
  fields: [
    { name: "assetDescription", label: "Asset description (make / model / specs)", type: "textarea", required: true },
    {
      name: "assetType",
      label: "Asset type",
      type: "select",
      required: true,
      options: [
        { value: "VEHICLE", label: "Vehicle" },
        { value: "MACHINERY", label: "Machinery / equipment" },
        { value: "ENERGY", label: "Generator / solar system" },
      ],
    },
    { name: "vendorName", label: "Vendor / dealer", type: "text", required: true },
    { name: "securityDeposit", label: "Security deposit (PKR)", type: "number" },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    if (!s(c, "assetDescription")) e.push("Ijarah requires an identified asset.");
    if (/\b(fuel|raw material|consumable|cash)\b/i.test(s(c, "assetDescription"))) e.push("Consumables cannot be leased under Ijarah.");
    return e;
  },
  documents: [
    { code: "UNDERTAKING_TO_LEASE", title: "Undertaking to Lease", signers: CUSTOMER_ONLY },
    { code: "IJARAH_AGREEMENT", title: "Ijarah Agreement & Rental Schedule", signers: AGREEMENT },
    { code: "UNDERTAKING_TO_SELL", title: "Bank's Undertaking to Sell / Gift at Maturity", signers: BANK_ONLY },
  ],
  steps: () => [
    sign("undertaking_lease", "Customer signs Undertaking to Lease", "UNDERTAKING_TO_LEASE", []),
    disburse("vendor_payment", "Pay vendor — bank purchases the asset", ["undertaking_lease"]),
    evidence("bank_possession", "Capture bank's ownership & possession of asset", ["vendor_payment"], {
      categories: ["INVOICE", "TITLE", "POSSESSION"],
      minItems: 2,
      capturers: BANK_CAPTURERS,
      checklist: ["Invoice / registration in bank's name", "Asset identified (chassis / serial no.)", "Geo-tagged photos at delivery point"],
    }),
    evidence("takaful", "Upload Takaful cover (bank as owner)", ["bank_possession"], {
      categories: ["TAKAFUL"],
      minItems: 1,
      verifiers: VERIFIERS,
      requireGps: false,
      checklist: ["Takaful in bank's name as owner"],
    }),
    sign("ijarah", "Execute Ijarah Agreement", "IJARAH_AGREEMENT", ["takaful"]),
    evidence("handover", "Capture handover of asset to customer", ["ijarah"], {
      categories: ["DELIVERY"],
      minItems: 1,
      checklist: ["Delivery receipt signed by customer", "Condition of asset recorded (photos)"],
    }, "Rental period starts on delivery to the lessee."),
    sign("undertaking_sell", "Bank issues Undertaking to Sell at maturity", "UNDERTAKING_TO_SELL", ["handover"]),
    activate(["undertaking_sell"], "Rental schedule starts from delivery date."),
  ],
};

const SALAM: ProductDef = {
  code: "SALAM",
  name: "Salam (with Parallel Salam)",
  nameUrdu: "سلم",
  family: "Forward sale",
  summary:
    "Advance purchase. The bank pays the full price at contract for fungible goods (typically agricultural produce or commodities) to be delivered on a future date, then sells them through the customer as agent or under an independent Parallel Salam.",
  useCases: ["Agricultural produce (rice, wheat, cotton)", "Commodity pre-financing", "Seasonal procurement"],
  aaoifi: ["SS 10 Salam and Parallel Salam", "SS 18 Possession (Qabd)"],
  sbp: ["SBP Essentials — Salam"],
  pricing: "COST_PLUS",
  repaymentOptions: ["BULLET"],
  maxTenorMonths: 12,
  requiresTrade: true,
  shariahRules: [
    "Full price must be paid at the time of contract (spot), not deferred.",
    "Goods must be fungible and precisely specified (quality, quantity, delivery date & place).",
    "Gold, silver and currencies cannot be the subject of Salam.",
    "Parallel Salam must be independent of the first Salam.",
  ],
  fields: [
    { name: "commodity", label: "Commodity", type: "text", required: true },
    { name: "quantity", label: "Quantity & unit", type: "text", required: true },
    { name: "qualitySpecs", label: "Quality specifications / grade", type: "textarea", required: true },
    { name: "deliveryDate", label: "Delivery date", type: "date", required: true },
    { name: "deliveryPlace", label: "Delivery place", type: "text", required: true },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    if (/\b(gold|silver|currency|cash|dollar|rupee)\b/i.test(s(c, "commodity"))) e.push("Gold, silver and currencies cannot be sold under Salam.");
    if (!s(c, "qualitySpecs")) e.push("Salam requires precise quality specifications.");
    if (!s(c, "deliveryDate") || new Date(s(c, "deliveryDate")) <= new Date()) e.push("Salam requires a future delivery date.");
    if (c.repayment !== "BULLET") e.push("Salam is settled on delivery and resale — repayment must be BULLET.");
    return e;
  },
  documents: [
    { code: "SALAM_AGREEMENT", title: "Salam Agreement (Customer as seller, Bank as buyer)", signers: AGREEMENT },
    { code: "SALES_AGENCY", title: "Sales Agency Agreement (Customer sells on Bank's behalf)", signers: BILATERAL },
  ],
  steps: () => [
    sign("salam", "Execute Salam Agreement", "SALAM_AGREEMENT", []),
    disburse("salam_price", "Pay full Salam price at contract", ["salam"], "Must be paid in full at the contract session (AAOIFI SS 10)."),
    evidence("delivery", "Capture delivery & quality inspection of goods", ["salam_price"], {
      categories: ["DELIVERY", "INSPECTION", "POSSESSION"],
      minItems: 2,
      capturers: BANK_CAPTURERS,
      checklist: ["Quantity & grade per Salam specifications", "Warehouse receipt / storage location", "Geo-tagged photos of goods"],
    }),
    sign("agency", "Appoint customer as sales agent", "SALES_AGENCY", ["delivery"]),
    activate(["agency"], "Resale proceeds due at maturity."),
  ],
};

const RUNNING_MUSHARAKAH: ProductDef = {
  code: "RUNNING_MUSHARAKAH",
  name: "Running Musharakah",
  nameUrdu: "رننگ مشارکہ",
  family: "Partnership",
  summary:
    "Working-capital partnership. The bank participates in the customer's business operations through a running limit; profit is shared per an agreed ratio on actual results and loss in proportion to capital.",
  useCases: ["Revolving working capital", "Trading businesses with auditable accounts"],
  aaoifi: ["SS 12 Sharikah (Musharakah)", "SS 13 Mudarabah (profit computation)"],
  sbp: ["SBP Instructions on Running Musharakah", "SME PR R-10 (monitoring)"],
  pricing: "PROFIT_SHARE",
  repaymentOptions: ["QUARTERLY"],
  maxTenorMonths: 12,
  requiresTrade: false,
  shariahRules: [
    "Profit ratio is agreed in advance; a fixed return on capital is prohibited.",
    "Loss is shared strictly in proportion to capital contribution.",
    "Provisional profits are settled against actual results at the end of each period.",
  ],
  fields: [
    { name: "businessDescription", label: "Business operations financed", type: "textarea", required: true },
    { name: "bankProfitShare", label: "Bank's profit-sharing ratio (%)", type: "number", required: true },
    { name: "expectedProfitRate", label: "Expected business profit rate (% p.a.)", type: "number" },
  ],
  preconditions: (c) => {
    const e: string[] = [];
    const r = n(c, "bankProfitShare");
    if (!(r > 0 && r < 100)) e.push("A profit-sharing ratio between 0% and 100% must be agreed.");
    return e;
  },
  documents: [{ code: "RUNNING_MUSHARAKAH_AGREEMENT", title: "Running Musharakah Agreement", signers: AGREEMENT }],
  steps: () => [
    sign("agreement", "Execute Running Musharakah Agreement", "RUNNING_MUSHARAKAH_AGREEMENT", []),
    evidence("stock_report", "Baseline stock & business inspection", ["agreement"], {
      categories: ["INSPECTION", "SITE_VISIT"],
      minItems: 1,
      capturers: BANK_CAPTURERS,
      checklist: ["Stock & receivables report", "Geo-tagged premises visit"],
    }),
    disburse("limit", "Make Musharakah limit available", ["stock_report"]),
    activate(["limit"], "Quarterly provisional profit; settlement on actuals."),
  ],
};

export const PRODUCTS: ProductDef[] = [MURABAHA, TIJARAH, ISTISNA, ISTISNA_WC, DIMINISHING_MUSHARAKAH, IJARAH, SALAM, RUNNING_MUSHARAKAH];

export function getProduct(code: string): ProductDef {
  const p = PRODUCTS.find((x) => x.code === code);
  if (!p) throw new Error(`Unknown product ${code}`);
  return p;
}

/** Security steps common to all products (guarantee, charge documents & perfection). */
export function securitySteps(c: CaseShape, after: string[]): StepSpec[] {
  const steps: StepSpec[] = [];
  if ((c.structure.guarantorName ?? "").trim()) {
    steps.push(sign("guarantee", "Guarantor executes Personal Guarantee", "PERSONAL_GUARANTEE", after));
  }
  if (c.securityType === "SECURED") {
    steps.push(
      sign("security_docs", "Execute charge / mortgage documents", "SECURITY_DOCUMENTS", after),
      {
        key: "security_perfection",
        title: "Perfect security (charge registration / mortgage / lien)",
        kind: "ACTION",
        dependsOn: ["security_docs"],
        note: "SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.",
        action: {
          roles: ["RCAD"],
          fields: [
            { name: "registrationRef", label: "Registration / lien reference", type: "text" },
            { name: "registeredWith", label: "Registered with (SECP / Sub-Registrar / Bank)", type: "text" },
          ],
        },
      },
    );
  }
  return steps;
}

/** Full execution plan: product steps + security steps; disbursements wait for security. */
export function buildExecutionPlan(product: ProductDef, c: CaseShape): StepSpec[] {
  const productSteps = product.steps(c);
  const first = productSteps[0];
  const sec = securitySteps(c, first ? [first.key] : []);
  const gateKeys = sec.filter((x) => x.key !== "security_docs").map((x) => x.key);
  const steps = productSteps.map((st) =>
    st.action?.effect === "DISBURSE" ? { ...st, dependsOn: [...new Set([...st.dependsOn, ...gateKeys])] } : st,
  );
  // insert security steps right after the first step for a readable order
  return first ? [steps[0], ...sec, ...steps.slice(1)] : [...sec, ...steps];
}

export function allDocSpecs(product: ProductDef): DocSpec[] {
  return [...COMMON_DOCS, ...product.documents];
}

export function docSpec(product: ProductDef, code: string): DocSpec {
  const d = allDocSpecs(product).find((x) => x.code === code);
  if (!d) throw new Error(`Document ${code} not defined for ${product.code}`);
  return d;
}
