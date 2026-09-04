import type {
  CheckoutPreview,
  CheckoutResult,
  OwnerCheckoutInput,
  OwnerRefundInput,
  RedemptionCheckoutHistory,
  RedemptionRule,
  RedemptionRuleInput,
} from "@/types";
import { client } from "./client";

export async function fetchRedemptionRules(): Promise<RedemptionRule[]> {
  const { data } = await client.get<{ rules: RedemptionRule[] }>(
    "/redemption-rules",
  );
  return data.rules;
}

export async function createRedemptionRule(input: RedemptionRuleInput) {
  const { data } = await client.post<{ rule: RedemptionRule }>(
    "/redemption-rules",
    input,
  );
  return data.rule;
}

export async function updateRedemptionRule(
  id: string,
  input: Partial<RedemptionRuleInput>,
) {
  const { data } = await client.put<{ rule: RedemptionRule }>(
    "/redemption-rules",
    { id, ...input },
  );
  return data.rule;
}

export async function deleteRedemptionRule(id: string): Promise<void> {
  await client.delete("/redemption-rules", { params: { id } });
}

export async function reserveCheckout(
  input: Record<string, unknown>,
): Promise<CheckoutResult> {
  const { data } = await client.post<CheckoutResult>("/checkout", input);
  return data;
}

export async function fetchRedemptionCheckoutHistory(): Promise<
  RedemptionCheckoutHistory[]
> {
  const { data } = await client.get<{ history: RedemptionCheckoutHistory[] }>(
    "/redemption-checkouts",
  );
  return data.history;
}

export async function previewOwnerCheckout(
  input: OwnerCheckoutInput,
): Promise<CheckoutPreview> {
  const { data } = await client.post<CheckoutPreview>(
    "/checkout/preview",
    input,
  );
  return data;
}

export async function confirmOwnerCheckout(
  input: OwnerCheckoutInput,
): Promise<CheckoutResult> {
  const { data } = await client.post<CheckoutResult>(
    "/checkout/confirm",
    input,
  );
  return data;
}

export async function refundOwnerCheckout(
  input: OwnerRefundInput,
): Promise<CheckoutResult> {
  const { data } = await client.post<CheckoutResult>(
    "/checkout/refund",
    input,
  );
  return data;
}
