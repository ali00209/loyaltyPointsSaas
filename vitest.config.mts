import path from "node:path";
import "dotenv/config";
import { defineConfig } from "vitest/config";

// API tests run against a real, throwaway database: src/test/global-setup.ts
// drops, creates and migrates it before the first test file loads.
const TEST_DB = "loyalty_test";

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: [path.resolve(process.cwd(), "src/test/global-setup.ts")],
    // Every test file shares one database and resets it per test, so files
    // must run one at a time instead of interleaving truncates.
    fileParallelism: false,
    env: {
      POSTGRES_HOST: env("POSTGRES_HOST", "127.0.0.1"),
      POSTGRES_PORT: env("POSTGRES_PORT", "5432"),
      POSTGRES_USER: env("POSTGRES_USER", "loyalty"),
      POSTGRES_PASSWORD: env("POSTGRES_PASSWORD", ""),
      POSTGRES_DB: TEST_DB,
      ...(process.env.JWT_SECRET ? { JWT_SECRET: process.env.JWT_SECRET } : {}),
      ...(process.env.CRON_SECRET ? { CRON_SECRET: process.env.CRON_SECRET } : {}),
    },
  },
});
