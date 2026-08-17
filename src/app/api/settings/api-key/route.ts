import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { generateApiKey, hashApiKey } from "@/lib/auth";
import { CreateApiKeySchema, parseBody } from "@/lib/validations";
import { and, desc, eq, ne } from "drizzle-orm";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const [key] = await db
    .select({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))
    .orderBy(desc(apiKeys.createdAt))
    .limit(1);

  return NextResponse.json({
    apiKey: key
      ? {
          id: key.id,
          name: key.name,
          configured: true,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        }
      : { configured: false },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, CreateApiKeySchema);
  if (parsed.error) return parsed.error;
  const { name } = parsed.data;

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);

  const [key] = await db
    .insert(apiKeys)
    .values({ tenantId, name: name ?? "Default", keyHash })
    .returning({ id: apiKeys.id });

  await db.delete(apiKeys).where(and(eq(apiKeys.tenantId, tenantId), ne(apiKeys.id, key.id)));

  return NextResponse.json({
    apiKey: {
      id: key.id,
      name: name ?? "Default",
      configured: true,
      key: rawKey,
      note: "Store this key now. It is hashed and cannot be shown again.",
    },
  });
}
