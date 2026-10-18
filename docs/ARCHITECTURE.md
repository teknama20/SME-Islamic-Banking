# Architecture & Security

## 1. Logical architecture

```
 Browser / mobile web (bank staff · SME customers · guarantors)
        │  HTTPS, same-origin, CSP, no-store
        ▼
 Next.js App Router ─────────────────────────────────────────────────────────────
   Pages (Server Components)      Server Actions (mutations)      Route Handlers
   dashboards, case file,         auth → forensics (GPS, device)   evidence upload,
   documents, audit, admin        → engine → refresh               file vault, bundle
        │                                 │                              │
        └──────────────► Domain engine (src/lib/engine) ◄───────────────┘
                          cases · documents & signing · execution & evidence · customers
                                 │            │             │
              Product catalogue  │   SBP rules│   Audit trail (hash chain)
              (src/lib/products) │  (sbp.ts)  │   (audit.ts)
                                 ▼            ▼             ▼
                        Prisma ORM ── MySQL / MariaDB          Encrypted file vault
                        (append-only triggers on AuditEvent,   (AES-256-GCM per tenant,
                         Signature; frozen Document text)        SHA-256 content hash)
```

* **Engine is framework-independent.** Every operation takes an `Actor`: tenant, user, role, org path, IP, user agent, GPS and device. Tests, the seed and the UI all drive exactly the same code, and the autopilot used by the seed walks every product through its real controls.
* **Single source of truth for products.** `src/lib/products/catalog.ts` defines each mode's data, Shariah preconditions, documents with ordered signer slots, and the dependency graph of execution steps. The engine enforces it, the UI renders it, and `docs/WORKFLOWS.md` is generated from it.
* **Transactions.** Each business action, together with its audit event and notifications, commits atomically in one database transaction.

## 2. Data model (main entities)

| Entity | Purpose |
|---|---|
| `Tenant` | White-label bank: branding, bank type, Shariah Board reference, settings (approval matrix, security policy, TAT, holidays) |
| `OrgUnit` | Country/Region/Unit/Team tree with a materialised path for scoping |
| `User` | Bank staff (role, org unit, optional personal limit) or customer user (role, linked SME) |
| `Session`, `OtpChallenge` | Server-side sessions (hashed token id) and hashed, single-use OTPs |
| `Customer`, `CustomerPerson`, `CustomerDocument` | SME profile, SBP category, KYC/CDD results, e-CIB, related-party flag, owners/UBOs/signatories, KYC files |
| `FinancingCase` | One case file per request: product, terms, structure, stage, CPTM, TAT, classification |
| `Clearance`, `Approval` | Parallel review tracks and the delegated-authority chain (with rounds after returns) |
| `Template`, `Document`, `Signature` | Versioned, approved templates → merged, hashed documents → ordered, sealed, append-only signatures |
| `ExecutionStep`, `Evidence`, `StoredFile` | Product execution plan, geo-tagged evidence, encrypted files |
| `Installment` | Repayment / rental / unit-purchase schedule |
| `AuditEvent` | Hash-chained, append-only trail |
| `Notification` | In-app alerts (SMS/e-mail gateways in production) |

## 3. Information-security controls

| Domain | Control in this build | Production hardening |
|---|---|---|
| Identity & access | scrypt (N=2¹⁵) passwords with a complexity policy; lockout after N failures; OTP second factor at login; server-side sessions with idle and absolute timeouts; httpOnly, SameSite=Strict, Secure cookie | SSO/AD federation for staff, device binding, passkeys/FIDO2, NADRA biometric verification for customers, risk-based authentication |
| Authorisation | RBAC permission map; data scoping by tenant, customer, RM book and org subtree; read-only Audit role; Administrator cannot approve credit | ABAC policies, periodic access recertification |
| Segregation of duties | Initiator ≠ approver; one level per person; approver must cover the case's region; personal limits; RM can't clear own customer's KYC; capturer ≠ evidence verifier; payment maker ≠ checker; template author ≠ approver; four-eyes on bank signatures | Configurable SoD matrix, conflict reports |
| Integrity & non-repudiation | SHA-256 of document text, re-verified before every signature; HMAC seal per signature; executed text frozen by trigger; append-only signatures and audit events; per-tenant hash chain with verification | PKI signatures from the bank CA or a licensed CSP (ETO 2002 advanced e-signature), RFC 3161 timestamps, external anchoring of chain heads, WORM storage |
| Confidentiality | AES-256-GCM file encryption with HKDF per-tenant keys; masked CNICs for customer users; `no-store` caching; files streamed only after access checks | HSM/KMS-held master key, key rotation, field-level encryption of PII, DLP and watermarking on downloads |
| Web security | CSP, frame-ancestors none, X-Frame-Options DENY, nosniff, strict referrer, permissions policy; Server Actions origin check; same-origin check on route handlers; all rendered text HTML-escaped | WAF, rate limiting, dependency and container scanning, pen-testing |
| Logging & monitoring | Every login, failure, lockout, view, download, upload, signature, decision and configuration change is recorded with IP, user agent, GPS and before/after values | SIEM forwarding, anomaly rules (unusual approval times, location jumps, bulk downloads) |
| Resilience & residency | Single-node evaluation build | Pakistan-hosted (or bank-approved) infrastructure, PostgreSQL HA, encrypted backups, tested restores, defined RPO/RTO |

## 4. Integrations (interfaces to build per bank)

| System | Use |
|---|---|
| Core banking (T24 / Flexcube / iMAL, etc.) | CIF, accounts, deal booking at activation, repayments, DPD feed for classification |
| e-CIB / licensed credit bureaus | R-7 reports and exposure with other banks (R-5) |
| NADRA (Verisys / biometric) | Identity of signatories and guarantors |
| SECP / FBR | Company and NTN verification (R-14 iii: don't re-collect data available from authorised sources) |
| SMS / e-mail gateway | OTP and notifications |
| Certification authority | PKI signatures, timestamping |
| Trade finance system | LC / import / export documents for Murabaha and Istisna trade flows |
| Valuation partners (PBA panel) | Valuation reports and FSV (Annexure II) |
| SIEM | Security monitoring |

## 5. Database

* **Engine:** MySQL 8 / MariaDB 10.6+. Hostinger's managed MySQL is used in the hosted demo, and MariaDB locally and in tests. Long text (documents, templates, audit before/after values) uses `TEXT` / `MEDIUMTEXT`. Timestamps are stored with millisecond precision, so audit hashes re-verify exactly.
* **Append-only guards:** `scripts/db-guards.mjs` creates triggers that reject UPDATE and DELETE on `AuditEvent` and `Signature`, and any change to an executed document's text or hash. It runs on every server build and is idempotent. If a hosting plan withholds the TRIGGER privilege, the build continues with a warning and the hash chain still detects tampering. In production, also `REVOKE UPDATE, DELETE ON AuditEvent, Signature` from the application user.
* **Concurrency:** each audit append locks the bank's tenant row (`SELECT … FOR UPDATE`) inside the business transaction, so simultaneous users cannot fork the hash chain. A test fires 25 concurrent writes and verifies the chain.
* **Money:** amounts are `DOUBLE` in this build. Move them to `DECIMAL(20,2)` (Prisma `Decimal`) before handling live balances.
* **Isolation:** one schema serves all tenants, with every query scoped by `tenantId`. Use one database per bank if a bank's policy requires physical separation.

## 6. Roadmap

* **Phase 1 (this build):** onboarding, RCAD, hierarchy, all eight modes, offer and acceptance, e-signing, evidence vault, audit trail, MIS.
* **Phase 2:** core-banking, e-CIB, NADRA and SMS integrations; PKI signatures; native mobile capture app with QR/NFC asset tags; supplier/contractor portal; Murabaha tranche drawdowns under a master limit; early settlement, rebates and restructuring workflows; complaint handling with Sunwai status (R-19 iii/iv).
* **Phase 3:** multi-bank onboarding console, configurable product factory and Shariah rule designer, digital supply-chain finance (R-14 b), credit-scoring model integration (R-15), covenant tracking and early-warning signals, regulatory reporting.
