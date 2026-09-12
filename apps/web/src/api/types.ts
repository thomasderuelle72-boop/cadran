export type Role = "ADMIN" | "DAF" | "CONTROLEUR" | "LECTEUR";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  organizationName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Entity {
  id: string;
  name: string;
  country: string | null;
  currency: string;
  fxRateToOrgCurrency: number;
  nafCode: string | null;
  headcount: number | null;
  _count?: { periods: number };
}

export interface Period {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "OUVERTE" | "CLOTUREE";
  source?: "MANUEL" | "FEC";
  entityId?: string;
  entity?: { id: string; name: string };
  _count?: { lineItems: number };
}

export type LinePoste =
  | "CHIFFRE_AFFAIRES"
  | "ACHATS_CONSOMMES"
  | "CHARGES_EXTERNES"
  | "CHARGES_PERSONNEL"
  | "IMPOTS_TAXES"
  | "DOTATIONS_AMORTISSEMENTS"
  | "AUTRES_PRODUITS_CHARGES_EXPLOITATION"
  | "CHARGES_FINANCIERES"
  | "PRODUITS_FINANCIERS"
  | "RESULTAT_EXCEPTIONNEL"
  | "IMPOT_SOCIETES"
  | "STOCKS"
  | "CREANCES_CLIENTS"
  | "AUTRES_CREANCES"
  | "DISPONIBILITES"
  | "CAPITAUX_PROPRES"
  | "DETTES_FINANCIERES"
  | "DETTES_FOURNISSEURS"
  | "AUTRES_DETTES"
  | "IMMOBILISATIONS";

export interface LineItem {
  id: string;
  accountCode: string;
  label: string;
  amount: string;
  poste: LinePoste;
}

export interface ImportReference {
  postes: Array<{ poste: LinePoste; label: string }>;
  pcgMapping: Array<{ prefix: string; poste: LinePoste; label: string }>;
}

export type RatioCategory = "RENTABILITE" | "LIQUIDITE" | "SOLVABILITE" | "ACTIVITE";
export type RatioStatus = "bon" | "attention" | "critique" | "neutre";
export type RatioUnit = "pourcentage" | "jours" | "ratio" | "devise" | "annees";

export interface RatioValue {
  id: string;
  label: string;
  category: RatioCategory;
  formula: string;
  unit: RatioUnit;
  value: number | null;
  status: RatioStatus;
  interpretation: string;
}

export interface Aggregates {
  chiffreAffaires: number;
  achatsConsommes: number;
  [key: string]: number;
}

export interface Derived {
  ebitda: number;
  ebit: number;
  resultatNet: number;
  fondsDeRoulement: number;
  bfr: number;
  tresorerieNette: number;
  totalActif: number;
  // Absents des calculs mis en cache avant l'ajout du contrôle d'équilibre :
  // l'affichage doit tolérer leur absence tant qu'une période n'a pas été
  // recalculée.
  totalPassif?: number;
  ecartBilan?: number;
  [key: string]: number | undefined;
}

export interface RatioResultPayload {
  periodId: string;
  currency: string;
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
  computedAt: string;
}

export interface TrendPoint {
  periodId: string;
  entityId: string;
  label: string;
  startDate: string;
  chiffreAffaires: number;
  ebitda: number;
  resultatNet: number;
  tresorerieNette: number;
  margeEbitda: number | null;
  liquiditeGenerale: number | null;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface ConsolidationGroup {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  entities: Array<{ id: string; name: string }>;
}

export interface ConsolidatedRatios {
  label: string;
  startDate: string;
  endDate: string;
  currency: string;
  entities: Array<{ id: string; name: string }>;
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
  growthScope: { previousLabel: string; entities: Array<{ id: string; name: string }> } | null;
}

export interface BudgetLine {
  id: string;
  poste: LinePoste;
  amountBudgeted: string;
}

export interface BudgetVarianceRow {
  poste: LinePoste;
  label: string;
  budgeted: number;
  actual: number;
  ecart: number;
  ecartPct: number | null;
}

export interface BudgetVariance {
  periodId: string;
  currency: string;
  rows: BudgetVarianceRow[];
  summary: {
    chiffreAffaires: { budgeted: number; actual: number; ecart: number };
    ebitda: { budgeted: number; actual: number; ecart: number };
    resultatNet: { budgeted: number; actual: number; ecart: number };
  };
}

export type CashCategory =
  | "ENCAISSEMENTS_CLIENTS"
  | "DECAISSEMENTS_FOURNISSEURS"
  | "SALAIRES_ET_CHARGES_SOCIALES"
  | "IMPOTS_ET_TAXES"
  | "LOYERS_ET_CHARGES_EXTERNES"
  | "REMBOURSEMENT_EMPRUNT"
  | "INVESTISSEMENT"
  | "FINANCEMENT"
  | "AUTRE";

export type CashRecurrence = "NONE" | "WEEKLY" | "MONTHLY";

export interface CashLine {
  id: string;
  label: string;
  category: CashCategory;
  amount: string;
  startDate: string;
  recurrence: CashRecurrence;
  endDate: string | null;
}

export interface CashWeek {
  weekStart: string;
  weekEnd: string;
  inflows: number;
  outflows: number;
  net: number;
  closingBalance: number;
  status: "bon" | "attention" | "critique";
  movements: Array<{ lineId: string; label: string; category: CashCategory; date: string; amount: number }>;
}

export interface CashProjection {
  entityId: string;
  currency: string;
  openingBalance: number;
  openingSource: { periodId: string; label: string; endDate: string } | null;
  lineCount: number;
  horizonWeeks: number;
  from: string;
  weeks: CashWeek[];
  lowestBalance: number;
  lowestWeekStart: string | null;
}

export interface AuditLogEntry {
  id: string;
  userEmail: string;
  userRole: Role | null;
  action: string;
  method: string;
  path: string;
  statusCode: number;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

export type AlertOperator = "LT" | "LTE" | "GT" | "GTE";

export interface AlertRule {
  id: string;
  label: string;
  ratioId: string;
  operator: AlertOperator;
  threshold: number;
  active: boolean;
}

export interface AlertEvent {
  id: string;
  value: number;
  acknowledged: boolean;
  updatedAt: string;
  rule: { id: string; label: string; ratioId: string; operator: AlertOperator; threshold: number };
  period: { id: string; label: string } | null;
  entity: { id: string; name: string } | null;
}

// --- Analyse ---------------------------------------------------------------

export interface SoldeIntermediaire {
  id: string;
  label: string;
  valeur: number;
  formule: string;
  partDuCa: number | null;
  majeur: boolean;
}

export interface Sig {
  soldes: SoldeIntermediaire[];
  valeurAjoutee: number;
  excedentBrutExploitation: number;
  resultatExploitation: number;
  resultatCourantAvantImpots: number;
  resultatNet: number;
  capaciteAutofinancement: number;
  partageValeurAjoutee: Array<{ id: string; label: string; montant: number; part: number | null }> | null;
}

export interface SigPayload {
  periodId: string;
  periodLabel: string;
  currency: string;
  sig: Sig;
  precedent: { periodId: string; periodLabel: string; sig: Sig } | null;
}

export interface LigneFlux {
  id: string;
  label: string;
  montant: number;
  explication: string;
}

export interface SectionFlux {
  id: "exploitation" | "investissement" | "financement";
  label: string;
  lignes: LigneFlux[];
  total: number;
}

export interface TableauFlux {
  sections: SectionFlux[];
  fluxExploitation: number;
  fluxInvestissement: number;
  fluxFinancement: number;
  variationTresorerie: number;
  tresorerieOuverture: number;
  tresorerieCloture: number;
  ecartReconciliation: number;
}

export interface FluxPayload {
  periodId: string;
  periodLabel: string;
  currency: string;
  ouverturePeriodId: string;
  ouverturePeriodLabel: string;
  flux: TableauFlux;
}

export type SensTiers = "CLIENT" | "FOURNISSEUR";

export interface TrancheAge {
  id: string;
  label: string;
  min: number;
  max: number | null;
  montant: number;
  part: number | null;
}

export interface LigneTiers {
  code: string;
  label: string;
  encours: number;
  part: number | null;
  ageMoyen: number | null;
  enRetard: number;
  ageMaximal: number | null;
}

export interface BalanceAgee {
  sens: SensTiers;
  entityId: string;
  currency: string;
  dateReference: string;
  delaiPaiementJours: number;
  encoursTotal: number;
  encoursEnRetard: number;
  ageMoyenPondere: number | null;
  tranches: TrancheAge[];
  tiers: LigneTiers[];
  sansTiers: number;
  ecrituresAnalysees: number;
}

export interface Concentration {
  sens: SensTiers;
  entityId: string;
  currency: string;
  total: number;
  tiers: Array<{ code: string; label: string; montant: number; part: number | null }>;
  partPremier: number | null;
  partTroisPremiers: number | null;
  partDixPremiers: number | null;
  herfindahl: number | null;
}

// --- Import FEC ------------------------------------------------------------

export interface ErreurFec {
  ligne: number;
  message: string;
}

export interface ResumeImportFec {
  exercice: number;
  debutExercice: string | null;
  finExercice: string | null;
  ecrituresImportees: number;
  lignesIgnorees: number;
  erreurs: ErreurFec[];
  totalDebit: number;
  totalCredit: number;
  ecart: number;
  equilibre: boolean;
  periodes: Array<{ id: string; label: string; lignes: number }>;
  periodesSupprimees: number;
  comptesNonClasses: Array<{ accountCode: string; label: string; mouvement: number }>;
  periodesManuellesRecouvrantes: Array<{ id: string; label: string }>;
}

export interface ExerciceFec {
  exercice: number;
  ecritures: number;
  debut: string | null;
  fin: string | null;
}

// --- Diagnostic ------------------------------------------------------------

export type ZoneScore = "sain" | "incertain" | "danger" | "indisponible";

export interface ComposanteScore {
  id: string;
  label: string;
  formule: string;
  valeur: number | null;
  coefficient: number;
  contribution: number | null;
}

export interface ScoreRisque {
  id: string;
  label: string;
  source: string;
  valeur: number | null;
  zone: ZoneScore;
  seuilDanger: number;
  seuilSain: number;
  composantes: ComposanteScore[];
  limites: string;
  avertissementCalibration: string | null;
  motifIndisponibilite: string | null;
}

export interface VentilationCharge {
  poste: LinePoste;
  montant: number;
  partVariable: number;
  variable: number;
  fixe: number;
}

export interface SeuilRentabilite {
  ventilation: VentilationCharge[];
  chargesVariables: number;
  chargesFixes: number;
  margeSurCoutVariable: number;
  tauxMargeSurCoutVariable: number | null;
  seuilRentabilite: number | null;
  margeSecurite: number | null;
  indiceSecurite: number | null;
  pointMortJours: number | null;
  levierOperationnel: number | null;
  joursPeriode: number;
}

export interface BfrNormatif {
  bfr: number;
  caJournalier: number | null;
  bfrEnJours: number | null;
  composantes: Array<{ id: string; label: string; montant: number; jours: number | null }>;
  besoinCroissance: Array<{ croissance: number; caSupplementaire: number; besoin: number }>;
  joursPeriode: number;
}

export interface DiagnosticPayload {
  periodId: string;
  periodLabel: string;
  currency: string;
  joursPeriode: number;
  diagnostic: {
    scores: ScoreRisque[];
    convergence: "convergente" | "divergente" | "partielle";
    commentaire: string;
  };
  seuilRentabilite: SeuilRentabilite;
  bfrNormatif: BfrNormatif;
}

// --- Plan d'action ---------------------------------------------------------

export type ActionStatus = "A_FAIRE" | "EN_COURS" | "FAITE" | "ABANDONNEE";

export interface AvancementAction {
  ratioId: string;
  ratioLabel: string;
  valeurInitiale: number | null;
  valeurCible: number | null;
  valeurActuelle: number | null;
  periodeLue: string | null;
  progression: number | null;
  cibleAtteinte: boolean | null;
  sens: "hausse" | "baisse" | null;
}

export interface ActionPlan {
  id: string;
  entityId: string | null;
  entityName: string | null;
  constat: string;
  action: string;
  ratioId: string | null;
  valeurInitiale: number | null;
  valeurCible: number | null;
  impactEstime: number | null;
  responsable: string | null;
  echeance: string | null;
  statut: ActionStatus;
  auteurEmail: string;
  createdAt: string;
  updatedAt: string;
  avancement: AvancementAction | null;
  enRetard: boolean;
}

export interface SyntheseActions {
  total: number;
  parStatut: Record<ActionStatus, number>;
  enRetard: number;
  impactOuvert: number;
  impactRealise: number;
}
