export interface Product extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  price: string;
  category: string;
  active: boolean;
  createdAt: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  price: string;
  category: string;
}
