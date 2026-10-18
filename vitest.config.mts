import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: "file:./test.db",
      STORAGE_DIR: "./storage-test",
      MASTER_KEY: "test-master-key-0123456789abcdef0123456789abcdef",
    },
  },
});
