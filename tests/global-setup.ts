// Recreates the dedicated test database (never dev or production data).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { applyGuards } from "../scripts/db-guards.mjs";

export default async function setup() {
  const root = path.resolve(__dirname, "..");
  const url = process.env.TEST_DATABASE_URL ?? "";
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!name.endsWith("_test")) throw new Error(`Refusing to reset database "${name}": test databases must end with _test`);

  const admin = new PrismaClient({ datasourceUrl: url });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${name}\``);
  await admin.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.$disconnect();

  rmSync(path.join(root, "storage-test"), { recursive: true, force: true });
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "ignore", env: { ...process.env, DATABASE_URL: url } });
  const db = new PrismaClient({ datasourceUrl: url });
  await applyGuards(db);
  await db.$disconnect();
}
