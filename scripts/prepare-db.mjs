// Server build hook (runs before `next build` when PREPARE_DB=1, e.g. on Hostinger):
//   1. creates the evidence folder (outside the deploy directory)
//   2. applies pending database migrations (non-destructive)
//   3. applies the append-only tamper-evidence triggers (idempotent)
//   4. loads demo data only when the database has no tenant yet
// Local builds skip all of this.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

if (process.env.PREPARE_DB !== "1") process.exit(0);

if (process.env.STORAGE_DIR) mkdirSync(path.resolve(process.env.STORAGE_DIR), { recursive: true });

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });
run("npx prisma generate");
run("npx prisma migrate deploy");

const { PrismaClient } = await import("@prisma/client");
const { applyGuards } = await import("./db-guards.mjs");
const db = new PrismaClient();
try {
  console.log(`Tamper-evidence triggers applied: ${(await applyGuards(db)).join(", ")}`);
} catch (e) {
  // Some shared MySQL plans withhold the TRIGGER privilege. The hash-chained
  // audit trail still detects any tampering; report loudly and continue.
  console.warn(`WARNING: could not create tamper-evidence triggers (${e.message}). Hash-chain verification remains active.`);
}
const tenants = await db.tenant.count();
await db.$disconnect();
if (tenants === 0 && process.env.SEED_DEMO === "1") {
  console.log("Empty database — loading demo data");
  run("npx tsx prisma/seed.ts");
} else {
  console.log(`Database has ${tenants} tenant(s) — no seeding`);
}
