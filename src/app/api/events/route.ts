import { db } from "@/db";
import { customers } from "@/db/schema";
import { resolveEventPrincipal } from "@/lib/api-guard";
import { applyEvent, PointsError } from "@/lib/points";
import {
  canPost,
  EVENT_CATALOG,
  validateEventPayload,
  type EventType,
} from "@/lib/rules";
import { CreateEventSchema, parseBody } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const principal = await resolveEventPrincipal();
  if ("error" in principal) return principal.error;
  const { tenantId, kind, customerId: sessionCustomerId } = principal.principal;

  const parsed = await parseBody(req, CreateEventSchema);
  if (parsed.error) return parsed.error;
  const {
    eventType,
    payload,
    eventKey,
    customerId: bodyCustomerId,
    customerEmail,
  } = parsed.data;

  const eventTypeKey = eventType as EventType;
  const entry = EVENT_CATALOG[eventTypeKey];
  if (!entry) {
    return NextResponse.json(
      { error: `Unknown event type "${eventType}"` },
      { status: 400 },
    );
  }

  if (!canPost(eventTypeKey, kind)) {
    return NextResponse.json(
      { error: `Event type "${eventType}" cannot be posted by this principal` },
      { status: 403 },
    );
  }

  try {
    validateEventPayload(eventTypeKey, payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }

  let targetCustomerId = sessionCustomerId ?? "";
  if (kind === "owner" || kind === "apiKey") {
    targetCustomerId = bodyCustomerId ?? "";
    if (typeof customerEmail === "string" && customerEmail) {
      const [byEmail] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.email, customerEmail),
          ),
        )
        .limit(1);
      if (byEmail) targetCustomerId = byEmail.id;
    }
    if (!targetCustomerId) {
      return NextResponse.json(
        { error: "customerId or customerEmail is required" },
        { status: 400 },
      );
    }
  }

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(eq(customers.id, targetCustomerId), eq(customers.tenantId, tenantId)),
    )
    .limit(1);

  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found in this program" },
      { status: 404 },
    );
  }

  try {
    const result = await applyEvent({
      tenantId,
      customerId: customer.id,
      eventType: eventTypeKey,
      payload,
      eventKey,
    });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof PointsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Event error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
