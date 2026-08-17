import { client } from "./client";
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

export async function fetchPortalTenant(slug: string): Promise<PortalTenantInfo> {
  const { data } = await client.get<{ tenant: PortalTenantInfo }>(
    `/public/tenants/${slug}`,
  );
  return data.tenant;
}

export async function fetchPortalCustomer(): Promise<PortalCustomer> {
  const { data } = await client.get<{ customer: PortalCustomer }>("/customer/me");
  return data.customer;
}

export async function portalLogin(input: {
  slug: string;
  email: string;
  password: string;
}): Promise<PortalLoginResult> {
  const { data } = await client.post<PortalLoginResult>("/customer/login", input);
  return data;
}

export async function portalSignup(input: {
  slug: string;
  name: string;
  email: string;
  password: string;
  ref?: string;
}): Promise<PortalSignupResult> {
  const { data } = await client.post<PortalSignupResult>("/customer/signup", input);
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
  const { data } = await client.post<PortalReviewResult>("/customer/reviews", input);
  return data;
}

export async function postPortalEvent(input: {
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<{ totalAwarded: number }> {
  const { data } = await client.post<{ totalAwarded: number }>("/events", input);
  return data;
}
