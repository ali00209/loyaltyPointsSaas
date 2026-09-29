import { NextResponse } from "next/server";
import { z } from "zod";

type ZodSchema = z.ZodType<unknown>;

export async function parseBody<T extends ZodSchema>(
  req: Request,
  schema: T,
): Promise<
  { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return {
      error: NextResponse.json(
        { error: "Validation failed", details: issues },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
