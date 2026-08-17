export interface PortalTenantInfo {
  id: string;
  name: string;
  slug: string;
  brandingConfig: { logoUrl?: string | null; brandColor?: string | null };
  suspended: boolean;
}

export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  referralCode: string | null;
  currentBalance: number;
  totalPointsEarned: number;
  tenant: PortalTenantInfo;
}

export interface PortalActivity {
  id: string;
  transactionType: "earn" | "redeem" | "adjust" | "expire";
  points: number;
  ruleName: string | null;
  source: string | null;
  description: string | null;
  createdAt: string;
}

export interface PortalOverview {
  summary: { currentBalance: number; totalPointsEarned: number };
  referral: { code: string | null; link: string };
  activity: PortalActivity[];
}

export interface PortalPurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  reviewed: boolean;
  review: { rating: number; text: string } | null;
}

export interface PortalPurchase {
  eventId: string;
  orderNumber: string | null;
  orderAmount: number;
  items: PortalPurchaseItem[];
  occurredAt: string;
}

export interface PortalAuthCustomer {
  id: string;
  name: string;
  email: string;
  referralCode: string | null;
  currentBalance: number;
}

export interface PortalLoginResult {
  customer: PortalAuthCustomer;
}

export interface PortalSignupResult {
  customer: PortalAuthCustomer;
  signupPointsAwarded: number;
  referralPointsAwarded: number;
}

export interface PortalReviewInput {
  purchaseId: string;
  productId: string;
  rating: number;
  text: string;
}

export interface PortalReviewResult {
  updated: boolean;
  pointsAwarded: number;
  eventId: string;
}

export interface ApiKeyInfo {
  configured: boolean;
  id?: string;
  name?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface ApiKeyRegenerateResult extends ApiKeyInfo {
  key?: string;
  note?: string;
}
