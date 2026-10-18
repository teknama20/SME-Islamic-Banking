# SME Islamic Banking Platform

A white-label, multi-tenant platform that takes Shariah-compliant SME financing from the customer's first request to sanction, offer, acceptance, digital signing, asset possession, disbursement, monitoring and closure. Every step leaves a complete, time-stamped, location-stamped and cryptographically verifiable trail.

It is built for Islamic banks and for the Islamic banking windows of conventional banks in Pakistan. Each bank runs as its own branded tenant, with its own hierarchy, approval matrix, templates and encryption keys. The first tenant is **Islamic Bank of Pakistan**.

> **Status:** working MVP / reference implementation. The seeded document templates are structured drafts modelled on the SBP model agreements. Each bank's Shariah Board and Legal department must vet them before production use. The platform enforces this: a template version can only generate documents once both have approved it.

---

## What it does

| Area | Capabilities |
|---|---|
| **Tenancy & white-label** | Separate tenants with their own brand (name, colours, logo, tagline), approval matrix, security policy, templates and HKDF-derived encryption keys. Two demo tenants are included: `IBP` (Islamic bank) and `DCB` (conventional bank, Islamic window). |
| **Hierarchy & roles** | Country → Region → Unit → Team. RM, Team Leader, Unit Head, Regional Head, Country Head, Credit/Risk, RCAD, Trade, Shariah, Legal, Operations, Internal Audit and Administrator. Customer-side roles: authorised signatory, user/accountant and guarantor. Each user sees only their own book or their org subtree. Control functions see the whole bank. |
| **Customer onboarding** | Digital onboarding, owners and UBOs, geo-tagged premises, KYC document vault, RCAD KYC/CDD decision with e-CIB, other-bank exposure and related-party flag. SBP SME classification and start-up flag are applied automatically. |
| **Products** | Murabaha · Tijarah · Istisna (project, with Parallel Istisna) · Istisna (working capital) · Diminishing Musharakah · Ijarah · Salam · Running Musharakah. |
| **Case workflow** | Draft → submission (CPTM number, automatic customer acknowledgement, 15-working-day TAT clock) → RCAD + Credit review (Trade / Legal / pre-sanction Shariah optional per bank) → delegated-authority approval → sanction → **documentation loop** → disbursement → activation → **post-disbursement Shariah review** → repayments, classification and closure. |
| **Documentation loop** | Every document and evidence item of every product follows one loop: **RCAD prepares & vets → RM / Team Leader / Unit Head sign → Customer (or Guarantor) signs → RCAD / RM verifies**. The offer goes to the customer automatically once the bank signs. Shariah ordering (e.g. possession before a Murabaha sale) is enforced by step dependencies. |
| **Digital signing** | Strict signer order, OTP per signature, typed full name, consent, GPS, IP and device. Each signature is sealed to the SHA-256 of the exact document text. Four-eyes rule for bank signatories. Signatures are append-only. |
| **Possession evidence** | In-app photo/video/PDF capture with mandatory GPS where Shariah requires possession, trusted server time and device metadata. Images get a watermarked copy and the original is kept. Files are SHA-256 hashed and AES-256-GCM encrypted. Verification is maker-checker. |
| **Payments** | Disbursements are maker-checker (RCAD prepares, a Team Leader or Unit Head authorises) and capped at the sanctioned amount. |
| **Shariah review** | After disbursement the Shariah Compliance Officer reviews the complete file (sequence, possession evidence, executed documents, pricing) and marks it compliant, or non-compliant with rectification and purification of income to charity. |
| **Audit** | Per-tenant hash-chained audit trail, with database triggers blocking UPDATE and DELETE. Every view, upload, signature and decision is recorded with who, what, when, where (GPS), IP and device. The audit explorer verifies the chain. The **Execution Pack** is printable, and the evidence bundle is a hashed JSON export. |
| **Templates** | Version-controlled model agreements in English, with Urdu (RTL) sections. A new version needs **Shariah** and **Legal** approval, and its author can't approve it. |
| **MIS** | Portfolio by mode, SME category, sector, city, women-led and start-ups; classification; average TAT. |

The full product-by-product transaction workflows and the stakeholder sign-off arrangement are in **[docs/WORKFLOWS.md](docs/WORKFLOWS.md)**. That file is generated from the same catalogue the engine enforces, and the same material is in the app under *Products & workflows*. Architecture and security controls are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## SBP SME Prudential Regulations (updated 16 July 2026) — what is enforced

| Regulation | Implementation |
|---|---|
| Part-I definitions | Micro ≤ PKR 30m, Small ≤ 400m, Medium ≤ 2,000m turnover; start-up if 5 years old or less. Above 2,000m blocks as "not SME". |
| R-5 per-party limit | Aggregate exposure across this bank and other banks (from e-CIB), plus the request, less liquid assets under lien, must stay within PKR 100m (micro/small) or 500m (medium). Otherwise submission is blocked. |
| R-6 standard application | Single digital application form per product. |
| R-7 credit information | RCAD must obtain e-CIB before KYC clearance. Overdues require a documented justification on the case. |
| R-9 clean facility | Clean exposure is capped at PKR 50m, and clean facilities above a configurable amount escalate approval. |
| R-11 related parties | Exposure is blocked when the customer is flagged as related. |
| R-12 disclosure | Key Fact Statement is generated in English **and Urdu** and must be signed with the offer. |
| R-13 security | Secured facilities need security details, charge documents and Legal's perfection step before any disbursement. |
| R-14 digitalisation | End-to-end digital onboarding, geo-tagging, e-agreements and digital documents. |
| R-16 TAT | 15 working days (weekends and holidays excluded) tracked per case. Breaches are flagged on dashboards. |
| R-17 + Annexure I/II | Days-past-due drive Substandard, Doubtful and Loss classification. Provisioning uses the forced-sale-value benefit schedule (property 75/60/45/30/20%, plant & machinery 30/20/10%, pledged stock 40%), or ECL if higher. |
| R-18 restructuring | Declassification rule: 10% cash recovery plus 6 months' performance, or 35% cash. |
| R-19 CPTM & MIS | Unique CPTM serial and automatic acknowledgement and status updates to the applicant. Portfolio MIS. |

## Quick start

Requirements: Node.js 20.9+ and MySQL 8 / MariaDB 10.6+ (on macOS: `brew install mariadb && brew services start mariadb`).

```bash
# one-time: databases and an app user (test database name must end with _test)
mariadb -u root -e "CREATE DATABASE sme_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE DATABASE sme_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'sme'@'127.0.0.1' IDENTIFIED BY 'choose-a-password';
  GRANT ALL ON \`sme\\_%\`.* TO 'sme'@'127.0.0.1';
  GRANT ALL ON \`prisma\\_migrate\\_shadow\\_db\\_%\`.* TO 'sme'@'127.0.0.1';"

cp .env.example .env    # set DATABASE_URL (that user/password) and a long random MASTER_KEY
npm run setup           # install, migrate, apply append-only triggers, load demo data
npm run dev             # http://localhost:3000
```

Sign in with bank code **IBP**, any demo user below, and password **`Bank@12345`**. The OTP is shown on screen (the bank has no SMS gateway yet; `otpDelivery: "screen"`). Switch it to SMS under *Administration* once a gateway is connected.

| Username | Role | | Username | Role |
|---|---|---|---|---|
| `rm.ali`, `rm.sara` | Relationship Manager | | `rcad.officer` | RCAD (documentation loop, disbursement maker) |
| `tl.gulberg` | Team Leader | | `credit.officer` | Credit / Risk |
| `uh.gulberg` | Unit Head | | `trade.officer` | Trade |
| `rh.north` / `rh.south` | Regional Heads | | `shariah.officer` | Shariah Compliance |
| `ch.ahmed` | Country Head | | `legal.officer` | Legal |
| `ops.officer` | Operations (optional) | | `auditor` | Internal Audit (read-only) |
| `noor.ceo` | Customer signatory (Al-Noor Textiles) | | `admin` | Platform administrator |
| `noor.guarantor` | Guarantor | | `barakah.partner` | Customer signatory (Barakah Agro) |

The seed leaves cases in different states so you can see each part of the lifecycle:

- **SME-2026-00001**: Murabaha, active and fully executed, with one instalment paid. The post-disbursement Shariah review is waiting for `shariah.officer`.
- **SME-2026-00002**: Diminishing Musharakah, in the documentation loop. Follow the action centre: RCAD → RM / TL / UH → `noor.ceo` → RCAD.
- **SME-2026-00003**: Murabaha, under review. RCAD has cleared and Credit is pending.
- **SME-2026-00004**: Istisna, still a draft. RCAD must clear the customer's KYC first.

## Hosted demo (Hostinger)

The app runs on Hostinger Node.js hosting with Hostinger's managed MySQL. Each build runs `scripts/prepare-db.mjs` (when `PREPARE_DB=1`), which applies migrations and the append-only triggers, and loads demo data only into an empty database (`SEED_DEMO=1`). Environment variables on the server: `DATABASE_URL` (`mysql://…@127.0.0.1:3306/…`), `STORAGE_DIR` (outside `public_html`), `MASTER_KEY`, `DEMO_PASSWORD`, `PREPARE_DB`, `SEED_DEMO`. Production builds use webpack (`next build --webpack`) because Hostinger's build servers don't allow Turbopack's CSS worker process.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development, production build and serve |
| `npm test` | 44 tests (against the `sme_test` database): SBP rules, pricing, templates, **all 8 products end to end**, and negative tests for every control (limits, Shariah preconditions, maker-checker, signer order, OTP, GPS, tamper detection) |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm run setup` | Install, migrate, apply append-only triggers, load demo data |
| `npm run db:migrate` / `db:guards` / `db:seed` | Create a migration / re-apply append-only triggers / load demo data |
| `npm run docs:workflows` | Regenerate `docs/WORKFLOWS.md` from the product catalogue |

## Tech stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Prisma 6 with MySQL / MariaDB, Zod and Vitest. No third-party services are required to run it.

## Project layout

```
prisma/                 schema, migrations, seed
scripts/                db-guards.mjs (append-only triggers), prepare-db.mjs (server build hook), workflow doc generator
src/lib/
  sbp.ts                SBP SME Prudential Regulations rules
  products/             product catalogue: data, Shariah preconditions, documents, signers, execution plans
  engine/               case lifecycle, documents & signing, execution & evidence, customers
  audit.ts              hash-chained audit trail + verification
  crypto.ts storage.ts  passwords, OTP, seals, per-tenant AES-256-GCM vault
  templates/library.ts  bilingual model-agreement templates
  pricing.ts            cost-plus, rental, Diminishing Musharakah unit and profit-share schedules
src/app/                pages (dashboard, customers, cases, documents, products, audit, portfolio, admin) and API routes
docs/                   WORKFLOWS.md (generated), ARCHITECTURE.md
tests/                  Vitest suites
```
