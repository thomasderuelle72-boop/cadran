import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AlertEvent,
  AlertOperator,
  AlertRule,
  AuthResponse,
  AuthUser,
  BudgetVariance,
  ConsolidatedRatios,
  ConsolidationGroup,
  Entity,
  ImportReference,
  LineItem,
  LinePoste,
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

export function usePeriods(entityId?: string) {
  return useQuery<Period[]>({
    queryKey: ["periods", entityId ?? "all"],
    queryFn: () => api.get(`/periods${entityId ? `?entityId=${entityId}` : ""}`),
  });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityId: string; label: string; startDate: string; endDate: string }) =>
      api.post<Period>("/periods", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["periods"] }),
  });
}

export function useEntities() {
  return useQuery<Entity[]>({ queryKey: ["entities"], queryFn: () => api.get("/entities") });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; country?: string; currency?: string; fxRateToOrgCurrency?: number }) =>
      api.post<Entity>("/entities", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entities"] }),
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

export function useTrend(entityId?: string) {
  return useQuery<TrendPoint[]>({
    queryKey: ["trend", entityId ?? "all"],
    queryFn: () => api.get(`/ratios/trend${entityId ? `?entityId=${entityId}` : ""}`),
  });
}

export function useConsolidationGroups() {
  return useQuery<ConsolidationGroup[]>({
    queryKey: ["consolidation-groups"],
    queryFn: () => api.get("/consolidation/groups"),
  });
}

export function useConsolidatedRatios(group: { startDate: string; endDate: string } | null) {
  return useQuery<ConsolidatedRatios>({
    queryKey: ["consolidated-ratios", group?.startDate, group?.endDate],
    queryFn: () => api.get(`/consolidation/ratios?startDate=${group!.startDate}&endDate=${group!.endDate}`),
    enabled: !!group,
  });
}

export function useBudgetVariance(periodId: string | null) {
  return useQuery<BudgetVariance>({
    queryKey: ["budget-variance", periodId],
    queryFn: () => api.get(`/periods/${periodId}/budget/variance`),
    enabled: !!periodId,
  });
}

export function useSubmitBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodId: string; items: Array<{ poste: LinePoste; amountBudgeted: number }> }) =>
      api.post<BudgetVariance>(`/periods/${input.periodId}/budget`, { items: input.items }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budget-variance", variables.periodId] });
    },
  });
}

export function useAlertRules() {
  return useQuery<AlertRule[]>({ queryKey: ["alert-rules"], queryFn: () => api.get("/alert-rules") });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; ratioId: string; operator: AlertOperator; threshold: number }) =>
      api.post<AlertRule>("/alert-rules", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/alert-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useAlertEvents() {
  return useQuery<AlertEvent[]>({ queryKey: ["alerts"], queryFn: () => api.get("/alerts") });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}/acknowledge`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
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
