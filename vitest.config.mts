import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Tests run against a dedicated MySQL database (default: the DATABASE_URL from
// .env with the database name replaced by `sme_test`). The global setup drops
// and recreates it, and refuses any database whose name does not end in `_test`.
function dotenv(): Record<string, string> {
  if (!existsSync(".env")) return {};
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
}
const env = dotenv();
const testUrl = process.env.TEST_DATABASE_URL ?? env.TEST_DATABASE_URL ?? (env.DATABASE_URL ?? "").replace(/\/[^/?]+(\?|$)/, "/sme_test$1");
process.env.TEST_DATABASE_URL = testUrl;

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    env: {
      DATABASE_URL: testUrl,
      STORAGE_DIR: "./storage-test",
      MASTER_KEY: "test-master-key-0123456789abcdef0123456789abcdef",
    },
  },
});
