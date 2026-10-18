// Server build hook (runs before `next build` when PREPARE_DB=1, e.g. on Hostinger):
//   1. creates the data and evidence folders (outside the deploy directory)
//   2. applies pending database migrations (non-destructive)
//   3. loads demo data only when the database has no tenant yet
// Local builds skip all of this.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

if (process.env.PREPARE_DB !== "1") process.exit(0);

const url = process.env.DATABASE_URL ?? "";
if (url.startsWith("file:")) {
  const file = url.slice(5);
  if (path.isAbsolute(file)) mkdirSync(path.dirname(file), { recursive: true });
}
if (process.env.STORAGE_DIR) mkdirSync(path.resolve(process.env.STORAGE_DIR), { recursive: true });

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });
run("npx prisma generate");
run("npx prisma migrate deploy");

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const tenants = await db.tenant.count();
await db.$disconnect();
if (tenants === 0 && process.env.SEED_DEMO === "1") {
  console.log("Empty database — loading demo data");
  run("npx tsx prisma/seed.ts");
} else {
  console.log(`Database has ${tenants} tenant(s) — no seeding`);
}
