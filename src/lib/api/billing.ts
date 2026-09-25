import { client } from "./client";
import type {
  Invoice,
  InvoiceInput,
  Payment,
  PaymentInput,
  Plan,
  PlanInput,
  Subscription,
  SubscriptionInput,
} from "@/types";

export async function fetchBillingPlans(): Promise<Plan[]> {
  const { data } = await client.get<{ plans: Plan[] }>("/billing/plans");
  return data.plans;
}

export async function fetchSubscription(): Promise<Subscription | null> {
  const { data } = await client.get<{ subscription: Subscription | null }>(
    "/billing/subscription",
  );
  return data.subscription;
}

export async function requestSubscription(
  input: SubscriptionInput,
): Promise<Subscription> {
  const { data } = await client.post<{ subscription: Subscription }>(
    "/billing/subscription",
    input,
  );
  return data.subscription;
}

export async function fetchBillingInvoices(): Promise<Invoice[]> {
  const { data } = await client.get<{ invoices: Invoice[] }>("/billing/invoices");
  return data.invoices;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function fetchAdminPlans(): Promise<Plan[]> {
  const { data } = await client.get<{ plans: Plan[] }>("/admin/plans");
  return data.plans;
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  const { data } = await client.post<{ plan: Plan }>("/admin/plans", input);
  return data.plan;
}

export async function updatePlan(id: string, input: PlanInput): Promise<Plan> {
  const { data } = await client.put<{ plan: Plan }>(`/admin/plans/${id}`, input);
  return data.plan;
}

export async function deletePlan(id: string): Promise<void> {
  await client.delete(`/admin/plans/${id}`);
}

export async function fetchAdminSubscriptions(): Promise<Subscription[]> {
  const { data } = await client.get<{ subscriptions: Subscription[] }>(
    "/admin/subscriptions",
  );
  return data.subscriptions;
}

export async function applySubscriptionAction(
  id: string,
  action: "approve" | "cancel",
): Promise<void> {
  await client.post(`/admin/subscriptions/${id}`, { action });
}

export async function fetchAdminInvoices(): Promise<Invoice[]> {
  const { data } = await client.get<{ invoices: Invoice[] }>("/admin/invoices");
  return data.invoices;
}

export async function fetchAdminInvoice(id: string): Promise<Invoice> {
  const { data } = await client.get<{ invoice: Invoice }>(`/admin/invoices/${id}`);
  return data.invoice;
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const { data } = await client.post<{ invoice: Invoice }>("/admin/invoices", input);
  return data.invoice;
}

export async function updateInvoiceDraft(
  id: string,
  input: InvoiceInput,
): Promise<Invoice> {
  const { data } = await client.put<{ invoice: Invoice }>(
    `/admin/invoices/${id}`,
    input,
  );
  return data.invoice;
}

export async function issueInvoice(id: string): Promise<void> {
  await client.post(`/admin/invoices/${id}/issue`);
}

export async function voidInvoice(id: string): Promise<void> {
  await client.post(`/admin/invoices/${id}/void`);
}

export async function recordPayment(
  invoiceId: string,
  input: PaymentInput,
): Promise<Payment> {
  const { data } = await client.post<{ payment: Payment }>(
    `/admin/invoices/${invoiceId}/payments`,
    input,
  );
  return data.payment;
}

export async function fetchInvoicePayments(invoiceId: string): Promise<Payment[]> {
  const { data } = await client.get<{ payments: Payment[] }>(
    `/admin/invoices/${invoiceId}/payments`,
  );
  return data.payments;
}