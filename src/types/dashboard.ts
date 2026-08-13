import type { TransactionType } from "./transaction";

export interface DashboardStats {
  totalCustomers: number;
  totalPoints: number;
  totalEarned: number;
  totalRedeemed: number;
  totalRewards: number;
  activeRules: number;
}

export interface RecentTransaction {
  id: string;
  customerName: string | null;
  transactionType: TransactionType;
  points: number;
  description: string | null;
  createdAt: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  currentBalance: number;
  totalPointsEarned: number;
}

export interface TopReward {
  id: string;
  name: string;
  redeemedCount: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentTransactions: RecentTransaction[];
  topCustomers: TopCustomer[];
  topRewards: TopReward[];
}
