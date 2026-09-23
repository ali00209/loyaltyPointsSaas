import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { databaseUrl } from "./src/db/databaseUrl";

config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl(),
  },
});
