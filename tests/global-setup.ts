// Creates a throw-away SQLite database for the test run (never touches dev.db).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

export default function setup() {
  const root = path.resolve(__dirname, "..");
  rmSync(path.join(root, "prisma", "test.db"), { force: true });
  rmSync(path.join(root, "storage-test"), { recursive: true, force: true });
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "ignore", env: { ...process.env, DATABASE_URL: "file:./test.db" } });
}
