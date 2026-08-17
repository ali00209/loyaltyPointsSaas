import { NextResponse } from "next/server";
import { z } from "zod";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const email = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address");
const password = z
  .string()
  .min(1, "Password is required")
  .min(6, "Password must be at least 6 characters");
const name = z.string().min(1, "Name is required").max(200);
const slug = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");
const uuid = z.string().uuid("Invalid ID format");

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const RegisterSchema = z.object({
  email,
  password,
  name,
  businessName: z.string().max(200).optional(),
});

// ─── Customer ────────────────────────────────────────────────────────────────

export const CustomerLoginSchema = z.object({
  slug: z.string().min(1, "Program slug is required"),
  email,
  password: z.string().min(1, "Password is required"),
});

export const CustomerSignupSchema = z.object({
  slug: z.string().min(1, "Program slug is required"),
  name,
  email,
  password,
  ref: z.string().max(50).optional(),
});

export const ReviewSchema = z.object({
  purchaseId: uuid,
  productId: uuid,
  rating: z.coerce
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  text: z.string().max(2000).optional(),
});

// ─── Owner: Customers ────────────────────────────────────────────────────────

export const CreateCustomerSchema = z.object({
  name,
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});

export const UpdateCustomerSchema = z.object({
  id: uuid,
  name: name.optional(),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});

// ─── Owner: Products ─────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name,
  sku: z.string().min(1, "SKU is required").max(100),
  price: z.coerce.number().positive("Price must be greater than 0"),
  category: z.string().max(100).optional(),
});

export const UpdateProductSchema = z.object({
  id: uuid,
  name: name.optional(),
  sku: z.string().min(1).max(100).optional(),
  price: z.coerce.number().positive("Price must be greater than 0").optional(),
  category: z.string().max(100).optional(),
  active: z.boolean().optional(),
});

// ─── Owner: Rewards ──────────────────────────────────────────────────────────

const RewardType = z.enum(
  ["discount", "gift_card", "physical_item", "store_credit"],
  {
    error:
      "Invalid reward type. Must be discount, gift_card, physical_item, or store_credit",
  },
);

export const CreateRewardSchema = z.object({
  name,
  pointsCost: z.coerce
    .number()
    .int()
    .positive("Points cost must be greater than 0"),
  rewardType: RewardType,
  inventoryLimit: z.coerce.number().int().nonnegative().nullable().optional(),
  description: z.string().max(500).optional(),
});

export const UpdateRewardSchema = z.object({
  id: uuid,
  name: name.optional(),
  pointsCost: z.coerce
    .number()
    .int()
    .positive("Points cost must be greater than 0")
    .optional(),
  rewardType: RewardType.optional(),
  inventoryLimit: z.coerce.number().int().nonnegative().nullable().optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
});

// ─── Owner: Rules ────────────────────────────────────────────────────────────

const RuleGroupSchema: z.ZodType = z.lazy(() =>
  z.object({
    combinator: z.enum(["and", "or"]),
    rules: z.array(
      z.union([
        z.object({
          field: z.string(),
          operator: z.string(),
          value: z.any(),
        }),
        RuleGroupSchema,
      ]),
    ),
  }),
);

const StructuredFormulaSchema = z.object({
  type: z.enum(["rate", "flat"]).optional(),
  basis: z.string().optional(),
  rate: z.coerce.number().positive("Rate must be greater than 0").optional(),
  flatAmount: z.coerce
    .number()
    .int()
    .nonnegative("Flat amount must be 0 or more")
    .optional(),
  rounding: z.enum(["floor", "ceil", "round"]).optional(),
  minPoints: z.coerce.number().int().nonnegative().nullable().optional(),
  maxPoints: z.coerce.number().int().positive().nullable().optional(),
});

export const CreateRuleSchema = z.object({
  name,
  description: z.string().max(500).optional(),
  eventType: z.string().min(1, "Event type is required"),
  perItem: z.boolean().optional(),
  conditions: RuleGroupSchema.optional(),
  structured: StructuredFormulaSchema.optional(),
  pointsExpireAfterDays: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  active: z.boolean().optional(),
  activeFrom: z.string().optional(),
  activeUntil: z.string().optional(),
});

export const ToggleRuleSchema = z.object({
  id: uuid,
  active: z.boolean({ error: "active is required" }),
});

export const UpdateRuleSchema = z.object({
  name: name.optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
  pointsExpireAfterDays: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  activeFrom: z.string().optional(),
  activeUntil: z.string().optional(),
  eventType: z.string().min(1).optional(),
  perItem: z.boolean().optional(),
  conditions: RuleGroupSchema.optional(),
  structured: StructuredFormulaSchema.optional(),
});

// ─── Events ──────────────────────────────────────────────────────────────────

export const CreateEventSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  payload: z.record(z.string(), z.unknown()).default({}),
  eventKey: z.string().max(200).nullable().optional(),
  customerId: z.string().optional(),
  customerEmail: z.email().optional(),
});

// ─── Transactions ────────────────────────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  customerId: uuid,
  transactionType: z.enum(["redeem", "adjust"], {
    error: "Invalid transaction type. Must be redeem or adjust",
  }),
  rewardId: uuid.optional(),
  points: z.coerce.number().int().optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── Admin: Tenants ──────────────────────────────────────────────────────────

export const CreateTenantSchema = z.object({
  name,
  ownerName: name,
  ownerEmail: email,
  ownerPassword: password,
  brandingConfig: z.record(z.string(), z.unknown()).optional(),
  slug: slug.optional(),
});

export const UpdateTenantSchema = z.object({
  name: name.optional(),
  brandingConfig: z.record(z.string(), z.unknown()).optional(),
  suspended: z.boolean().optional(),
});

// ─── Settings ────────────────────────────────────────────────────────────────

export const CreateApiKeySchema = z.object({
  name: z.string().max(200).optional(),
});

// ─── Parse helper ────────────────────────────────────────────────────────────

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
