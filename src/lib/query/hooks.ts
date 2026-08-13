"use client";

import {
  ApiError,
  assignRule,
  createAdminRule,
  createCustomer,
  createProduct,
  createReward,
  createTenant,
  createTransaction,
  deleteAdminRule,
  deleteCustomer,
  deleteProduct,
  deleteReward,
  fetchAdminOverview,
  fetchAdminRules,
  fetchAdminTenant,
  fetchAdminTenantCustomers,
  fetchAdminTenantTransactions,
  fetchAdminTenants,
  fetchAssignedRules,
  fetchCurrentUser,
  fetchCustomers,
  fetchDashboard,
  fetchProducts,
  fetchRewards,
  fetchTransactions,
  login,
  logout,
  register,
  seedDemoData,
  toggleRuleAssignment,
  unassignRule,
  updateAdminRule,
  updateCustomer,
  updateProduct,
  updateReward,
  updateTenant,
} from "@/lib/api";
import type {
  AdminOverview,
  AdminTenant,
  AdminTenantDetail,
  CreateTenantInput,
  Customer,
  CustomerInput,
  EarningRule,
  EarningRuleInput,
  LoginInput,
  Product,
  ProductInput,
  RedemptionReward,
  RegisterInput,
  RewardInput,
  TransactionInput,
  UpdateTenantInput,
  User,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: fetchCustomers,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: (customer) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (prev) =>
        prev ? [customer, ...prev] : [customer],
      );
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CustomerInput> }) =>
      updateCustomer(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (prev) =>
        prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev,
      );
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (prev) =>
        prev ? prev.filter((c) => c.id !== id) : prev,
      );
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products.all,
    queryFn: fetchProducts,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: (product) => {
      queryClient.setQueryData<Product[]>(queryKeys.products.all, (prev) =>
        prev ? [product, ...prev] : [product],
      );
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductInput> & { active?: boolean } }) =>
      updateProduct(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Product[]>(queryKeys.products.all, (prev) =>
        prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
      );
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Product[]>(queryKeys.products.all, (prev) =>
        prev ? prev.filter((p) => p.id !== id) : prev,
      );
    },
  });
}

// --- Rules (assigned to the current tenant) ---

export function useRules() {
  return useQuery({
    queryKey: queryKeys.rules.all,
    queryFn: fetchAssignedRules,
  });
}

export function useToggleRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleRuleAssignment(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rules.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

// --- Rewards ---

export function useRewards() {
  return useQuery({
    queryKey: queryKeys.rewards.all,
    queryFn: fetchRewards,
  });
}

export function useCreateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RewardInput) => createReward(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<RewardInput> }) =>
      updateReward(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReward(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

// --- Transactions ---

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions.all,
    queryFn: fetchTransactions,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionInput) => createTransaction(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
    },
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: fetchDashboard,
  });
}

// --- Auth ---

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () =>
      fetchCurrentUser().catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (user) => {
      queryClient.setQueryData<User | null>(queryKeys.auth.me, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: (user) => {
      queryClient.setQueryData<User | null>(queryKeys.auth.me, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData<User | null>(queryKeys.auth.me, null);
      queryClient.clear();
    },
  });
}

export function useSeedDemo() {
  return useMutation({ mutationFn: seedDemoData });
}

// --- Admin ---

export function useAdminOverview() {
  return useQuery({
    queryKey: queryKeys.admin.overview,
    queryFn: fetchAdminOverview,
  });
}

export function useAdminTenants() {
  return useQuery({
    queryKey: queryKeys.admin.tenants,
    queryFn: fetchAdminTenants,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTenantInput) => createTenant(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview });
    },
  });
}

export function useAdminTenant(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.tenant(id),
    queryFn: () => fetchAdminTenant(id),
    enabled: Boolean(id),
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTenantInput }) =>
      updateTenant(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview });
    },
  });
}

export function useAdminTenantCustomers(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.tenantCustomers(id),
    queryFn: () => fetchAdminTenantCustomers(id),
    enabled: Boolean(id),
  });
}

export function useAdminTenantTransactions(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.tenantTransactions(id),
    queryFn: () => fetchAdminTenantTransactions(id),
    enabled: Boolean(id),
  });
}

export function useAdminRules() {
  return useQuery({
    queryKey: queryKeys.admin.rules,
    queryFn: fetchAdminRules,
  });
}

export function useCreateAdminRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EarningRuleInput) => createAdminRule(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.rules });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview });
    },
  });
}

export function useUpdateAdminRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<EarningRuleInput> }) =>
      updateAdminRule(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.rules });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants });
    },
  });
}

export function useDeleteAdminRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminRule(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.rules });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview });
    },
  });
}

export function useAssignRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, tenantId }: { ruleId: string; tenantId: string }) =>
      assignRule(ruleId, tenantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.rules });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants });
    },
  });
}

export function useUnassignRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, tenantId }: { ruleId: string; tenantId: string }) =>
      unassignRule(ruleId, tenantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.rules });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.tenants });
    },
  });
}

export type { AdminOverview, AdminTenant, AdminTenantDetail, EarningRule, RedemptionReward };
