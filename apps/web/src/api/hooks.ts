import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AuthResponse,
  AuthUser,
  ImportReference,
  LineItem,
  OrgUser,
  Period,
  RatioResultPayload,
  TrendPoint,
} from "./types";

export function useMe(enabled: boolean) {
  return useQuery<AuthUser>({ queryKey: ["me"], queryFn: () => api.get("/auth/me"), enabled, retry: false });
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post<AuthResponse>("/auth/login", input),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: { organizationName: string; name: string; email: string; password: string }) =>
      api.post<AuthResponse>("/auth/register", input),
  });
}

export function usePeriods() {
  return useQuery<Period[]>({ queryKey: ["periods"], queryFn: () => api.get("/periods") });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; startDate: string; endDate: string }) =>
      api.post<Period>("/periods", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["periods"] }),
  });
}

export function useImportReference() {
  return useQuery<ImportReference>({ queryKey: ["import-reference"], queryFn: () => api.get("/import/reference") });
}

export function useLineItems(periodId: string | null) {
  return useQuery<LineItem[]>({
    queryKey: ["line-items", periodId],
    queryFn: () => api.get(`/periods/${periodId}/line-items`),
    enabled: !!periodId,
  });
}

export function useSubmitLineItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      periodId: string;
      items: Array<{ accountCode: string; label: string; amount: number; poste: string }>;
    }) => api.post(`/periods/${input.periodId}/line-items/bulk`, { items: input.items }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["line-items", variables.periodId] });
      queryClient.invalidateQueries({ queryKey: ["ratios", variables.periodId] });
      queryClient.invalidateQueries({ queryKey: ["periods"] });
      queryClient.invalidateQueries({ queryKey: ["trend"] });
    },
  });
}

export function useRatios(periodId: string | null) {
  return useQuery<RatioResultPayload>({
    queryKey: ["ratios", periodId],
    queryFn: () => api.get(`/periods/${periodId}/ratios`),
    enabled: !!periodId,
  });
}

export function useTrend() {
  return useQuery<TrendPoint[]>({ queryKey: ["trend"], queryFn: () => api.get("/ratios/trend") });
}

export function useOrgUsers() {
  return useQuery<OrgUser[]>({ queryKey: ["users"], queryFn: () => api.get("/users") });
}

export function useCreateOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; role: string }) =>
      api.post<OrgUser>("/users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
