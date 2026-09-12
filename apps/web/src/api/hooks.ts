import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "./client";
import type {
  AlertEvent,
  BalanceAgee,
  Concentration,
  DiagnosticPayload,
  ExerciceFec,
  FluxPayload,
  ResumeImportFec,
  SensTiers,
  SigPayload,
  AlertOperator,
  AlertRule,
  AuditLogPage,
  AuthResponse,
  AuthUser,
  BudgetVariance,
  CashCategory,
  CashLine,
  CashProjection,
  CashRecurrence,
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
    mutationFn: (input: {
      name: string;
      country?: string;
      currency?: string;
      fxRateToOrgCurrency?: number;
      nafCode?: string;
      headcount?: number;
    }) => api.post<Entity>("/entities", input),
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

export function useAuditLogs(limit = 25, enabled = true) {
  return useQuery<AuditLogPage>({
    queryKey: ["audit-logs", limit],
    queryFn: () => api.get(`/audit-logs?limit=${limit}`),
    enabled,
  });
}

export function useCashProjection(entityId: string | null, weeks = 13) {
  return useQuery<CashProjection>({
    queryKey: ["cash-projection", entityId, weeks],
    queryFn: () => api.get(`/entities/${entityId}/cash-forecast?weeks=${weeks}`),
    enabled: !!entityId,
  });
}

export function useCashLines(entityId: string | null) {
  return useQuery<CashLine[]>({
    queryKey: ["cash-lines", entityId],
    queryFn: () => api.get(`/entities/${entityId}/cash-forecast/lines`),
    enabled: !!entityId,
  });
}

export function useCashCategories(entityId: string | null) {
  return useQuery<Array<{ category: CashCategory; label: string }>>({
    queryKey: ["cash-categories"],
    queryFn: () => api.get(`/entities/${entityId}/cash-forecast/categories`),
    enabled: !!entityId,
    staleTime: Infinity,
  });
}

function invalidateCash(queryClient: ReturnType<typeof useQueryClient>, entityId: string) {
  queryClient.invalidateQueries({ queryKey: ["cash-projection", entityId] });
  queryClient.invalidateQueries({ queryKey: ["cash-lines", entityId] });
}

export function useCreateCashLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entityId: string;
      label: string;
      category: CashCategory;
      amount: number;
      startDate: string;
      recurrence: CashRecurrence;
      endDate?: string;
    }) => {
      const { entityId, ...body } = input;
      return api.post<CashLine>(`/entities/${entityId}/cash-forecast/lines`, body);
    },
    onSuccess: (_, variables) => invalidateCash(queryClient, variables.entityId),
  });
}

export function useDeleteCashLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityId: string; lineId: string }) =>
      api.delete(`/entities/${input.entityId}/cash-forecast/lines/${input.lineId}`),
    onSuccess: (_, variables) => invalidateCash(queryClient, variables.entityId),
  });
}

export function usePrefillCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string) =>
      api.post<{ created: number; basedOn: { label: string } }>(`/entities/${entityId}/cash-forecast/prefill`),
    onSuccess: (_, entityId) => invalidateCash(queryClient, entityId),
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

// --- Analyse ---------------------------------------------------------------

export function useSig(periodId: string | null) {
  return useQuery<SigPayload>({
    queryKey: ["sig", periodId],
    queryFn: () => api.get(`/analysis/sig/${periodId}`),
    enabled: Boolean(periodId),
  });
}

export function useFlux(periodId: string | null) {
  return useQuery<FluxPayload>({
    queryKey: ["flux", periodId],
    queryFn: () => api.get(`/analysis/flux/${periodId}`),
    enabled: Boolean(periodId),
    // La première période d'une entité n'a pas de bilan d'ouverture à
    // comparer : l'API répond 404, et réessayer n'y changera rien.
    retry: false,
  });
}

export function useBalanceAgee(entityId: string | null, sens: SensTiers, delai: number) {
  return useQuery<BalanceAgee>({
    queryKey: ["encours", entityId, sens, delai],
    queryFn: () => api.get(`/analysis/encours?entityId=${entityId}&sens=${sens}&delai=${delai}`),
    enabled: Boolean(entityId),
  });
}

export function useConcentration(entityId: string | null, sens: SensTiers) {
  return useQuery<Concentration>({
    queryKey: ["concentration", entityId, sens],
    queryFn: () => api.get(`/analysis/concentration?entityId=${entityId}&sens=${sens}`),
    enabled: Boolean(entityId),
  });
}

// --- Import FEC ------------------------------------------------------------

export function useExercicesFec(entityId: string | null) {
  return useQuery<ExerciceFec[]>({
    queryKey: ["fec-exercices", entityId],
    queryFn: () => api.get(`/fec/exercices?entityId=${entityId}`),
    enabled: Boolean(entityId),
  });
}

export function useImportFec() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityId, file }: { entityId: string; file: File }) =>
      uploadFile<ResumeImportFec>(`/fec/import/${entityId}`, file),
    onSuccess: () => {
      // Un import touche tout : périodes, ratios, tendances, alertes, encours.
      queryClient.invalidateQueries();
    },
  });
}

export function useDiagnostic(periodId: string | null) {
  return useQuery<DiagnosticPayload>({
    queryKey: ["diagnostic", periodId],
    queryFn: () => api.get(`/analysis/diagnostic/${periodId}`),
    enabled: Boolean(periodId),
  });
}
