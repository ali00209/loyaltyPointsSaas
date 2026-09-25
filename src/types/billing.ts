export type BillingCycle = "weekly" | "monthly";
export type SubscriptionStatus = "pending" | "active" | "canceled";
export type InvoiceBaseStatus = "draft" | "issued" | "voided";
export type InvoiceEffectiveStatus =
  | "draft"
  | "issued"
  | "overdue"
  | "partially_paid"
  | "paid"
  | "voided";

export interface Plan extends Record<string, unknown> {
  id: string;
  name: string;
  price: string;
  billingCycle: BillingCycle;
  taxPercent: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanInput {
  name: string;
  price: number;
  billingCycle?: BillingCycle;
  taxPercent?: number;
  active?: boolean;
}

export interface Subscription extends Record<string, unknown> {
  id: string;
  tenantId: string;
  tenantName?: string;
  planId: string;
  planName: string;
  planPrice: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  nextBillingAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInput {
  planId: string;
}

export interface InvoiceLineItem extends Record<string, unknown> {
  description: string;
  quantity: number;
  unitPrice: string;
}

export interface Payment extends Record<string, unknown> {
  id: string;
  invoiceId: string;
  amount: string;
  method: string;
  reference: string | null;
  note: string | null;
  paidAt: string;
  createdAt: string;
}

export interface Invoice extends Record<string, unknown> {
  id: string;
  tenantId: string;
  tenantName?: string;
  invoiceNumber: string | null;
  status: InvoiceBaseStatus;
  effectiveStatus: InvoiceEffectiveStatus;
  lineItems: InvoiceLineItem[];
  subtotal: string;
  taxPercent: string;
  taxAmount: string;
  total: string;
  issuedAt: string | null;
  dueAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  memo: string | null;
  paid: string;
  outstanding: string;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceInput {
  tenantId: string;
  lineItems: InvoiceLineItem[];
  taxPercent?: number;
  memo?: string | null;
}

export interface PaymentInput {
  amount: number;
  method: string;
  reference?: string | null;
  note?: string | null;
  paidAt?: string | null;
}