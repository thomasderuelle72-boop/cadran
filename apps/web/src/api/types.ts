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
  _count?: { periods: number };
}

export interface Period {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "OUVERTE" | "CLOTUREE";
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
  [key: string]: number;
}

export interface RatioResultPayload {
  periodId: string;
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
  entities: Array<{ id: string; name: string }>;
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
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
  rows: BudgetVarianceRow[];
  summary: {
    chiffreAffaires: { budgeted: number; actual: number; ecart: number };
    ebitda: { budgeted: number; actual: number; ecart: number };
    resultatNet: { budgeted: number; actual: number; ecart: number };
  };
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
