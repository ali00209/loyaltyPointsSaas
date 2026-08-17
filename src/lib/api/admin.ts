import { client } from "./client";
import type {
  AdminOverview,
  AdminTenant,
  AdminTenantDetail,
  CreateTenantInput,
  Customer,
  Transaction,
  UpdateTenantInput,
} from "@/types";

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await client.get<{ overview: AdminOverview }>("/admin/overview");
  return data.overview;
}

export async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const { data } = await client.get<{ tenants: AdminTenant[] }>("/admin/tenants");
  return data.tenants;
}

export async function createTenant(input: CreateTenantInput): Promise<AdminTenant> {
  const { data } = await client.post<{ tenant: AdminTenant }>("/admin/tenants", input);
  return data.tenant;
}

export async function fetchAdminTenant(id: string): Promise<AdminTenantDetail> {
  const { data } = await client.get<{ tenant: AdminTenantDetail }>(`/admin/tenants/${id}`);
  return data.tenant;
}

export async function updateTenant(
  id: string,
  input: UpdateTenantInput,
): Promise<AdminTenant> {
  const { data } = await client.put<{ tenant: AdminTenant }>(`/admin/tenants/${id}`, input);
  return data.tenant;
}

export async function fetchAdminTenantCustomers(id: string): Promise<Customer[]> {
  const { data } = await client.get<{ customers: Customer[] }>(
    `/admin/tenants/${id}/customers`,
  );
  return data.customers;
}

export async function fetchAdminTenantTransactions(id: string): Promise<Transaction[]> {
  const { data } = await client.get<{ transactions: Transaction[] }>(
    `/admin/tenants/${id}/transactions`,
  );
  return data.transactions;
}
