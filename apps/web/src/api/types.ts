import type { PlanId } from "../lib/abonnement";

export type Role = "ADMIN" | "DAF" | "CONTROLEUR" | "LECTEUR";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Organisation de la session : celle du client en cours d'accès support. */
  organizationId: string;
  organizationName: string;
  /** Donne accès à la console d'exploitation. */
  administrateurPlateforme: boolean;
  /** La session porte sur l'organisation d'un client, pas la sienne. */
  support: boolean;
}

/*
 * Plus de `accessToken` : la connexion répond désormais avec l'utilisateur
 * seul, la session arrivant dans un cookie `httpOnly`. Retirer ce champ du
 * type est la moitié utile du changement — un jeton renvoyé dans le corps
 * finirait tôt ou tard recopié dans une variable JavaScript, et l'on
 * n'aurait rien gagné.
 */
export interface AuthResponse {
  user: AuthUser;
  /** Jeton anti-CSRF, que le frontend ne peut pas lire dans un cookie posé
   *  sur le domaine de l'API — voir api/client.ts. */
  jetonCsrf: string;
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
  | "RESULTAT_CESSIONS"
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

/**
 * Une ligne du grand livre, telle que la restitue le drill-down. C'est le
 * dernier échelon du « pourquoi » : sous l'agrégat il y a le compte, et sous
 * le compte la pièce comptable elle-même.
 */
export interface EcritureLigne {
  id: string;
  journalCode: string;
  entryNum: string;
  entryDate: string;
  accountCode: string;
  accountLabel: string;
  auxAccountCode: string | null;
  auxAccountLabel: string | null;
  pieceRef: string | null;
  label: string;
  debit: number;
  credit: number;
  lettering: string | null;
}

export interface EcrituresCompte {
  entityId: string;
  currency: string;
  compte: string;
  /** Nombre total de lignes correspondantes, indépendamment de la limite. */
  total: number;
  /** Nombre effectivement renvoyé : inférieur au total si la limite mord. */
  affichees: number;
  debitTotal: number;
  creditTotal: number;
  solde: number;
  ecritures: EcritureLigne[];
}

/**
 * Identité de marque appliquée aux documents produits par l'organisation.
 *
 * Les images n'y figurent que par leurs dimensions : l'API ne sert jamais le
 * fichier, seulement le PDF ou le classeur qui l'intègre. L'aperçu à l'écran
 * est donc reconstitué à partir du fichier que l'utilisateur vient de
 * choisir, pas rechargé depuis le serveur.
 */
export interface ImageMarque {
  format: string;
  largeur: number;
  hauteur: number;
}

export interface Marque {
  nomAffiche: string | null;
  mentionsPied: string | null;
  couleurAccent: string | null;
  signataireNom: string | null;
  signataireFonction: string | null;
  logo: ImageMarque | null;
  signature: ImageMarque | null;
  /** Faux quand la formule souscrite n'inclut pas la personnalisation. */
  autorisee: boolean;
}

export type EmplacementMarque = "logo" | "signature";

// --- Administration de la plateforme ---------------------------------------


export type StatutAbonnement = "essai" | "actif" | "impaye" | "resilie" | "incomplet";

export interface OrganisationPlateforme {
  id: string;
  nom: string;
  plan: PlanId;
  statut: StatutAbonnement;
  finPeriode: string | null;
  resiliationDemandee: boolean;
  creeeLe: string;
  utilisateurs: number;
  entites: number;
  periodes: number;
  ecritures: number;
  derniereActivite: string | null;
}

export interface UtilisateurPlateforme {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  derniereConnexion: string | null;
  administrateurPlateforme: boolean;
}

export interface SantePlateforme {
  organisations: number;
  utilisateurs: number;
  utilisateursActifs7j: number;
  ecritsEnEchec7j: number;
  abonnements: Partial<Record<StatutAbonnement, number>>;
}

// --- Tableau de bord pluriannuel et prévisionnel -----------------------------

export type FamilleMesure = "resultat" | "bilan" | "intermediaire" | "ratio";

export interface Mesure {
  id: string;
  label: string;
  unite: RatioUnit;
  famille: FamilleMesure;
  /** Un ratio ne s'additionne pas : l'écran ne propose pas de l'empiler. */
  cumulable: boolean;
}

export type TypeBloc = "courbe" | "barres" | "empile" | "tableau" | "tuile";

export interface Bloc {
  id: string;
  type: TypeBloc;
  titre: string;
  mesures: string[];
  largeur: "demi" | "pleine";
}

export interface SerieExercice {
  annee: number;
  label: string;
  /** Faux pour un exercice projeté. */
  reel: boolean;
  /** Faux quand l'exercice ne couvre pas douze mois. */
  complet: boolean;
  valeurs: Record<string, number | null>;
  besoinFinancement?: number;
}

export interface Hypotheses {
  horizon: number;
  croissanceCa: number;
  partAchats: number;
  partImpotsTaxes: number;
  croissanceChargesExternes: number;
  croissanceChargesPersonnel: number;
  dso: number;
  dpo: number;
  dio: number;
  investissements: number;
  dureeAmortissement: number;
  nouveauxEmprunts: number;
  remboursements: number;
  tauxInteret: number;
  tauxIS: number;
  dividendes: number;
}

export interface TableauEnregistre {
  blocs: Bloc[];
  hypotheses: Hypotheses;
  enregistre: boolean;
}

export interface Previsionnel {
  hypotheses: Hypotheses;
  exercices: SerieExercice[];
  /** Millésime du dernier exercice complet, point de départ de la projection. */
  depart: number | null;
}

/** État d'un dossier dans le portefeuille ; les motifs disent pourquoi. */
export type EtatDossier = "critique" | "a_surveiller" | "sain" | "incomplet";

export interface LignePortefeuille {
  id: string;
  nom: string;
  nafCode: string | null;
  devise: string;
  etat: EtatDossier;
  motifs: string[];
  dernieresDonnees: string | null;
  moisDepuisDernieresDonnees: number | null;
  exercice: string | null;
  chiffreAffaires: number | null;
  croissanceCa: number | null;
  margeEbitda: number | null;
  resultatNet: number | null;
  tresorerieNette: number | null;
  dso: number | null;
  alertesOuvertes: number;
  actionsEnRetard: number;
}

/** Comparaison d'un dossier aux quartiles de son secteur. */
export type LectureSectorielle = "favorable" | "defavorable" | "intermediaire" | "neutre";

export interface RatioSectoriel {
  id: string;
  libelle: string;
  unite: "pourcentage" | "jours" | "milliers_euros";
  sens: "haut_favorable" | "bas_favorable" | "neutre";
  comparabilite: "exacte" | "approchee";
  definition: string;
  ecart: string | null;
  valeur: number | null;
  quartiles: { q1: number; q2: number; q3: number } | null;
  nombreEntreprises: number | null;
  position: { quart: 1 | 2 | 3 | 4; lecture: LectureSectorielle; phrase: string } | null;
}

export type ComparaisonSectorielle =
  | {
      disponible: true;
      exercice: string;
      secteur: { code: string; libelle: string; niveau: "division" | "section" };
      source: { nom: string; publication: string; millesime: number; miseAJour: string; mention: string };
      avertissements: string[];
      ratios: RatioSectoriel[];
    }
  | {
      disponible: false;
      raison: "referentiel_absent" | "naf_absent" | "secteur_absent" | "exercice_absent";
      codeNaf?: string | null;
    };

export interface ReferentielCharge {
  source: string;
  millesime: number;
  miseAJour: string;
  secteurs: number;
  lignes: number;
  importeLe: string | null;
}
