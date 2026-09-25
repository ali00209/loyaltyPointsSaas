export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  customers: {
    all: ["customers"] as const,
  },
  products: {
    all: ["products"] as const,
  },
  rules: {
    all: ["rules"] as const,
  },
  rewards: {
    all: ["rewards"] as const,
  },
  redemptionRules: {
    all: ["redemption-rules"] as const,
  },
  transactions: {
    all: ["transactions"] as const,
  },
  redemptionCheckouts: {
    all: ["redemption-checkouts"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
  },
  admin: {
    overview: ["admin", "overview"] as const,
    tenants: ["admin", "tenants"] as const,
    tenant: (id: string) => ["admin", "tenants", id] as const,
    tenantCustomers: (id: string) => ["admin", "tenants", id, "customers"] as const,
    tenantTransactions: (id: string) => ["admin", "tenants", id, "transactions"] as const,
    plans: ["admin", "plans"] as const,
    subscriptions: ["admin", "subscriptions"] as const,
    invoices: ["admin", "invoices"] as const,
    invoice: (id: string) => ["admin", "invoices", id] as const,
  },
  billing: {
    plans: ["billing", "plans"] as const,
    subscription: ["billing", "subscription"] as const,
    invoices: ["billing", "invoices"] as const,
  },
  portal: {
    tenant: (slug: string) => ["portal", "tenant", slug] as const,
    customer: ["portal", "customer"] as const,
    overview: ["portal", "overview"] as const,
    purchases: ["portal", "purchases"] as const,
    apiKey: ["settings", "api-key"] as const,
  },
};
