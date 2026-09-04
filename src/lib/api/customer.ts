import type {
  PortalCustomer,
  PortalLoginResult,
  PortalOverview,
  PortalPurchase,
  PortalReviewInput,
  PortalReviewResult,
  PortalSignupResult,
  PortalTenantInfo,
} from "@/types";
import { client } from "./client";

export async function fetchPortalTenant(
  slug: string,
): Promise<PortalTenantInfo> {
  const { data } = await client.get<{ tenant: PortalTenantInfo }>(
    `/public/tenants/${slug}`,
  );
  return data.tenant;
}

export async function fetchPortalCustomer(): Promise<PortalCustomer> {
  const { data } = await client.get<{ customer: PortalCustomer }>(
    "/customer/me",
  );
  return data.customer;
}

export async function portalLogin(input: {
  email?: string;
  phone?: string;
  password: string;
  apiKey?: string;
}): Promise<PortalLoginResult> {
  const { apiKey, ...body } = input;
  const { data } = await client.post<PortalLoginResult>(
    "/customer/login",
    body,
    apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined,
  );
  return data;
}

export async function portalSignup(input: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  ref?: string;
  apiKey?: string;
}): Promise<PortalSignupResult> {
  const { apiKey, ...body } = input;
  const { data } = await client.post<PortalSignupResult>(
    "/customer/signup",
    body,
    apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined,
  );
  return data;
}

export async function portalLogout(): Promise<void> {
  await client.post("/customer/logout");
}

export async function fetchPortalOverview(): Promise<PortalOverview> {
  const { data } = await client.get<PortalOverview>("/customer/overview");
  return data;
}

export async function fetchPortalPurchases(): Promise<PortalPurchase[]> {
  const { data } = await client.get<{ purchases: PortalPurchase[] }>(
    "/customer/purchases",
  );
  return data.purchases;
}

export async function postPortalReview(
  input: PortalReviewInput,
): Promise<PortalReviewResult> {
  const { data } = await client.post<PortalReviewResult>(
    "/customer/reviews",
    input,
  );
  return data;
}

export async function postPortalEvent(input: {
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<{ totalAwarded: number }> {
  const { data } = await client.post<{ totalAwarded: number }>(
    "/events",
    input,
  );
  return data;
}
