"use client";

import {
  ApiError,
  createCustomer,
  createProduct,
  createReward,
  createRule,
  createTenant,
  createTransaction,
  deleteCustomer,
  deleteProduct,
  deleteReward,
  deleteRule,
  fetchAdminOverview,
  fetchAdminTenant,
  fetchAdminTenantCustomers,
  fetchAdminTenantTransactions,
  fetchAdminTenants,
  fetchApiKey,
  fetchAssignedRules,
  fetchCurrentUser,
  fetchCustomers,
  fetchDashboard,
  fetchPortalCustomer,
  fetchPortalOverview,
  fetchPortalPurchases,
  fetchPortalTenant,
  fetchProducts,
  fetchRewards,
  fetchTransactions,
  login,
  logout,
  portalLogin,
  portalLogout,
  portalSignup,
  postEvent,
  postPortalEvent,
  postPortalReview,
  regenerateApiKey,
  register,
  seedDemoData,
  toggleRuleAssignment,
  updateCustomer,
  updateProduct,
  updateReward,
  updateRule,
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
  PostEventInput,
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

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EarningRuleInput) => createRule(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<EarningRuleInput> }) =>
      updateRule(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
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

export type { AdminOverview, AdminTenant, AdminTenantDetail, EarningRule, RedemptionReward };

// --- Events ---

export function usePostEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostEventInput) => postEvent(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
    },
  });
}

// --- Customer portal ---

export function usePortalTenant(slug: string) {
  return useQuery({
    queryKey: queryKeys.portal.tenant(slug),
    queryFn: () => fetchPortalTenant(slug),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function usePortalCustomer() {
  return useQuery({
    queryKey: queryKeys.portal.customer,
    queryFn: () =>
      fetchPortalCustomer().catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }),
    retry: false,
  });
}

export function usePortalLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portalLogin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal.customer });
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal.overview });
    },
  });
}

export function usePortalSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portalSignup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal.customer });
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal.overview });
    },
  });
}

export function usePortalLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: portalLogout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function usePortalOverview() {
  return useQuery({
    queryKey: queryKeys.portal.overview,
    queryFn: fetchPortalOverview,
  });
}

export function usePortalPurchases() {
  return useQuery({
    queryKey: queryKeys.portal.purchases,
    queryFn: fetchPortalPurchases,
  });
}

export function usePostPortalReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postPortalReview,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portal.purchases }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portal.overview }),
      ]);
    },
  });
}

export function usePostPortalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postPortalEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portal.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portal.purchases }),
      ]);
    },
  });
}

// --- Settings ---

export function useApiKey() {
  return useQuery({
    queryKey: queryKeys.portal.apiKey,
    queryFn: fetchApiKey,
  });
}

export function useRegenerateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) => regenerateApiKey(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal.apiKey });
    },
  });
}
