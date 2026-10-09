import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, memoriserCsrf, uploadFile } from "./client";
import { choisirDossier } from "../lib/dossierCourant";
import type { EtatAbonnement, PlanId } from "../lib/abonnement";
import type {
  BilanValeur,
  DossierOpportunites,
  Hypotheses,
  Previsionnel,
  SerieExercice,
  OrganisationPlateforme,
  SantePlateforme,
  UtilisateurPlateforme,
  StatutAbonnement,
  EmplacementMarque,
  Marque,
  ActionPlan,
  ActionStatus,
  AlertEvent,
  BalanceAgee,
  Concentration,
  DiagnosticPayload,
  EcrituresCompte,
  ExerciceFec,
  FluxPayload,
  ResumeImportFec,
  SensTiers,
  SigPayload,
  SyntheseActions,
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
  LignePortefeuille,
  ComparaisonSectorielle,
  ReferentielCharge,
} from "./types";

/**
 * La requête d'identité, partagée entre useMe et l'ouverture de session.
 *
 * L'ouverture de session doit pouvoir la relancer elle-même : useMe ne se
 * relance pas seul après un échec (ni nouvel essai, ni relecture au retour
 * sur l'onglet), et un 401 reçu avant la connexion restait sinon la réponse
 * en cache après elle.
 */
export const requeteMoi = {
  queryKey: ["me"],
  queryFn: () => api.get<AuthUser>("/auth/me"),
  retry: false,
} as const;

export function useMe(enabled: boolean) {
  return useQuery<AuthUser>({ ...requeteMoi, enabled });
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<AuthResponse>("/auth/login", input),
    onSuccess: (reponse) => memoriserCsrf(reponse.jetonCsrf),
  });
}

/** La déconnexion est devenue un appel serveur : seul lui peut retirer un
 *  cookie `httpOnly`. */
export function useDeconnexion() {
  return useMutation({ mutationFn: () => api.post<void>("/auth/logout") });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: {
      organizationName: string;
      name: string;
      email: string;
      password: string;
    }) => api.post<AuthResponse>("/auth/register", input),
    onSuccess: (reponse) => memoriserCsrf(reponse.jetonCsrf),
  });
}

/*
 * Les deux temps de la réinitialisation. Aucun des deux ne renvoie de corps :
 * l'API répond 204 — y compris pour une adresse inconnue, afin de ne pas
 * révéler qui possède un compte.
 */
export function useDemanderReinitialisation() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      api.post<void>("/auth/mot-de-passe/oubli", input),
  });
}

export function useReinitialiserMotDePasse() {
  return useMutation({
    mutationFn: (input: { jeton: string; motDePasse: string }) =>
      api.post<void>("/auth/mot-de-passe/nouveau", input),
  });
}

/*
 * Abonnement. L'état est la seule source de vérité affichable : le plan
 * réellement en vigueur est celui que le serveur connaît, posé par le
 * webhook Stripe, et non celui que l'utilisateur vient de choisir.
 */
export function useEtatAbonnement() {
  return useQuery<EtatAbonnement>({
    queryKey: ["abonnement"],
    queryFn: () => api.get("/billing/etat"),
  });
}

/** Les deux redirigent vers Stripe : la réponse ne contient qu'une adresse. */
export function useDemarrerCheckout() {
  return useMutation({
    mutationFn: (plan: PlanId) =>
      api.post<{ url: string }>("/billing/checkout", { plan }),
  });
}

export function useOuvrirPortail() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/portail"),
  });
}

/*
 * Conseiller. L'état dit si la fonctionnalité est disponible sur cette
 * instance et combien de questions restent : l'écran doit pouvoir le dire
 * avant d'offrir un champ de saisie qui échouerait.
 */
export interface EtatConseil {
  disponible: boolean;
  posees: number;
  incluses: number;
  restantes: number;
  formule: string;
}

export interface SourceConseil {
  outil: string;
  arguments: Record<string, unknown>;
  erreur: boolean;
}

export interface ReponseConseil {
  texte: string;
  sources: SourceConseil[];
  tronquee: boolean;
  restantes: number;
}

export function useEtatConseil() {
  return useQuery<EtatConseil>({
    queryKey: ["conseil", "etat"],
    queryFn: () => api.get("/conseil/etat"),
  });
}

export function usePoserQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) =>
      api.post<ReponseConseil>("/conseil/question", { question }),
    // Le compteur affiché doit suivre, sinon l'utilisateur découvre son
    // quota épuisé au refus plutôt qu'en le voyant décroître.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["conseil", "etat"] }),
  });
}

export function usePeriods(entityId?: string) {
  return useQuery<Period[]>({
    queryKey: ["periods", entityId ?? "all"],
    queryFn: () =>
      api.get(`/periods${entityId ? `?entityId=${entityId}` : ""}`),
  });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entityId: string;
      label: string;
      startDate: string;
      endDate: string;
    }) => api.post<Period>("/periods", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["periods"] }),
  });
}

/**
 * Suppression d'une période.
 *
 * Tout est invalidé, pas seulement la liste : les ratios, la tendance et les
 * alertes de l'entité se lisaient contre cette période, et l'API recalcule
 * les périodes suivantes en cascade.
 */
export function useDeletePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (periodId: string) => api.delete<void>(`/periods/${periodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
      queryClient.invalidateQueries({ queryKey: ["ratios"] });
      queryClient.invalidateQueries({ queryKey: ["trend"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

/** Le dossier comparé aux quartiles de son secteur, sur son dernier exercice complet. */
export function useComparaisonSectorielle(entityId: string) {
  return useQuery<ComparaisonSectorielle>({
    queryKey: ["comparaison-sectorielle", entityId],
    queryFn: () => api.get(`/entities/${entityId}/comparaison-sectorielle`),
    enabled: Boolean(entityId),
  });
}

/** Référentiels sectoriels chargés — console d'administration. */
export function useReferentielsSectoriels(actif: boolean) {
  return useQuery<ReferentielCharge[]>({
    queryKey: ["plateforme", "references-sectorielles"],
    queryFn: () => api.get("/plateforme/references-sectorielles"),
    enabled: actif,
  });
}

export function useImporterReferentiel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fichier: File) =>
      uploadFile<{ source: string; millesime: number; secteurs: number; lignes: number }>(
        "/plateforme/references-sectorielles",
        fichier,
        "fichier",
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useSupprimerReferentiel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ source, millesime }: { source: string; millesime: number }) =>
      api.delete<{ supprimees: number }>(`/plateforme/references-sectorielles/${source}/${millesime}`),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Tous les dossiers de l'organisation, une ligne chacun. */
export function usePortefeuille() {
  return useQuery<LignePortefeuille[]>({
    queryKey: ["portefeuille"],
    queryFn: () => api.get("/portefeuille"),
  });
}

export function useEntities() {
  return useQuery<Entity[]>({
    queryKey: ["entities"],
    queryFn: () => api.get("/entities"),
  });
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

/**
 * Charge le dossier de démonstration — ou le recharge, pour repartir de
 * zéro — et en fait le dossier courant : on le charge pour le regarder.
 */
export function useDossierDemonstration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ id: string; nom: string; remplace: boolean }>("/entities/demonstration"),
    onSuccess: (reponse) => {
      choisirDossier(reponse.id);
      // Tout peut en dépendre : liste des dossiers, portefeuille, alertes.
      return queryClient.invalidateQueries();
    },
  });
}

/** Supprime un dossier ; le nom exact est exigé en confirmation par l'API. */
export function useSupprimerEntite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nom }: { id: string; nom: string }) =>
      api.deleteAvecCorps<{ supprime: string }>(`/entities/${id}`, { nom }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useImportReference() {
  return useQuery<ImportReference>({
    queryKey: ["import-reference"],
    queryFn: () => api.get("/import/reference"),
  });
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
      items: Array<{
        accountCode: string;
        label: string;
        amount: number;
        poste: string;
      }>;
    }) =>
      api.post(`/periods/${input.periodId}/line-items/bulk`, {
        items: input.items,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["line-items", variables.periodId],
      });
      queryClient.invalidateQueries({
        queryKey: ["ratios", variables.periodId],
      });
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
    queryFn: () =>
      api.get(`/ratios/trend${entityId ? `?entityId=${entityId}` : ""}`),
  });
}

/**
 * Les périodes consolidables.
 *
 * `actif` laisse l'appelant suspendre la requête quand la formule n'inclut
 * pas la consolidation : le serveur répondrait 403, et l'écran afficherait
 * une erreur technique là où il doit afficher une explication commerciale.
 */
export function useConsolidationGroups({
  actif = true,
}: { actif?: boolean } = {}) {
  return useQuery<ConsolidationGroup[]>({
    queryKey: ["consolidation-groups"],
    queryFn: () => api.get("/consolidation/groups"),
    enabled: actif,
  });
}

export function useConsolidatedRatios(
  group: { startDate: string; endDate: string } | null,
) {
  return useQuery<ConsolidatedRatios>({
    queryKey: ["consolidated-ratios", group?.startDate, group?.endDate],
    queryFn: () =>
      api.get(
        `/consolidation/ratios?startDate=${group!.startDate}&endDate=${group!.endDate}`,
      ),
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
    mutationFn: (input: {
      periodId: string;
      items: Array<{ poste: LinePoste; amountBudgeted: number }>;
    }) =>
      api.post<BudgetVariance>(`/periods/${input.periodId}/budget`, {
        items: input.items,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["budget-variance", variables.periodId],
      });
    },
  });
}

export function useAlertRules() {
  return useQuery<AlertRule[]>({
    queryKey: ["alert-rules"],
    queryFn: () => api.get("/alert-rules"),
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      label: string;
      ratioId: string;
      operator: AlertOperator;
      threshold: number;
    }) => api.post<AlertRule>("/alert-rules", input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
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
  return useQuery<AlertEvent[]>({
    queryKey: ["alerts"],
    queryFn: () => api.get("/alerts"),
  });
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
    queryFn: () =>
      api.get(`/entities/${entityId}/cash-forecast?weeks=${weeks}`),
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

function invalidateCash(
  queryClient: ReturnType<typeof useQueryClient>,
  entityId: string,
) {
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
      return api.post<CashLine>(
        `/entities/${entityId}/cash-forecast/lines`,
        body,
      );
    },
    onSuccess: (_, variables) =>
      invalidateCash(queryClient, variables.entityId),
  });
}

export function useDeleteCashLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityId: string; lineId: string }) =>
      api.delete(
        `/entities/${input.entityId}/cash-forecast/lines/${input.lineId}`,
      ),
    onSuccess: (_, variables) =>
      invalidateCash(queryClient, variables.entityId),
  });
}

export function usePrefillCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string) =>
      api.post<{ created: number; basedOn: { label: string } }>(
        `/entities/${entityId}/cash-forecast/prefill`,
      ),
    onSuccess: (_, entityId) => invalidateCash(queryClient, entityId),
  });
}

export function useOrgUsers() {
  return useQuery<OrgUser[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  });
}

export function useCreateOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      password: string;
      role: string;
    }) => api.post<OrgUser>("/users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

// --- Marque des documents --------------------------------------------------

/*
 * Toutes les mutations invalident la même clé et renvoient l'état complet :
 * téléverser un logo change aussi le verdict d'autorisation si la formule
 * vient de changer, et rien ne gagnerait à reconstituer l'état à la main.
 */
export function useMarque() {
  return useQuery<Marque>({
    queryKey: ["marque"],
    queryFn: () => api.get("/marque"),
  });
}

export function useEnregistrerMarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      champs: Partial<Omit<Marque, "logo" | "signature" | "autorisee">>,
    ) => api.put<Marque>("/marque", champs),
    onSuccess: (marque) => queryClient.setQueryData(["marque"], marque),
  });
}

export function useTeleverserMarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      emplacement,
      fichier,
    }: {
      emplacement: EmplacementMarque;
      fichier: File;
    }) => uploadFile<Marque>(`/marque/${emplacement}`, fichier, "fichier"),
    onSuccess: (marque) => queryClient.setQueryData(["marque"], marque),
  });
}

export function useRetirerMarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emplacement: EmplacementMarque) =>
      api.delete<Marque>(`/marque/${emplacement}`),
    onSuccess: (marque) => queryClient.setQueryData(["marque"], marque),
  });
}

// --- Évolution et prévisionnel -----------------------------------------------

export function useSeriesPluriannuelles(entityId: string | null) {
  return useQuery<SerieExercice[]>({
    queryKey: ["pluriannuel", "series", entityId],
    queryFn: () => api.get(`/entities/${entityId}/pluriannuel/series`),
    enabled: Boolean(entityId),
  });
}

/**
 * Le prévisionnel, simulé sans être enregistré.
 *
 * Les hypothèses passent en paramètres d'URL : on doit pouvoir essayer un
 * scénario sans l'adopter, et revenir à celui qui est enregistré en
 * rechargeant la page.
 */
export function usePrevisionnel(
  entityId: string | null,
  hypotheses: Hypotheses | null,
) {
  const parametres = hypotheses
    ? new URLSearchParams(
        Object.entries(hypotheses).map(([cle, valeur]) => [
          cle,
          String(valeur),
        ]),
      ).toString()
    : "";
  return useQuery<Previsionnel>({
    // Garder la projection affichée pendant le recalcul : sans cela, chaque
    // frappe dans un champ ferait clignoter tout l'écran. Mais seulement pour
    // le même dossier : reprendre celle d'un autre dossier ferait adopter ses
    // hypothèses au dossier qu'on vient d'ouvrir.
    placeholderData: (precedente, requete) =>
      requete?.queryKey[2] === entityId ? keepPreviousData(precedente) : undefined,
    queryKey: ["pluriannuel", "previsionnel", entityId, parametres],
    queryFn: () =>
      api.get(
        `/entities/${entityId}/pluriannuel/previsionnel${parametres ? `?${parametres}` : ""}`,
      ),
    enabled: Boolean(entityId),
  });
}

export function useEffacerHypotheses(entityId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ effacees: boolean }>(`/entities/${entityId}/pluriannuel/previsionnel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pluriannuel"] }),
  });
}

export function useEnregistrerHypotheses(entityId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hypotheses: Hypotheses) =>
      api.put<Hypotheses>(
        `/entities/${entityId}/pluriannuel/previsionnel`,
        hypotheses,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["pluriannuel"] }),
  });
}

// --- Administration de la plateforme ---------------------------------------

/*
 * Ces requêtes ne sont émises que pour un administrateur de la plateforme :
 * les appeler en LECTEUR ne renverrait qu'une suite de 403, visibles dans la
 * console du navigateur et dans la piste d'audit — du bruit, pas une barrière
 * de plus. La barrière est côté serveur ; ici on évite seulement le bruit.
 */
export function useSantePlateforme(actif: boolean) {
  return useQuery<SantePlateforme>({
    queryKey: ["plateforme", "sante"],
    queryFn: () => api.get("/plateforme/sante"),
    enabled: actif,
  });
}

export function useOrganisationsPlateforme(actif: boolean) {
  return useQuery<OrganisationPlateforme[]>({
    queryKey: ["plateforme", "organisations"],
    queryFn: () => api.get("/plateforme/organisations"),
    enabled: actif,
  });
}

export function useUtilisateursPlateforme(organizationId: string | null) {
  return useQuery<UtilisateurPlateforme[]>({
    queryKey: ["plateforme", "utilisateurs", organizationId],
    queryFn: () =>
      api.get(`/plateforme/organisations/${organizationId}/utilisateurs`),
    enabled: Boolean(organizationId),
  });
}

export function useChangerFormulePlateforme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      ...corps
    }: {
      organizationId: string;
      plan?: PlanId;
      statut?: StatutAbonnement;
    }) =>
      api.patch<void>(
        `/plateforme/organisations/${organizationId}/formule`,
        corps,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plateforme"] }),
  });
}

export function useMotDePasseProvisoire() {
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<{ email: string; motDePasse: string }>(
        `/plateforme/utilisateurs/${userId}/mot-de-passe`,
      ),
  });
}

export function useDroitPlateforme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accorde }: { userId: string; accorde: boolean }) =>
      api.patch<void>(`/plateforme/utilisateurs/${userId}/droit-plateforme`, {
        accorde,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plateforme"] }),
  });
}

export function useSupprimerOrganisation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      nom,
    }: {
      organizationId: string;
      nom: string;
    }) =>
      api.deleteAvecCorps<{ supprimee: string }>(
        `/plateforme/organisations/${organizationId}`,
        { nom },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plateforme"] }),
  });
}

/**
 * Pose ou retire le dossier de test dans une organisation.
 *
 * Existe comme route et non seulement comme script : un script ne s'exécute
 * pas sur un serveur déployé, et c'est justement là qu'on veut éprouver les
 * écrans — sur l'installation réelle plutôt que sur une base locale qui n'a
 * jamais tout à fait la même tête.
 */
export function useDossierTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      action,
    }: {
      organizationId: string;
      action: "creer" | "supprimer";
    }) =>
      action === "creer"
        ? api.post<{ cree: boolean; supprime: boolean; nom: string }>(
            `/plateforme/organisations/${organizationId}/dossier-test`,
          )
        : api.delete<{ cree: boolean; supprime: boolean; nom: string }>(
            `/plateforme/organisations/${organizationId}/dossier-test`,
          ),
    /* Les entités changent : le reste de l'application doit les relire, pas
     * seulement la console. */
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Ouvre un accès support : la session en cours bascule sur le client. */
export function useOuvrirAccesSupport() {
  return useMutation({
    mutationFn: (organizationId: string) =>
      api.post<{
        organisation: { id: string; nom: string };
        jetonCsrf: string;
      }>(`/plateforme/organisations/${organizationId}/acces`),
    /* La session a changé : le jeton de l'ancienne ne vaut plus rien. Sans
     * cette ligne, la première modification faite depuis l'accès support
     * repartait avec le jeton du cabinet et se faisait refuser. */
    onSuccess: (reponse) => memoriserCsrf(reponse.jetonCsrf),
  });
}

export function useQuitterAccesSupport() {
  return useMutation({
    mutationFn: () => api.post<AuthResponse>("/auth/support/quitter"),
    onSuccess: (reponse) => memoriserCsrf(reponse.jetonCsrf),
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

export function useBalanceAgee(
  entityId: string | null,
  sens: SensTiers,
  delai: number,
) {
  return useQuery<BalanceAgee>({
    queryKey: ["encours", entityId, sens, delai],
    queryFn: () =>
      api.get(
        `/analysis/encours?entityId=${entityId}&sens=${sens}&delai=${delai}`,
      ),
    enabled: Boolean(entityId),
  });
}

/**
 * Écritures du grand livre d'un compte ou d'une racine de compte.
 *
 * `actif` laisse l'appelant décider du moment de la requête : le détail ne
 * s'ouvre qu'à la demande, et un compte de banque à plusieurs milliers de
 * lignes n'a aucune raison d'être chargé tant que personne ne l'a déplié.
 */
export function useEcritures(
  entityId: string | null,
  compte: string | null,
  actif = true,
) {
  return useQuery<EcrituresCompte>({
    queryKey: ["ecritures", entityId, compte],
    queryFn: () =>
      api.get(
        `/analysis/ecritures?entityId=${entityId}&compte=${encodeURIComponent(compte ?? "")}`,
      ),
    enabled:
      actif &&
      Boolean(entityId) &&
      Boolean(compte) &&
      (compte ?? "").length >= 2,
    // Le grand livre est immuable après import : inutile de le redemander à
    // chaque ouverture du panneau.
    staleTime: 5 * 60 * 1000,
  });
}

export function useConcentration(entityId: string | null, sens: SensTiers) {
  return useQuery<Concentration>({
    queryKey: ["concentration", entityId, sens],
    queryFn: () =>
      api.get(`/analysis/concentration?entityId=${entityId}&sens=${sens}`),
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

// --- Plan d'action ---------------------------------------------------------

export function useActions(entityId?: string, statut?: ActionStatus) {
  const params = new URLSearchParams();
  if (entityId) params.set("entityId", entityId);
  if (statut) params.set("statut", statut);
  const suffixe = params.toString() ? `?${params.toString()}` : "";

  return useQuery<ActionPlan[]>({
    queryKey: ["actions", entityId ?? "all", statut ?? "all"],
    queryFn: () => api.get(`/actions${suffixe}`),
  });
}

export function useSyntheseActions() {
  return useQuery<SyntheseActions>({
    queryKey: ["actions-synthese"],
    queryFn: () => api.get("/actions/synthese"),
  });
}

interface EntreeAction {
  constat: string;
  action: string;
  entityId?: string;
  ratioId?: string;
  valeurInitiale?: number;
  valeurCible?: number;
  impactEstime?: number;
  responsable?: string;
  echeance?: string;
}

/**
 * Modification d'une action. Les champs facultatifs acceptent `null`, qui
 * efface : sans lui, une cible ou une échéance posée par erreur resterait
 * pour toujours, l'absence de champ voulant dire « ne touche pas ».
 */
interface ModificationAction {
  constat?: string;
  action?: string;
  ratioId?: string | null;
  valeurInitiale?: number | null;
  valeurCible?: number | null;
  impactEstime?: number | null;
  responsable?: string | null;
  echeance?: string | null;
  statut?: ActionStatus;
  /** Valeur créée : `null` rend la main au calcul. */
  gainRetenu?: number | null;
  exclureDeLaValeur?: boolean;
}

function invaliderActions(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["actions"] });
  queryClient.invalidateQueries({ queryKey: ["actions-synthese"] });
  // La valeur créée et les missions lisent les actions : elles suivent.
  queryClient.invalidateQueries({ queryKey: ["valeur-creee"] });
  queryClient.invalidateQueries({ queryKey: ["opportunites"] });
}

export function useCreateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EntreeAction) =>
      api.post<ActionPlan>("/actions", input),
    onSuccess: () => invaliderActions(queryClient),
  });
}

export function useUpdateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ModificationAction & { id: string }) =>
      api.patch<ActionPlan>(`/actions/${id}`, input),
    onSuccess: () => invaliderActions(queryClient),
  });
}

export function useDeleteAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/actions/${id}`),
    onSuccess: () => invaliderActions(queryClient),
  });
}

/** Les missions à proposer, pour tout le portefeuille. */
export function useOpportunites() {
  return useQuery<DossierOpportunites[]>({
    queryKey: ["opportunites"],
    queryFn: () => api.get("/opportunites"),
  });
}

/** Les missions à proposer pour un dossier. */
export function useOpportunitesDossier(entityId: string | null) {
  return useQuery<DossierOpportunites>({
    queryKey: ["opportunites", entityId],
    queryFn: () => api.get(`/entities/${entityId}/opportunites`),
    enabled: Boolean(entityId),
  });
}

export interface FiltreValeur {
  /** AAAA-MM-JJ ; absent, depuis le début. */
  depuis?: string;
  statuts: ActionStatus[];
  entityId?: string;
}

/** Le bilan de valeur créée, selon la période, les statuts et le dossier choisis. */
export function useValeurCreee(filtre: FiltreValeur) {
  const parametres = new URLSearchParams();
  if (filtre.depuis) parametres.set("depuis", filtre.depuis);
  parametres.set("statuts", filtre.statuts.join(","));
  if (filtre.entityId) parametres.set("entityId", filtre.entityId);
  return useQuery<BilanValeur>({
    queryKey: ["valeur-creee", filtre],
    queryFn: () => api.get(`/valeur-creee?${parametres.toString()}`),
    enabled: filtre.statuts.length > 0,
  });
}

// --- Modèles du cabinet -----------------------------------------------------

/** Un réglage partagé par le cabinet ; `valeur` vaut null tant qu'il n'est pas posé. */
export function usePreferenceCabinet<T>(cle: string) {
  return useQuery<{ valeur: T | null }>({
    queryKey: ["preferences", cle],
    queryFn: () => api.get(`/preferences/${cle}`),
    staleTime: 5 * 60_000,
  });
}

export function useEnregistrerPreferenceCabinet<T>(cle: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (valeur: T | null): Promise<{ valeur: T | null }> =>
      valeur === null
        ? api.delete<{ valeur: T | null }>(`/preferences/${cle}`)
        : api.put<{ valeur: T | null }>(`/preferences/${cle}`, valeur),
    onSuccess: (reponse) => queryClient.setQueryData(["preferences", cle], reponse),
  });
}
