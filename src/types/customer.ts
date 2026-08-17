export interface Customer extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  referralCode: string | null;
  isActive: boolean;
  totalPointsEarned: number;
  currentBalance: number;
  joinDate: string;
  createdAt: string;
}

export interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
}
