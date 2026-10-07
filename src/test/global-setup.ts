import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { databaseUrl } from "../db/databaseUrl";

// Recreate the throwaway test database and replay drizzle's SQL migrations so
// every run starts from an empty, fully migrated schema.
const TEST_DB = "loyalty_test";

function urlFor(dbName: string): string {
  const url = new URL(databaseUrl());
  url.pathname = `/${dbName}`;
  return url.toString();
}

function migrationFiles(): string[] {
  const root = process.cwd();
  const journal = JSON.parse(
    readFileSync(path.resolve(root, "drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ idx: number; tag: string }> };

  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => path.resolve(root, "drizzle", `${entry.tag}.sql`));
}

export default async function globalSetup(): Promise<void> {
  const admin = new Client({ connectionString: urlFor("postgres") });
  await admin.connect();
  try {
    // DROP DATABASE refuses while another connection is open, so evict any
    // leftovers from a previous (possibly crashed) run first.
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [TEST_DB],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await admin.query(`CREATE DATABASE "${TEST_DB}"`);
  } finally {
    await admin.end();
  }

  const db = new Client({ connectionString: urlFor(TEST_DB) });
  await db.connect();
  try {
    for (const file of migrationFiles()) {
      // drizzle separates statements with an explicit breakpoint marker;
      // splitting on ";" would break inside function bodies.
      for (const raw of readFileSync(file, "utf8").split("--> statement-breakpoint")) {
        const statement = raw.trim();
        if (statement) await db.query(statement);
      }
    }
  } finally {
    await db.end();
  }
}
