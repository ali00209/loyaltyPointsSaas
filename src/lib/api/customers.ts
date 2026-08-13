import { client } from "./client";
import type { Customer, CustomerInput } from "@/types";

export async function fetchCustomers(): Promise<Customer[]> {
  const { data } = await client.get<{ customers: Customer[] }>("/customers");
  return data.customers;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data } = await client.post<{ customer: Customer }>("/customers", input);
  return data.customer;
}

export async function updateCustomer(
  id: string,
  input: Partial<CustomerInput>,
): Promise<Customer> {
  const { data } = await client.put<{ customer: Customer }>("/customers", {
    id,
    ...input,
  });
  return data.customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  await client.delete("/customers", { params: { id } });
}
