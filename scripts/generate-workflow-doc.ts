// Generates docs/WORKFLOWS.md from the product catalogue so the written
// specification can never drift from what the workflow engine enforces.
//   npm run docs:workflows
import { writeFileSync } from "node:fs";
import path from "node:path";
import { EVIDENCE_LABELS, TRACK_CHECKLISTS, TRACK_LABELS } from "../src/lib/constants";
import { COMMON_DOCS, PRODUCTS, buildExecutionPlan } from "../src/lib/products/catalog";
import type { DocSpec, StepSpec } from "../src/lib/products/types";
import { SHARIAH_REVIEW_CHECKLIST } from "../src/lib/engine/execution";
import { TRACK_ROLE, roleLabel, type Track } from "../src/lib/rbac";
import { DEFAULT_SETTINGS } from "../src/lib/tenant";

const L: string[] = [];
const out = (s = "") => L.push(s);
const signers = (d: DocSpec) => d.signers.map((s, i) => `${i + 1}. ${s.capacity}${s.roles ? ` (${s.roles.map(roleLabel).join(" / ")})` : ""}`).join("<br>");

function who(s: StepSpec, docs: DocSpec[]) {
  if (s.kind === "SIGN") return signers(docs.find((d) => d.code === s.docCode)!);
  if (s.kind === "EVIDENCE") return `Capture: ${s.evidence!.capturers.map(roleLabel).join(", ")}<br>Verify: ${s.evidence!.verifiers.map(roleLabel).join(", ")}`;
  if (s.kind === "ACTION") return s.action!.effect === "DISBURSE" ? `Maker: ${s.action!.roles.map(roleLabel).join(", ")}<br>Checker: Team Leader / Unit Head` : s.action!.roles.map(roleLabel).join(", ");
  return s.check!.roles.map(roleLabel).join(", ");
}

function controls(s: StepSpec) {
  if (s.kind === "SIGN") return "Loop: RCAD prepares → bank → customer → RCAD/RM verifies; OTP + typed name + consent + GPS; seal bound to SHA-256 of text";
  if (s.kind === "EVIDENCE") return `${s.evidence!.categories.map((c) => EVIDENCE_LABELS[c]).join(" / ")}; min ${s.evidence!.minItems}; ${s.evidence!.requireGps ? "GPS mandatory; " : ""}capturer ≠ verifier. Checks: ${s.evidence!.checklist.join("; ")}`;
  if (s.kind === "ACTION") return s.action!.effect === "DISBURSE" ? "Maker-checker; cumulative payments ≤ sanctioned amount" : s.action!.effect === "ACTIVATE" ? "All other steps complete; schedule fixed" : s.action!.fields.map((f) => f.label).join(", ");
  return s.check!.checklist.join("; ");
}

out("# Transaction Workflows & Digital Sign-off");
out();
out("> Generated from `src/lib/products/catalog.ts` by `npm run docs:workflows`. The workflow engine enforces exactly what is written here.");
out();
out("## 1. Common lifecycle (all products)");
out();
out("The documentation of every transaction runs in one simple loop:");
out();
out("> **RCAD prepares & vets → RM / Team Leader / Unit Head sign → Customer (or Guarantor) signs → RCAD / RM verifies** — repeated for each document and each evidence item the product requires. **Shariah reviews the complete file at the end, after disbursement.**");
out();
out("| # | Stage | What happens | Who acts / signs off | Controls |");
out("|---|---|---|---|---|");
out("| 1 | Onboarding | SME profile, owners/UBOs, geo-tagged premises, KYC documents | RM creates · Customer uploads · **RCAD clears KYC/CDD** | SBP SME classification (Part-I); e-CIB (R-7); related-party flag (R-11); RM cannot clear own customer |");
out("| 2 | Request | Product, purpose, amount, tenor, pricing, security, product structure | **RM** | Product terms; Shariah preconditions checked automatically; R-5, R-9, R-13; prohibited sectors |");
out("| 3 | Submission | CPTM serial issued; customer auto-acknowledged; TAT clock starts | RM | R-19 CPTM; R-16 15 working-day TAT |");
out(`| 4 | Review | ${["RCAD", ...DEFAULT_SETTINGS.reviewTracks].map((t) => TRACK_LABELS[t as Track]).join("; ")} (Trade / Legal / pre-sanction Shariah can be enabled per bank) | ${["RCAD", ...DEFAULT_SETTINGS.reviewTracks].map((t) => roleLabel(TRACK_ROLE[t as Track])).join(" · ")} | Every checklist item confirmed; any reviewer can return to RM |`);
out(`| 5 | Approval | Delegated authority by amount | ${DEFAULT_SETTINGS.approvalMatrix.map((l, i) => `${roleLabel(l.role)}${i === 0 ? " (recommends)" : ` ≤ PKR ${(l.limit! / 1e6).toFixed(0)}m`}`).join(" → ")} | Initiator cannot approve; one level per person; regional scope; personal limits |`);
out("| 6 | Offer (loop) | Offer Letter + Key Fact Statement (English/Urdu) | **RCAD** prepares → **RM / TL / UH** signs → offer reaches the customer automatically → **Customer** accepts → **RCAD / RM** verifies | Approved templates only; R-12 bilingual disclosure |");
out("| 7 | Documentation (loop) | Product agreements in Shariah order (table per product below) | RCAD → RM / TL / UH → Customer / Guarantor → RCAD / RM | OTP, typed name, consent, GPS; seal bound to document hash; four eyes on bank signatures |");
out("| 8 | Evidence (loop) | Purchase / possession / delivery / title / Takaful evidence | **Customer / RM** capture → **RCAD / RM** verify (never the capturer) | GPS mandatory where possession matters; hashed, encrypted, watermarked |");
out("| 9 | Disbursement | Payment to supplier / vendor / contractor | **RCAD** prepares (maker) → **Team Leader / Unit Head** authorises (checker) | Cumulative payments ≤ sanctioned amount; waits for security perfection |");
out("| 10 | Activation & monitoring | Facility booked; schedule fixed; repayments, DPD, classification | **RCAD** | R-17 / Annexure I & II; R-18 |");
out("| 11 | **Shariah review (final)** | Complete file reviewed after disbursement | **Shariah Compliance Officer** | Compliant, or non-compliant → rectification and purification of income to charity |");
out("| — | Audit | Read-only case files, chain verification, execution pack, evidence bundle | **Internal Audit** | Hash-chained, append-only audit trail |");
out();
out("### Clearance checklists");
for (const t of Object.keys(TRACK_CHECKLISTS) as Track[]) {
  out();
  out(`**${TRACK_LABELS[t]}** (${roleLabel(TRACK_ROLE[t])})`);
  for (const c of TRACK_CHECKLISTS[t]) out(`- ${c}`);
}
out();
out("### Common documents");
out();
out("| Document | Signing order |");
out("|---|---|");
for (const d of COMMON_DOCS) out(`| ${d.title} | ${signers(d)} |`);
out();
out("Personal Guarantee is added when a guarantor is named; charge documents and the *Perfect security* step (RCAD) are added for secured facilities. All disbursement steps wait for security perfection.");

let n = 2;
for (const p of PRODUCTS) {
  const sample = { amount: 10_000_000, tenorMonths: 24, profitRate: 15, repayment: p.repaymentOptions[0], securityType: "SECURED", structure: { guarantorName: "Guarantor", milestones: "2", purchaseMode: "CUSTOMER_AGENT" } };
  const plan = buildExecutionPlan(p, sample);
  const docs = [...COMMON_DOCS, ...p.documents];
  out();
  out(`## ${n++}. ${p.name} (${p.nameUrdu})`);
  out();
  out(p.summary);
  out();
  out(`**Family:** ${p.family} · **Use cases:** ${p.useCases.join(", ")} · **Repayment:** ${p.repaymentOptions.join(", ")} · **Max tenor:** ${p.maxTenorMonths} months · **Trade clearance:** ${p.requiresTrade ? "yes" : "no"}`);
  out();
  out(`**Standards:** ${[...p.aaoifi, ...p.sbp].join("; ")}`);
  out();
  out("**Shariah rules enforced**");
  for (const r of p.shariahRules) out(`- ${r}`);
  out();
  out("**Product documents**");
  out();
  out("| Document | Signing order |");
  out("|---|---|");
  for (const d of p.documents) out(`| ${d.title}${d.offPlatformCounterparty ? ` (+ ${d.offPlatformCounterparty} off-platform)` : ""} | ${signers(d)} |`);
  out();
  out("**Execution sequence** (secured, with guarantor)");
  out();
  out("| # | Step | Type | Who | Controls | Unlocks after |");
  out("|---|---|---|---|---|---|");
  [...plan].forEach((s, i) => out(`| ${i + 1} | ${s.title}${s.note ? `<br><sub>${s.note}</sub>` : ""} | ${s.kind} | ${who(s, docs)} | ${controls(s)} | ${s.dependsOn.map((d) => plan.find((x) => x.key === d)?.title ?? d).join("; ") || "offer acceptance"} |`));
  out(`| ${plan.length + 1} | **Post-disbursement Shariah review** | CHECK | ${roleLabel("SHARIAH")} | ${SHARIAH_REVIEW_CHECKLIST.join("; ")} | Book facility in core banking & activate schedule |`);
}

out();
out(`## ${n}. Digital signature & evidence arrangement`);
out();
out("- **Authentication:** username + password (scrypt) + OTP at login; idle timeout and absolute session lifetime; lockout after repeated failures.");
out("- **Signing:** per-slot OTP bound to (user, document); signer types their registered full name and consents; server re-hashes the stored text and refuses if it differs from the recorded SHA-256; signature row stores signer, capacity, role, IP, user agent, GPS + accuracy and trusted server time; an HMAC seal binds (document, hash, slot, signer, party, decision, time).");
out("- **Order & eligibility:** slots are signed strictly in sequence; customer slots only by the customer's authorised signatory; guarantor slots only by the guarantor; bank slots only by the listed roles within the case's region, never by the case RM, and never twice by the same officer.");
out("- **Immutability:** signatures and audit events are append-only (database triggers); executed document text and hashes cannot be updated.");
out("- **Evidence:** photos, videos and PDFs captured in-app with GPS, trusted server time, device time, device/network details and IP; images receive a watermarked copy (case, category, asset, time, GPS, user) while the original is preserved; files are SHA-256 hashed and AES-256-GCM encrypted per tenant; every view or download is audited; the capturer can never verify their own evidence.");
out("- **Exports:** printable Execution Pack (documents + signature certificates + evidence register + audit trail) and a hashed JSON evidence bundle with document-integrity and chain verification results.");
out("- **Production upgrade path:** replace the HMAC seal with PKI signatures from the bank's CA or a licensed certification service provider (advanced electronic signature under ETO 2002), add RFC 3161 time-stamping, NADRA biometric / e-Sahulat verification and WORM object storage.");

writeFileSync(path.join(__dirname, "..", "docs", "WORKFLOWS.md"), L.join("\n") + "\n");
console.log(`docs/WORKFLOWS.md written (${L.length} lines)`);
