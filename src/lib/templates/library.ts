// Seed library of document templates.
//
// These are structured drafts modelled on the SBP Essentials / model agreements
// for Islamic modes of financing. They are seeded per tenant as version 1 and
// MUST be reviewed and approved by the bank's Shariah Board and Legal before
// production use (the platform enforces Shariah + Legal approval per version).
//
// Placeholders: {{bank.*}}, {{customer.*}}, {{case.*}}, {{product.*}},
// {{pricing.*}}, {{s.<structure field>}}, {{date.*}}, {{approval.*}}.

export type TemplateSeed = { code: string; title: string; body: string };

const PARTIES = `**Between:** {{bank.legalName}} ("the Bank"), and
**{{customer.legalName}}** (CIF {{customer.cif}}, NTN {{customer.ntn}}), a {{customer.legalForm}} having its place of business at {{customer.address}}, {{customer.city}} ("the Customer").`;

const FOOTER = `---
Case {{case.ref}} · CPTM {{case.cptmNo}} · Generated {{date.today}} · This document is executed electronically under the Electronic Transactions Ordinance, 2002 and SBP SME PR R-14. Each signature is bound to the SHA-256 hash of this exact text.`;

export const TEMPLATE_LIBRARY: TemplateSeed[] = [
  {
    code: "OFFER_LETTER",
    title: "Facility Offer Letter (Sanction Advice)",
    body: `# Offer Letter — {{product.name}} Facility
Ref: {{case.ref}} · Date: {{date.today}}

To: **{{customer.legalName}}**, {{customer.address}}, {{customer.city}}

We are pleased to inform you that {{bank.name}} has approved the following Shariah-compliant facility, subject to the terms below and execution of the documents listed.

| Term | Detail |
|---|---|
| Mode of financing | {{product.name}} ({{product.nameUrdu}}) |
| Purpose | {{case.purpose}} |
| Facility amount | {{case.amount}} ({{case.amountWords}}) |
| Tenor | {{case.tenorMonths}} months |
| Profit rate | {{case.profitRate}}% p.a. (benchmark: {{case.benchmark}}) |
| Repayment | {{case.repayment}} — {{pricing.instalments}} instalment(s) |
| Total payable (indicative) | {{pricing.totalPayable}} |
| Security | {{case.security}} |
| Approving authority | {{approval.authority}} on {{approval.date}} |

## Conditions precedent
1. Execution of the {{product.name}} documents in the sequence prescribed by the Bank's Shariah Compliance Department.
2. Perfection of securities, where applicable, prior to disbursement.
3. Submission of evidence of purchase / possession / delivery as required under the mode.
4. Continued validity of KYC/CDD and absence of adverse e-CIB information.

## Shariah compliance
This facility has been structured in accordance with the Shariah Board-approved product programme of the Bank and AAOIFI Shariah Standards adopted by the State Bank of Pakistan. In case of late payment, the Customer undertakes to pay an amount to charity as per the Bank's approved policy; no such amount forms part of the Bank's income.

## Acceptance
This offer is valid for 30 days. Please confirm acceptance by signing electronically below. Your key terms are also provided in Urdu in the accompanying Key Fact Statement (SBP SME PR R-12).

${FOOTER}`,
  },
  {
    code: "KFS",
    title: "Key Fact Statement (English / اردو)",
    body: `# Key Fact Statement
{{bank.name}} · Case {{case.ref}}

| Item | Detail |
|---|---|
| Facility | {{product.name}} |
| Amount | {{case.amount}} |
| Tenor | {{case.tenorMonths}} months |
| Profit rate | {{case.profitRate}}% p.a. ({{case.benchmark}}) |
| Total amount payable | {{pricing.totalPayable}} |
| Instalments | {{pricing.instalments}} × approx. {{pricing.instalmentAmount}} |
| Security | {{case.security}} |
| Late payment | Charity undertaking — not income of the Bank |
| Early settlement | Rebate at the Bank's discretion as per Shariah Board policy |
| Complaints | Bank SME helpline / SBP Sunwai portal (sunwai.sbp.org.pk) |

## Indicative repayment schedule
{{pricing.schedule}}

:::urdu
## اہم حقائق کا بیان
- **سہولت کی نوعیت:** {{product.nameUrdu}}
- **رقم:** {{case.amount}}
- **مدت:** {{case.tenorMonths}} ماہ
- **منافع کی شرح:** سالانہ {{case.profitRate}} فیصد ({{case.benchmark}})
- **کل قابلِ ادائیگی رقم:** {{pricing.totalPayable}}
- **اقساط کی تعداد:** {{pricing.instalments}}
- **ادائیگی کا طریقہ:** {{case.repaymentUrdu}}
- **ضمانت:** {{case.security}}
- **تاخیر سے ادائیگی:** تاخیر کی صورت میں صارف صدقہ ادا کرنے کا پابند ہوگا جو خیراتی مقاصد میں استعمال ہوگا اور بینک کی آمدنی کا حصہ نہیں بنے گا۔
- **قبل از وقت ادائیگی:** شریعہ بورڈ کی منظور شدہ پالیسی کے مطابق رعایت دی جا سکتی ہے۔
- **شکایات:** بینک کی ایس ایم ای ہیلپ لائن یا اسٹیٹ بینک کے سنوائی پورٹل (sunwai.sbp.org.pk) پر شکایت درج کروائیں۔

میں تصدیق کرتا/کرتی ہوں کہ مجھے اس سہولت کی تمام اہم شرائط اور ذمہ داریوں سے اردو اور انگریزی دونوں زبانوں میں آگاہ کر دیا گیا ہے۔
:::

I confirm that the key terms and obligations of this facility have been explained to me in English and Urdu.

${FOOTER}`,
  },
  {
    code: "PERSONAL_GUARANTEE",
    title: "Personal Guarantee",
    body: `# Personal Guarantee
In consideration of {{bank.legalName}} extending the {{product.name}} facility of {{case.amount}} to **{{customer.legalName}}** (Case {{case.ref}}), I, **{{case.guarantorName}}**, hereby irrevocably and unconditionally guarantee the due payment of all amounts payable by the Customer under the facility documents.

1. This guarantee is a continuing guarantee and shall remain in force until all obligations are discharged in full.
2. The guarantee secures only the actual amounts due; no amount in the nature of interest is guaranteed.
3. The guarantor waives any requirement that the Bank first proceed against the Customer.
4. This guarantee is given without consideration from the Bank to the guarantor (AAOIFI SS 5).

${FOOTER}`,
  },
  {
    code: "SECURITY_DOCUMENTS",
    title: "Memorandum of Charge / Mortgage / Hypothecation",
    body: `# Memorandum of Security
${PARTIES}

The Customer creates the following security in favour of the Bank to secure all amounts payable under Case {{case.ref}}:

> {{case.collateral}}

1. The Customer shall register the charge with SECP / the relevant Sub-Registrar within the statutory period and deliver evidence to the Bank.
2. The secured assets shall be kept insured under Takaful with the Bank as loss payee.
3. The Customer shall not create any further charge without the Bank's prior written consent.
4. The Bank may inspect the secured assets and record geo-tagged evidence at any time.

${FOOTER}`,
  },
  {
    code: "MMFA",
    title: "Master Murabaha Financing Agreement",
    body: `# Master Murabaha Financing Agreement
${PARTIES}

## 1. Facility
The Bank agrees to make available a Murabaha facility up to {{case.amount}} ({{case.amountWords}}) for {{case.purpose}}, for a tenor of {{case.tenorMonths}} months.

## 2. Nature of transactions
Each Murabaha shall be a separate sale of an identified asset owned and possessed by the Bank. This Agreement is a framework only and does not itself constitute a sale.

## 3. Purchase by the Bank
The Bank may purchase assets directly from the supplier or appoint the Customer as its agent under a separate Agency Agreement. Asset risk remains with the Bank until the Murabaha sale is concluded.

## 4. Murabaha price
The Murabaha price shall be the Bank's cost plus a profit of {{case.profitRate}}% p.a. ({{case.benchmark}}) computed for the deferred period, disclosed at the time of each sale and fixed thereafter.

## 5. Payment
The Customer shall pay the Murabaha price {{case.repayment}} as per the schedule annexed to each Declaration.

## 6. Late payment
In case of default, the Customer undertakes to pay an amount to a charity approved by the Bank's Shariah Board. The Bank shall not take such amount to its income.

## 7. Security
{{case.security}}

## 8. Governing law
This Agreement is governed by the laws of Pakistan and the Shariah principles approved by the Bank's Shariah Board ({{bank.shariahBoardRef}}).

${FOOTER}`,
  },
  {
    code: "PROMISE_TO_PURCHASE",
    title: "Undertaking / Promise to Purchase",
    body: `# Undertaking to Purchase
To: {{bank.legalName}}

We, **{{customer.legalName}}**, hereby request the Bank to purchase the following asset and unilaterally undertake to purchase it from the Bank on Murabaha basis once the Bank has acquired ownership and possession:

| Item | Detail |
|---|---|
| Asset | {{s.assetDescription}} |
| Quantity | {{s.quantity}} |
| Supplier | {{s.supplierName}} |
| Quotation ref. | {{s.quotationRef}} |
| Delivery location | {{s.deliveryLocation}} |
| Estimated cost | {{case.amount}} |

We understand that this undertaking is a promise and not a sale; the sale shall be concluded only through a subsequent Declaration and the Bank's acceptance. If we fail to honour this promise, we shall compensate the Bank for actual loss incurred (if any), without any element of profit.

${FOOTER}`,
  },
  {
    code: "AGENCY_AGREEMENT",
    title: "Agency Agreement (Wakalah) for Purchase",
    body: `# Agency Agreement
${PARTIES}

1. The Bank appoints the Customer as its agent to purchase on the Bank's behalf: {{s.assetDescription}} ({{s.quantity}}) from {{s.supplierName}}.
2. The agent shall purchase in the name and for the account of the Bank, obtain invoices in the Bank's name (or as agent of the Bank) and take delivery on the Bank's behalf.
3. Payment to the supplier shall be made directly by the Bank.
4. The asset shall remain at the Bank's risk while in the agent's possession, except for loss caused by the agent's negligence or misconduct.
5. The agent shall promptly provide geo-tagged, time-stamped evidence of purchase and possession through the platform.
6. The agency is performed without fee / for a nominal fee as agreed.

${FOOTER}`,
  },
  {
    code: "MURABAHA_DECLARATION",
    title: "Declaration & Offer to Purchase / Bank's Acceptance",
    body: `# Declaration & Offer to Purchase (Murabaha Sale)
To: {{bank.legalName}}

We, **{{customer.legalName}}**, acting as the Bank's agent, declare that we have purchased the following asset on behalf of the Bank and that it is in the Bank's (constructive) possession, as evidenced on the platform:

> {{s.assetDescription}} — {{s.quantity}} — supplied by {{s.supplierName}}

We now offer to purchase the above asset from the Bank on Murabaha basis:

| Term | Amount |
|---|---|
| Cost price | {{pricing.cost}} |
| Profit | {{pricing.profit}} |
| **Murabaha (sale) price** | **{{pricing.totalPayable}}** |
| Payment | {{case.repayment}}, {{pricing.instalments}} instalment(s) |

## Payment schedule
{{pricing.schedule}}

## Bank's acceptance
By its electronic signature below, the Bank accepts this offer and sells the asset to the Customer at the Murabaha price above. Ownership and risk pass to the Customer upon acceptance. The price shall not be increased thereafter.

${FOOTER}`,
  },
  {
    code: "MTA",
    title: "Master Tijarah Agreement",
    body: `# Master Tijarah Agreement
${PARTIES}

1. The Bank may from time to time purchase finished goods from the Customer for cash, up to an aggregate of {{case.amount}}, for a period of {{case.tenorMonths}} months.
2. Each purchase shall be through a separate Sale Deed identifying the goods, quantity, price and location.
3. After taking possession the Bank shall sell the goods to third parties, either itself or through the Customer acting as its sales agent. The goods shall not be sold back to the Customer.
4. The Bank's expected profit is {{case.profitRate}}% p.a.; the agent shall remit sale proceeds to the Bank by maturity.
5. Late payment: charity undertaking as per Shariah Board policy.

${FOOTER}`,
  },
  {
    code: "TIJARAH_SALE",
    title: "Tijarah Sale Deed",
    body: `# Tijarah Sale Deed
${PARTIES}

The Customer hereby sells and the Bank purchases the following finished goods for cash:

| Item | Detail |
|---|---|
| Goods | {{s.goodsDescription}} |
| Quantity | {{s.quantity}} |
| Location | {{s.warehouseLocation}} |
| Price | {{case.amount}} |

Ownership passes to the Bank on execution. The goods shall be segregated and marked as the Bank's property and the Bank (or its agent) shall take possession at the location above.

${FOOTER}`,
  },
  {
    code: "SALES_AGENCY",
    title: "Sales Agency Agreement",
    body: `# Sales Agency Agreement
${PARTIES}

1. The Bank appoints the Customer as its agent to sell the goods owned by the Bank under Case {{case.ref}} to third-party buyers.
2. The agent shall sell at not less than {{pricing.totalPayable}} in aggregate and remit sale proceeds to the Bank by maturity.
3. Any amount realised above the target price may be retained by the agent as an incentive; the agent's fee is otherwise fixed.
4. The agent shall not sell the goods to itself or to related parties.
5. Until sale, the goods remain the Bank's property and at its risk save for the agent's negligence.

${FOOTER}`,
  },
  {
    code: "ISTISNA_AGREEMENT",
    title: "Istisna Agreement",
    body: `# Istisna Agreement
${PARTIES}

1. The Bank (as manufacturer/seller) undertakes to manufacture or cause to be constructed and deliver to the Customer the following asset:
> {{s.specifications}}
2. Site / location: {{s.siteAddress}}. Delivery date: {{s.deliveryDate}}.
3. The Istisna price is fixed at **{{pricing.totalPayable}}**, payable {{case.repayment}} after delivery as per the annexed schedule.
4. The Bank may procure the asset through a Parallel Istisna with a contractor; that contract is independent of this Agreement.
5. The asset remains at the Bank's risk until delivery and acceptance by the Customer.

## Payment schedule
{{pricing.schedule}}

${FOOTER}`,
  },
  {
    code: "PARALLEL_ISTISNA",
    title: "Parallel Istisna Agreement",
    body: `# Parallel Istisna Agreement
**Between:** {{bank.legalName}} ("the Buyer") and **{{s.contractorName}}** ("the Contractor").

1. The Contractor shall manufacture / construct and deliver to the Bank: {{s.specifications}}, at {{s.siteAddress}}, by {{s.deliveryDate}}.
2. Contract price: {{case.amount}}, payable in {{s.milestones}} milestone(s) against certification by the Bank's appointed engineer and geo-tagged evidence on the platform.
3. This Agreement is independent of any Istisna between the Bank and its customer.
4. Liquidated damages / penalty for delay, if any, shall be applied as per Shariah Board-approved terms.

${FOOTER}`,
  },
  {
    code: "DELIVERY_CERTIFICATE",
    title: "Delivery & Acceptance Certificate",
    body: `# Delivery & Acceptance Certificate
Case {{case.ref}} — {{product.name}}

The Customer, **{{customer.legalName}}**, confirms that the asset described below has been delivered by the Bank in accordance with the agreed specifications and is accepted:

> {{s.specifications}}

Delivered at {{s.siteAddress}}. Possession evidence (photos, video, GPS and time stamps) is recorded in the case file.

${FOOTER}`,
  },
  {
    code: "ISTISNA_WC_AGREEMENT",
    title: "Istisna Agreement (Working Capital)",
    body: `# Istisna Agreement
${PARTIES}

1. The Bank orders and the Customer (as manufacturer) undertakes to manufacture and deliver: {{s.goodsSpecifications}} — {{s.quantity}}.
2. Delivery by {{s.deliveryDate}} at {{s.deliveryPlace}}.
3. Istisna price: {{case.amount}}, payable by the Bank in advance on execution.
4. Goods delivered shall become the Bank's property and be held at its risk; the Bank may sell them through the Customer as its sales agent.
5. Goods not conforming to specifications may be rejected by the Bank.

${FOOTER}`,
  },
  {
    code: "MUSHARAKAH_AGREEMENT",
    title: "Musharakah (Shirkat-ul-Milk) Agreement",
    body: `# Musharakah Agreement (Diminishing)
${PARTIES}

## 1. Asset
{{s.assetDescription}}, located at {{s.assetLocation}}, to be acquired from {{s.vendorName}} for a total of {{s.totalAssetValue}}.

## 2. Contributions & ownership
| Partner | Contribution | Share |
|---|---|---|
| Bank | {{case.amount}} | {{s.bankSharePct}}% |
| Customer | {{s.customerContribution}} | {{s.customerSharePct}}% |

## 3. Units
The Bank's share is divided into {{pricing.instalments}} units, which the Customer undertakes to purchase under a separate Undertaking.

## 4. Use of the asset
The Bank shall lease its share to the Customer under a separate Ijarah agreement. Rental is payable only on the Bank's share outstanding from time to time.

## 5. Risk & Takaful
Each partner bears ownership risk in proportion to its share. The asset shall be insured under Takaful.

${FOOTER}`,
  },
  {
    code: "UNDERTAKING_TO_PURCHASE",
    title: "Undertaking to Purchase Musharakah Units",
    body: `# Undertaking to Purchase Units
To: {{bank.legalName}}

We, **{{customer.legalName}}**, unilaterally undertake to purchase the Bank's {{pricing.instalments}} units in the asset ({{s.assetDescription}}) on the dates and at the unit prices set out below. Each purchase shall be effected by a separate offer and acceptance recorded on the platform.

{{pricing.schedule}}

In case of default, the Bank may require purchase of all outstanding units at their then fair value / agreed price, as approved by the Shariah Board.

${FOOTER}`,
  },
  {
    code: "DM_IJARAH",
    title: "Ijarah (Rental) Agreement for Bank's Share",
    body: `# Ijarah Agreement — Bank's Share
${PARTIES}

1. The Bank leases its undivided share in {{s.assetDescription}} to the Customer for {{case.tenorMonths}} months.
2. Rental: computed at {{case.profitRate}}% p.a. on the Bank's outstanding share, payable {{case.repayment}}, reducing as units are purchased (see schedule).
3. Rental accrues from the date the asset is acquired and made available to the Customer.
4. Ownership-related major maintenance and Takaful are borne by the owners in proportion to their shares; ordinary maintenance by the Customer as lessee.

## Rental & unit schedule
{{pricing.schedule}}

${FOOTER}`,
  },
  {
    code: "UNDERTAKING_TO_LEASE",
    title: "Undertaking to Lease",
    body: `# Undertaking to Lease
To: {{bank.legalName}}

We, **{{customer.legalName}}**, request the Bank to purchase {{s.assetDescription}} from {{s.vendorName}} and undertake to take it on Ijarah from the Bank for {{case.tenorMonths}} months on the terms of the Bank's Ijarah Agreement once the Bank has acquired it. A security deposit of {{s.securityDeposit}} shall be placed with the Bank.

If we fail to take the asset on lease, we shall compensate the Bank for actual loss (if any).

${FOOTER}`,
  },
  {
    code: "IJARAH_AGREEMENT",
    title: "Ijarah Agreement",
    body: `# Ijarah Agreement
${PARTIES}

1. **Asset:** {{s.assetDescription}} (owned by the Bank; acquired from {{s.vendorName}}).
2. **Term:** {{case.tenorMonths}} months, commencing on delivery of the asset to the Lessee.
3. **Rentals:** payable {{case.repayment}} as per the schedule below (total {{pricing.totalPayable}}).
4. **Ownership risks:** major maintenance and Takaful are the Bank's responsibility as owner; costs may be factored into rentals as agreed in advance.
5. **Use:** the Lessee shall use the asset with due care and in the normal course of its permissible business.
6. **Transfer:** any transfer of ownership at maturity shall be through a separate undertaking and sale/gift, not under this Agreement.
7. **Late payment:** charity undertaking as per Shariah Board policy.

## Rental schedule
{{pricing.schedule}}

${FOOTER}`,
  },
  {
    code: "UNDERTAKING_TO_SELL",
    title: "Bank's Undertaking to Sell / Gift",
    body: `# Undertaking to Sell
The Bank, {{bank.legalName}}, unilaterally undertakes that upon payment of all rentals under the Ijarah Agreement for Case {{case.ref}}, it shall sell / gift {{s.assetDescription}} to **{{customer.legalName}}** for a nominal consideration through a separate sale deed.

${FOOTER}`,
  },
  {
    code: "SALAM_AGREEMENT",
    title: "Salam Agreement",
    body: `# Salam Agreement
${PARTIES}

1. The Customer (as seller) sells and the Bank (as buyer) purchases: **{{s.commodity}}**, {{s.quantity}}, quality: {{s.qualitySpecs}}.
2. Delivery date: {{s.deliveryDate}}; delivery place: {{s.deliveryPlace}}.
3. Salam price: **{{case.amount}}**, paid by the Bank in full at the time of this contract.
4. The goods delivered must conform to the specifications; the Bank may reject non-conforming goods.
5. Any Parallel Salam entered into by the Bank is independent of this contract.

${FOOTER}`,
  },
  {
    code: "RUNNING_MUSHARAKAH_AGREEMENT",
    title: "Running Musharakah Agreement",
    body: `# Running Musharakah Agreement
${PARTIES}

1. **Business:** {{s.businessDescription}}.
2. **Bank's maximum participation:** {{case.amount}} for {{case.tenorMonths}} months, drawn as required.
3. **Profit sharing:** Bank {{s.bankProfitShare}}% / Customer remainder of actual profit, computed on daily-product basis.
4. **Loss sharing:** in proportion to capital contribution.
5. **Provisional profit:** payable quarterly on estimated results; final settlement on actual audited results.
6. **Reporting:** quarterly stock & receivables reports and digital stock reports (SME PR R-10).

${FOOTER}`,
  },
];
