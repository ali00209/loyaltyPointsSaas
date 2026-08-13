import { client } from "./client";
import type { Product, ProductInput } from "@/types";

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await client.get<{ products: Product[] }>("/products");
  return data.products;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await client.post<{ product: Product }>("/products", input);
  return data.product;
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput> & { active?: boolean },
): Promise<Product> {
  const { data } = await client.put<{ product: Product }>("/products", {
    id,
    ...input,
  });
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  await client.delete("/products", { params: { id } });
}
