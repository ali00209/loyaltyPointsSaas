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
  transactions: {
    all: ["transactions"] as const,
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
    rules: ["admin", "rules"] as const,
  },
};
