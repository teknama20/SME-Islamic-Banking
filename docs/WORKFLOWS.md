# Transaction Workflows & Digital Sign-off

> Generated from `src/lib/products/catalog.ts` by `npm run docs:workflows`. The workflow engine enforces exactly what is written here.

## 1. Common lifecycle (all products)

The documentation of every transaction runs in one simple loop:

> **RCAD prepares & vets → RM / Team Leader / Unit Head sign → Customer (or Guarantor) signs → RCAD / RM verifies** — repeated for each document and each evidence item the product requires. **Shariah reviews the complete file at the end, after disbursement.**

| # | Stage | What happens | Who acts / signs off | Controls |
|---|---|---|---|---|
| 1 | Onboarding | SME profile, owners/UBOs, geo-tagged premises, KYC documents | RM creates · Customer uploads · **RCAD clears KYC/CDD** | SBP SME classification (Part-I); e-CIB (R-7); related-party flag (R-11); RM cannot clear own customer |
| 2 | Request | Product, purpose, amount, tenor, pricing, security, product structure | **RM** | Product terms; Shariah preconditions checked automatically; R-5, R-9, R-13; prohibited sectors |
| 3 | Submission | CPTM serial issued; customer auto-acknowledged; TAT clock starts | RM | R-19 CPTM; R-16 15 working-day TAT |
| 4 | Review | RCAD — KYC / AML / CDD; Credit & Risk (Trade / Legal / pre-sanction Shariah can be enabled per bank) | RCAD Officer · Credit / Risk Officer | Every checklist item confirmed; any reviewer can return to RM |
| 5 | Approval | Delegated authority by amount | Team Leader (recommends) → Unit Head ≤ PKR 25m → Regional Head ≤ PKR 100m → Country Head ≤ PKR 500m | Initiator cannot approve; one level per person; regional scope; personal limits |
| 6 | Offer (loop) | Offer Letter + Key Fact Statement (English/Urdu) | **RCAD** prepares → **RM / TL / UH** signs → offer reaches the customer automatically → **Customer** accepts → **RCAD / RM** verifies | Approved templates only; R-12 bilingual disclosure |
| 7 | Documentation (loop) | Product agreements in Shariah order (table per product below) | RCAD → RM / TL / UH → Customer / Guarantor → RCAD / RM | OTP, typed name, consent, GPS; seal bound to document hash; four eyes on bank signatures |
| 8 | Evidence (loop) | Purchase / possession / delivery / title / Takaful evidence | **Customer / RM** capture → **RCAD / RM** verify (never the capturer) | GPS mandatory where possession matters; hashed, encrypted, watermarked |
| 9 | Disbursement | Payment to supplier / vendor / contractor | **RCAD** prepares (maker) → **Team Leader / Unit Head** authorises (checker) | Cumulative payments ≤ sanctioned amount; waits for security perfection |
| 10 | Activation & monitoring | Facility booked; schedule fixed; repayments, DPD, classification | **RCAD** | R-17 / Annexure I & II; R-18 |
| 11 | **Shariah review (final)** | Complete file reviewed after disbursement | **Shariah Compliance Officer** | Compliant, or non-compliant → rectification and purification of income to charity |
| — | Audit | Read-only case files, chain verification, execution pack, evidence bundle | **Internal Audit** | Hash-chained, append-only audit trail |

### Clearance checklists

**RCAD — KYC / AML / CDD** (RCAD Officer)
- KYC / CDD complete and customer KYC cleared
- Sanctions, PEP and adverse-media screening clear
- Ultimate beneficial owners identified
- Latest e-CIB / CIB report obtained (SME PR R-7)
- Mandatory documents verified against originals / NADRA

**Credit & Risk** (Credit / Risk Officer)
- Financial spreading and ratio analysis completed
- Cash-flow and repayment capacity assessed
- Internal risk rating assigned
- Credit score obtained (SME PR R-15)
- Security & margin adequate per policy (SME PR R-13)
- Per-party and clean exposure limits verified (R-5 / R-9)

**Trade** (Trade Officer)
- Supplier / contractor / buyer validated
- Quotation / proforma invoice verified
- Trade cycle and delivery terms verified
- Import / export documents (if any) in order

**Shariah Compliance** (Shariah Compliance Officer)
- Mode is appropriate to the underlying need
- Asset and business activity are Shariah-permissible
- Contract sequence and possession requirements configured
- No buy-back (Inah), hidden interest or conditional sale
- Shariah Board-approved model agreements in use

**Legal** (Legal Officer)
- Capacity & authority of signatories verified (board resolution / partnership deed)
- Approved templates and security documents selected
- Stamp duty and registration requirements identified
- Title and enforceability of security confirmed

### Common documents

| Document | Signing order |
|---|---|
| Facility Offer Letter (Sanction Advice) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Key Fact Statement (English / اردو) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory |
| Personal Guarantee | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Memorandum of Charge / Mortgage / Hypothecation | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

Personal Guarantee is added when a guarantor is named; charge documents and the *Perfect security* step (RCAD) are added for secured facilities. All disbursement steps wait for security perfection.

## 2. Murabaha (مرابحہ)

Cost-plus sale. The bank (directly or through the customer as its agent) purchases an identified tangible asset, takes physical or constructive possession, then sells it to the customer at disclosed cost plus an agreed profit, payable on deferred terms.

**Family:** Trade (sale) · **Use cases:** Raw material & inventory, Machinery & equipment, Vehicles, Trade goods · **Repayment:** MONTHLY, QUARTERLY, BULLET · **Max tenor:** 60 months · **Trade clearance:** yes

**Standards:** SS 8 Murabahah; SS 18 Possession (Qabd); SS 23 Agency; SS 3 Procrastinating debtor (charity); SBP Essentials & Model Agreement — Murabaha; SME PR R-12 (bilingual disclosure); SME PR R-14 (e-agreements)

**Shariah rules enforced**
- The asset must exist, be identified and owned by the bank before it is sold to the customer.
- Bank (or its agent) must take physical or constructive possession; risk passes to the bank before sale.
- Cost and profit must be disclosed and fixed at the time of sale; price cannot increase thereafter.
- The customer's promise to purchase is a unilateral undertaking, not a sale.
- Payment to the supplier should be made directly by the bank wherever possible.
- Late payment amounts go to charity and are not bank income.

**Product documents**

| Document | Signing order |
|---|---|
| Master Murabaha Financing Agreement | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Undertaking / Promise to Purchase | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Agency Agreement (Wakalah) for Purchase | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Murabaha Sale — Bank's Offer & Customer's Acceptance | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Master Murabaha Financing Agreement<br><sub>Framework agreement; no sale occurs at this stage.</sub> | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Master Murabaha Financing Agreement |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Master Murabaha Financing Agreement |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Customer signs Promise to Purchase<br><sub>Unilateral promise (wa'd) — binding on the promisor only.</sub> | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Master Murabaha Financing Agreement |
| 6 | Execute Agency Agreement (customer as purchasing agent)<br><sub>Customer purchases on the bank's behalf; asset risk remains with the bank.</sub> | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Customer signs Promise to Purchase |
| 7 | Pay supplier directly for the asset<br><sub>Bank pays the supplier; invoice must be in the bank's name (or agent on bank's behalf).</sub> | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Execute Agency Agreement (customer as purchasing agent); Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 8 | Capture purchase & possession evidence<br><sub>AAOIFI SS 18: geo-tagged, time-stamped proof of possession before onward sale.</sub> | EVIDENCE | Capture: Customer — Authorised Signatory, Customer — User (Accountant), Relationship Manager<br>Verify: RCAD Officer, Relationship Manager | Invoice / challan / Delivery / Possession / Inspection; min 2; GPS mandatory; capturer ≠ verifier. Checks: Supplier invoice / delivery challan matches the quotation; Asset physically identified (serial / lot / tag) and photographed at location; Asset in the bank's (or agent's) possession; risk with the bank; Bank's ownership established before sale; Physical / constructive possession verified from evidence; No sale to the customer has occurred before possession; Supplier is a third party (no buy-back) | Pay supplier directly for the asset |
| 9 | Murabaha sale: bank's offer & customer's acceptance<br><sub>Only after possession is verified. The Murabaha sale is concluded here; price (cost + profit) is fixed from this point.</sub> | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Capture purchase & possession evidence |
| 10 | Book facility in core banking & activate schedule<br><sub>Deferred sale price receivable booked; instalment schedule starts.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Murabaha sale: bank's offer & customer's acceptance |
| 11 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 3. Tijarah (تجارہ)

Post-sale working capital. The bank purchases the customer's finished goods on a cash basis, takes possession, and then sells them in the market — itself or through the customer as its sales agent — earning profit on resale.

**Family:** Trade (sale) · **Use cases:** Manufacturers' finished-goods inventory, Post-production working capital, Distributor stocks · **Repayment:** BULLET · **Max tenor:** 12 months · **Trade clearance:** yes

**Standards:** SS 8 Murabahah (sale principles); SS 18 Possession (Qabd); SS 23 Agency; SBP Islamic Banking Product Handbook — Tijarah; SME PR R-10 (monitoring, digital stock reports)

**Shariah rules enforced**
- Goods must be finished, identified and segregated as the bank's property.
- The bank must take possession (physical or constructive) before reselling.
- The sale back to the same customer is prohibited (no buy-back / Bai al-Inah).
- As sales agent the customer sells to third parties and remits proceeds; agency fee is fixed.

**Product documents**

| Document | Signing order |
|---|---|
| Master Tijarah Agreement | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Tijarah Sale Deed (Customer sells goods to Bank) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Sales Agency Agreement (Customer sells on Bank's behalf) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Master Tijarah Agreement | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Master Tijarah Agreement |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Master Tijarah Agreement |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Bank purchases finished goods (Tijarah sale deed) | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Master Tijarah Agreement |
| 6 | Pay purchase price to customer<br><sub>Cash purchase of finished goods by the bank.</sub> | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Bank purchases finished goods (Tijarah sale deed); Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 7 | Capture stock possession evidence at warehouse | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Possession / Inspection; min 2; GPS mandatory; capturer ≠ verifier. Checks: Goods segregated & marked as bank property; Quantity & quality verified against sale deed; Warehouse access / keys under bank control or agent; Bank's ownership & possession established; Resale will be to third parties, not the customer | Pay purchase price to customer |
| 8 | Appoint customer as sales agent | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Capture stock possession evidence at warehouse |
| 9 | Book facility in core banking & activate schedule<br><sub>Resale proceeds due at maturity; sale price includes bank's profit.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Appoint customer as sales agent |
| 10 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 4. Istisna (with Parallel Istisna) (استصناع)

Order to manufacture/construct. The bank agrees to deliver a specified asset to the customer at a fixed price and separately orders it from a contractor under a Parallel Istisna. Contractor payments are released against certified milestones.

**Family:** Manufacturing (sale) · **Use cases:** Plant & machinery fabrication, Construction of factory / warehouse, Custom equipment · **Repayment:** MONTHLY, QUARTERLY, BULLET · **Max tenor:** 84 months · **Trade clearance:** yes

**Standards:** SS 11 Istisna'a and Parallel Istisna'a; SS 18 Possession (Qabd); SBP Essentials — Istisna; SME PR R-10 (monitoring)

**Shariah rules enforced**
- Specifications, price and delivery date must be fixed and unambiguous.
- The two contracts (Istisna & Parallel Istisna) are independent; customer obligations do not depend on the contractor's.
- Bank bears the risk of the asset until delivery to the customer.
- Milestone payments only against certified progress.

**Product documents**

| Document | Signing order |
|---|---|
| Istisna Agreement (Bank as manufacturer, Customer as buyer) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Parallel Istisna Agreement (Bank with Contractor) (+ Contractor off-platform) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Delivery & Acceptance Certificate | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Istisna Agreement with customer | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Istisna Agreement with customer |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Istisna Agreement with customer |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Execute Parallel Istisna with contractor<br><sub>Independent contract; contractor's counter-signed copy uploaded as evidence.</sub> | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Istisna Agreement with customer |
| 6 | Upload contractor-signed Parallel Istisna | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Counterparty-signed contract; min 1; capturer ≠ verifier. Checks: Contractor signature & stamp present; Terms identical to platform version (hash compared) | Execute Parallel Istisna with contractor |
| 7 | Milestone 1: site progress & certification | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Milestone / Site visit / Inspection; min 2; GPS mandatory; capturer ≠ verifier. Checks: Consultant / engineer certificate attached; Geo-tagged site photos / video; Contractor invoice for milestone | Upload contractor-signed Parallel Istisna |
| 8 | Release milestone 1 payment to contractor | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Milestone 1: site progress & certification; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 9 | Milestone 2: site progress & certification | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Milestone / Site visit / Inspection; min 2; GPS mandatory; capturer ≠ verifier. Checks: Consultant / engineer certificate attached; Geo-tagged site photos / video; Contractor invoice for milestone | Release milestone 1 payment to contractor |
| 10 | Release milestone 2 payment to contractor | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Milestone 2: site progress & certification; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 11 | Capture completion & delivery to bank | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Delivery / Possession / Inspection; min 2; GPS mandatory; capturer ≠ verifier. Checks: Completion certificate; Asset conforms to specifications; Bank took possession from contractor; Asset conforms to Istisna specifications; Bank possessed the asset before delivering it to the customer; Goods manufactured after contract; Bank's possession verified before resale; Price was paid in full at contract; Goods delivered conform to specifications; Any Parallel Salam is independent | Release milestone 2 payment to contractor |
| 12 | Customer accepts delivery | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Capture completion & delivery to bank |
| 13 | Book facility in core banking & activate schedule<br><sub>Istisna price receivable from customer per agreed schedule.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Customer accepts delivery |
| 14 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 5. Istisna (Working Capital) (استصناع (ورکنگ کیپیٹل))

Pre-shipment / pre-production finance. The bank orders goods from the customer (as manufacturer) and pays the Istisna price in advance; on delivery the bank sells the goods in the market through the customer as its agent.

**Family:** Manufacturing (sale) · **Use cases:** Textile & garment orders, Export pre-shipment, Seasonal manufacturing · **Repayment:** BULLET · **Max tenor:** 12 months · **Trade clearance:** yes

**Standards:** SS 11 Istisna'a; SS 23 Agency; SS 18 Possession (Qabd); SBP Essentials — Istisna

**Shariah rules enforced**
- Goods must be manufactured (not ready stock) and fully specified.
- Delivery to the bank (possession) must precede resale.
- Sale proceeds belong to the bank; the agent remits them and earns only the agreed fee.

**Product documents**

| Document | Signing order |
|---|---|
| Istisna Agreement (Customer as manufacturer, Bank as buyer) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Sales Agency Agreement (Customer sells on Bank's behalf) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Istisna Agreement | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Istisna Agreement |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Istisna Agreement |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Pay Istisna price to customer (manufacturer) | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Execute Istisna Agreement; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 6 | Capture delivery of manufactured goods to bank | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Delivery / Possession / Inspection; min 2; GPS mandatory; capturer ≠ verifier. Checks: Goods match specifications & quantity; Goods segregated as bank property; Inspection report attached | Pay Istisna price to customer (manufacturer) |
| 7 | Appoint customer as sales agent | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Capture delivery of manufactured goods to bank |
| 8 | Book facility in core banking & activate schedule<br><sub>Sale proceeds (cost + profit) due at maturity.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Appoint customer as sales agent |
| 9 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 6. Diminishing Musharakah (شرکتِ متناقصہ)

Co-ownership of a specified tangible asset. The bank leases its share to the customer for rental and the customer gradually buys the bank's units under a separate undertaking until it owns the asset outright.

**Family:** Partnership · **Use cases:** Commercial property / factory, Plant & machinery, Vehicle fleet, Solar & energy systems · **Repayment:** MONTHLY, QUARTERLY · **Max tenor:** 120 months · **Trade clearance:** no

**Standards:** SS 12 Sharikah (Musharakah) — diminishing; SS 9 Ijarah; SS 5 Guarantees; SBP Essentials — Diminishing Musharakah; SME PR Annexure II (FSV valuations)

**Shariah rules enforced**
- Limited to specified tangible assets — not an entire enterprise.
- Co-ownership (Shirkat-ul-Milk), lease of bank's share and unit purchases are separate contracts.
- Units are purchased at the price agreed at each purchase (or pre-agreed per undertaking); ownership must reflect payments.
- Major maintenance & Takaful of the asset are the owners' responsibility in proportion to ownership.

**Product documents**

| Document | Signing order |
|---|---|
| Musharakah (Shirkat-ul-Milk) Agreement | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Undertaking to Purchase Musharakah Units | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Ijarah (Rental) Agreement for Bank's Share | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Musharakah (co-ownership) Agreement | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Musharakah (co-ownership) Agreement |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Musharakah (co-ownership) Agreement |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Customer signs Undertaking to Purchase Units | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Musharakah (co-ownership) Agreement |
| 6 | Upload independent valuation & title report<br><sub>SME PR Annexure II: valuation by PBA-panel evaluator.</sub> | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Valuation report / Title / registration; min 2; capturer ≠ verifier. Checks: PBA-panel valuer report (full scope); Title search / legal opinion clear | Customer signs Undertaking to Purchase Units |
| 7 | Pay vendor (bank & customer contributions) | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Upload independent valuation & title report; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 8 | Capture asset title & possession evidence | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Title / registration / Possession / Site visit; min 2; GPS mandatory; capturer ≠ verifier. Checks: Title / registration reflects joint ownership or bank's interest; Geo-tagged photos / video of asset; Asset identifiers recorded | Pay vendor (bank & customer contributions) |
| 9 | Upload Takaful cover for the asset | EVIDENCE | Capture: Customer — Authorised Signatory, Customer — User (Accountant), Relationship Manager<br>Verify: RCAD Officer, Relationship Manager | Takaful cover; min 1; capturer ≠ verifier. Checks: Takaful covers full asset value; Bank noted as co-owner / loss payee; Joint ownership created before lease; Lease, co-ownership & unit undertaking are separate documents; Rental applies only to the bank's share; Bank owns the asset; Asset exists and is deliverable; No rental charged before delivery | Capture asset title & possession evidence |
| 10 | Execute Ijarah of bank's share<br><sub>Rental accrues only after the asset is acquired and delivered.</sub> | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Upload Takaful cover for the asset |
| 11 | Book facility in core banking & activate schedule<br><sub>Unit purchase & rental schedule starts; unit register maintained.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Execute Ijarah of bank's share |
| 12 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 7. Ijarah (اجارہ)

Operating lease. The bank purchases and owns the asset, leases its usufruct to the customer for rentals and, at maturity, transfers ownership through a separate sale or gift under a unilateral undertaking.

**Family:** Lease · **Use cases:** Vehicles, Machinery & equipment, Generators / solar systems · **Repayment:** MONTHLY, QUARTERLY · **Max tenor:** 84 months · **Trade clearance:** no

**Standards:** SS 9 Ijarah and Ijarah Muntahia Bittamleek; SS 18 Possession (Qabd); SBP Essentials — Ijarah; IFAS-2 Ijarah accounting

**Shariah rules enforced**
- The bank must own the asset and bear ownership risks (major maintenance, Takaful).
- Rental starts only after the asset is delivered to the lessee.
- Asset must be non-consumable with usufruct separable from the corpus.
- Transfer of ownership at maturity is by a separate document, not embedded in the lease.

**Product documents**

| Document | Signing order |
|---|---|
| Undertaking to Lease | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Ijarah Agreement & Rental Schedule | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Bank's Undertaking to Sell / Gift at Maturity | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Customer signs Undertaking to Lease | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Customer — Authorised Signatory<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Customer signs Undertaking to Lease |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Customer signs Undertaking to Lease |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Pay vendor — bank purchases the asset | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Customer signs Undertaking to Lease; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 6 | Capture bank's ownership & possession of asset | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Invoice / challan / Title / registration / Possession; min 2; GPS mandatory; capturer ≠ verifier. Checks: Invoice / registration in bank's name; Asset identified (chassis / serial no.); Geo-tagged photos at delivery point | Pay vendor — bank purchases the asset |
| 7 | Upload Takaful cover (bank as owner) | EVIDENCE | Capture: Customer — Authorised Signatory, Customer — User (Accountant), Relationship Manager<br>Verify: RCAD Officer, Relationship Manager | Takaful cover; min 1; capturer ≠ verifier. Checks: Takaful in bank's name as owner | Capture bank's ownership & possession of asset |
| 8 | Execute Ijarah Agreement | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Upload Takaful cover (bank as owner) |
| 9 | Capture handover of asset to customer<br><sub>Rental period starts on delivery to the lessee.</sub> | EVIDENCE | Capture: Customer — Authorised Signatory, Customer — User (Accountant), Relationship Manager<br>Verify: RCAD Officer, Relationship Manager | Delivery; min 1; GPS mandatory; capturer ≠ verifier. Checks: Delivery receipt signed by customer; Condition of asset recorded (photos) | Execute Ijarah Agreement |
| 10 | Bank issues Undertaking to Sell at maturity | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Capture handover of asset to customer |
| 11 | Book facility in core banking & activate schedule<br><sub>Rental schedule starts from delivery date.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Bank issues Undertaking to Sell at maturity |
| 12 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 8. Salam (with Parallel Salam) (سلم)

Advance purchase. The bank pays the full price at contract for fungible goods (typically agricultural produce or commodities) to be delivered on a future date, then sells them through the customer as agent or under an independent Parallel Salam.

**Family:** Forward sale · **Use cases:** Agricultural produce (rice, wheat, cotton), Commodity pre-financing, Seasonal procurement · **Repayment:** BULLET · **Max tenor:** 12 months · **Trade clearance:** yes

**Standards:** SS 10 Salam and Parallel Salam; SS 18 Possession (Qabd); SBP Essentials — Salam

**Shariah rules enforced**
- Full price must be paid at the time of contract (spot), not deferred.
- Goods must be fungible and precisely specified (quality, quantity, delivery date & place).
- Gold, silver and currencies cannot be the subject of Salam.
- Parallel Salam must be independent of the first Salam.

**Product documents**

| Document | Signing order |
|---|---|
| Salam Agreement (Customer as seller, Bank as buyer) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |
| Sales Agency Agreement (Customer sells on Bank's behalf) | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Salam Agreement | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Salam Agreement |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Salam Agreement |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Pay full Salam price at contract<br><sub>Must be paid in full at the contract session (AAOIFI SS 10).</sub> | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Execute Salam Agreement; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 6 | Capture delivery & quality inspection of goods | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Delivery / Inspection / Possession; min 2; GPS mandatory; capturer ≠ verifier. Checks: Quantity & grade per Salam specifications; Warehouse receipt / storage location; Geo-tagged photos of goods | Pay full Salam price at contract |
| 7 | Appoint customer as sales agent | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Capture delivery & quality inspection of goods |
| 8 | Book facility in core banking & activate schedule<br><sub>Resale proceeds due at maturity.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Appoint customer as sales agent |
| 9 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 9. Running Musharakah (رننگ مشارکہ)

Working-capital partnership. The bank participates in the customer's business operations through a running limit; profit is shared per an agreed ratio on actual results and loss in proportion to capital.

**Family:** Partnership · **Use cases:** Revolving working capital, Trading businesses with auditable accounts · **Repayment:** QUARTERLY · **Max tenor:** 12 months · **Trade clearance:** no

**Standards:** SS 12 Sharikah (Musharakah); SS 13 Mudarabah (profit computation); SBP Instructions on Running Musharakah; SME PR R-10 (monitoring)

**Shariah rules enforced**
- Profit ratio is agreed in advance; a fixed return on capital is prohibited.
- Loss is shared strictly in proportion to capital contribution.
- Provisional profits are settled against actual results at the end of each period.

**Product documents**

| Document | Signing order |
|---|---|
| Running Musharakah Agreement | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) |

**Execution sequence** (secured, with guarantor)

| # | Step | Type | Who | Controls | Unlocks after |
|---|---|---|---|---|---|
| 1 | Execute Running Musharakah Agreement | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Bank — Second Signatory (Team Leader / Unit Head) (Team Leader / Unit Head)<br>4. Customer — Authorised Signatory<br>5. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | offer acceptance |
| 2 | Guarantor executes Personal Guarantee | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Guarantor<br>3. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Running Musharakah Agreement |
| 3 | Execute charge / mortgage documents | SIGN | 1. RCAD — Prepared & vetted (RCAD Officer)<br>2. Bank — Authorised Signatory (RM / Team Leader / Unit Head) (Relationship Manager / Team Leader / Unit Head)<br>3. Customer — Authorised Signatory<br>4. RCAD / RM — Documentation verified (RCAD Officer / Relationship Manager) | Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text | Execute Running Musharakah Agreement |
| 4 | Perfect security (charge registration / mortgage / lien)<br><sub>SME PR R-13 & Annexure II: only perfected charges qualify for FSV benefit.</sub> | ACTION | RCAD Officer | Registration / lien reference, Registered with (SECP / Sub-Registrar / Bank) | Execute charge / mortgage documents |
| 5 | Baseline stock & business inspection | EVIDENCE | Capture: Relationship Manager, RCAD Officer<br>Verify: RCAD Officer, Relationship Manager | Inspection / Site visit; min 1; GPS mandatory; capturer ≠ verifier. Checks: Stock & receivables report; Geo-tagged premises visit | Execute Running Musharakah Agreement |
| 6 | Make Musharakah limit available | ACTION | Maker: RCAD Officer<br>Checker: Team Leader / Unit Head | Maker-checker; cumulative payments ≤ sanctioned amount | Baseline stock & business inspection; Guarantor executes Personal Guarantee; Perfect security (charge registration / mortgage / lien) |
| 7 | Book facility in core banking & activate schedule<br><sub>Quarterly provisional profit; settlement on actuals.</sub> | ACTION | RCAD Officer | All other steps complete; schedule fixed | Make Musharakah limit available |
| 8 | **Post-disbursement Shariah review** | CHECK | Shariah Compliance Officer | Contract sequence followed (promise → purchase / co-ownership → possession → sale / lease); Possession evidence is adequate and preceded the sale or lease; Approved model agreements used and fully executed; Price / rental fixed and disclosed; no rollover or compounding; Payment made to a genuine third-party supplier / vendor (no buy-back); Late-payment charity undertaking in place | Book facility in core banking & activate schedule |

## 10. Digital signature & evidence arrangement

- **Authentication:** username + password (scrypt) + OTP at login; idle timeout and absolute session lifetime; lockout after repeated failures.
- **Signing:** per-slot OTP bound to (user, document); signer types their registered full name and consents; server re-hashes the stored text and refuses if it differs from the recorded SHA-256; signature row stores signer, capacity, role, IP, user agent, GPS + accuracy and trusted server time; an HMAC seal binds (document, hash, slot, signer, party, decision, time).
- **Order & eligibility:** slots are signed strictly in sequence; customer slots only by the customer's authorised signatory; guarantor slots only by the guarantor; bank slots only by the listed roles within the case's region, never by the case RM, and never twice by the same officer.
- **Immutability:** signatures and audit events are append-only (database triggers); executed document text and hashes cannot be updated.
- **Evidence:** photos, videos and PDFs captured in-app with GPS, trusted server time, device time, device/network details and IP; images receive a watermarked copy (case, category, asset, time, GPS, user) while the original is preserved; files are SHA-256 hashed and AES-256-GCM encrypted per tenant; every view or download is audited; the capturer can never verify their own evidence.
- **Exports:** printable Execution Pack (documents + signature certificates + evidence register + audit trail) and a hashed JSON evidence bundle with document-integrity and chain verification results.
- **Production upgrade path:** replace the HMAC seal with PKI signatures from the bank's CA or a licensed certification service provider (advanced electronic signature under ETO 2002), add RFC 3161 time-stamping, NADRA biometric / e-Sahulat verification and WORM object storage.
