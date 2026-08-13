export interface BrandingConfig {
  logoUrl?: string | null;
  brandColor?: string | null;
}

export interface AdminTenant extends Record<string, unknown> {
  id: string;
  name: string;
  brandingConfig: BrandingConfig;
  suspended: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  customerCount: number;
  rewardCount: number;
  createdAt: string;
}

export interface AdminTenantDetail extends AdminTenant {
  assignedRules: Array<{
    assignmentId: string;
    assignmentActive: boolean;
    id: string;
    name: string;
    triggerType: string;
    pointsPerUnit: number;
  }>;
}

export interface CreateTenantInput {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  brandingConfig?: BrandingConfig;
}

export interface UpdateTenantInput {
  name?: string;
  brandingConfig?: BrandingConfig;
  suspended?: boolean;
}

export interface AdminOverview {
  totalTenants: number;
  activeTenants: number;
  totalRules: number;
  totalCustomers: number;
  totalTransactions: number;
  pointsInCirculation: number;
}
