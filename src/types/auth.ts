export type UserRole = "admin" | "owner";

export interface TenantSummary {
  id: string;
  name: string;
  brandingConfig: Record<string, unknown>;
  suspended: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  tenant: TenantSummary | null;
  createdAt?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  businessName?: string;
}

export interface UpdateProfileInput {
  name: string;
  email: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
