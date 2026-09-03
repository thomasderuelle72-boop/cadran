import { LinePoste } from "@prisma/client";

export type RatioCategory = "RENTABILITE" | "LIQUIDITE" | "SOLVABILITE" | "ACTIVITE";
export type RatioStatus = "bon" | "attention" | "critique" | "neutre";
export type RatioUnit = "pourcentage" | "jours" | "ratio" | "devise" | "annees";

export interface LineItemInput {
  poste: LinePoste;
  amount: number;
}

/**
 * Convention de signe : les postes de charges (ACHATS_CONSOMMES,
 * CHARGES_EXTERNES, CHARGES_PERSONNEL, IMPOTS_TAXES,
 * DOTATIONS_AMORTISSEMENTS, CHARGES_FINANCIERES, IMPOT_SOCIETES) sont
 * saisis en valeur positive et explicitement soustraits dans les formules
 * ci-dessous. AUTRES_PRODUITS_CHARGES_EXPLOITATION et RESULTAT_EXCEPTIONNEL
 * sont des soldes nets (produits moins charges), saisis avec leur signe.
 */
export interface Aggregates {
  chiffreAffaires: number;
  achatsConsommes: number;
  chargesExternes: number;
  chargesPersonnel: number;
  impotsTaxes: number;
  dotationsAmortissements: number;
  autresProduitsChargesExploitation: number;
  chargesFinancieres: number;
  produitsFinanciers: number;
  resultatExceptionnel: number;
  impotSocietes: number;
  stocks: number;
  creancesClients: number;
  autresCreances: number;
  disponibilites: number;
  capitauxPropres: number;
  dettesFinancieres: number;
  dettesFournisseurs: number;
  autresDettes: number;
  immobilisations: number;
}

export const AGGREGATE_KEY_BY_POSTE: Record<LinePoste, keyof Aggregates> = {
  CHIFFRE_AFFAIRES: "chiffreAffaires",
  ACHATS_CONSOMMES: "achatsConsommes",
  CHARGES_EXTERNES: "chargesExternes",
  CHARGES_PERSONNEL: "chargesPersonnel",
  IMPOTS_TAXES: "impotsTaxes",
  DOTATIONS_AMORTISSEMENTS: "dotationsAmortissements",
  AUTRES_PRODUITS_CHARGES_EXPLOITATION: "autresProduitsChargesExploitation",
  CHARGES_FINANCIERES: "chargesFinancieres",
  PRODUITS_FINANCIERS: "produitsFinanciers",
  RESULTAT_EXCEPTIONNEL: "resultatExceptionnel",
  IMPOT_SOCIETES: "impotSocietes",
  STOCKS: "stocks",
  CREANCES_CLIENTS: "creancesClients",
  AUTRES_CREANCES: "autresCreances",
  DISPONIBILITES: "disponibilites",
  CAPITAUX_PROPRES: "capitauxPropres",
  DETTES_FINANCIERES: "dettesFinancieres",
  DETTES_FOURNISSEURS: "dettesFournisseurs",
  AUTRES_DETTES: "autresDettes",
  IMMOBILISATIONS: "immobilisations",
};

export function computeAggregates(lineItems: LineItemInput[]): Aggregates {
  const aggregates: Aggregates = {
    chiffreAffaires: 0,
    achatsConsommes: 0,
    chargesExternes: 0,
    chargesPersonnel: 0,
    impotsTaxes: 0,
    dotationsAmortissements: 0,
    autresProduitsChargesExploitation: 0,
    chargesFinancieres: 0,
    produitsFinanciers: 0,
    resultatExceptionnel: 0,
    impotSocietes: 0,
    stocks: 0,
    creancesClients: 0,
    autresCreances: 0,
    disponibilites: 0,
    capitauxPropres: 0,
    dettesFinancieres: 0,
    dettesFournisseurs: 0,
    autresDettes: 0,
    immobilisations: 0,
  };

  for (const item of lineItems) {
    const key = AGGREGATE_KEY_BY_POSTE[item.poste];
    aggregates[key] += item.amount;
  }

  return aggregates;
}

export interface Derived {
  ebitda: number;
  ebit: number;
  resultatFinancier: number;
  resultatNet: number;
  actifCirculant: number;
  passifCirculant: number;
  totalActif: number;
  ressourcesStables: number;
  emploisStables: number;
  fondsDeRoulement: number;
  bfr: number;
  tresorerieNette: number;
}

export function computeDerived(a: Aggregates): Derived {
  const ebitda =
    a.chiffreAffaires -
    a.achatsConsommes -
    a.chargesExternes -
    a.chargesPersonnel -
    a.impotsTaxes +
    a.autresProduitsChargesExploitation;
  const ebit = ebitda - a.dotationsAmortissements;
  const resultatFinancier = a.produitsFinanciers - a.chargesFinancieres;
  const resultatNet = ebit + resultatFinancier + a.resultatExceptionnel - a.impotSocietes;

  const actifCirculant = a.stocks + a.creancesClients + a.autresCreances + a.disponibilites;
  const passifCirculant = a.dettesFournisseurs + a.autresDettes;
  const totalActif = a.immobilisations + actifCirculant;
  const ressourcesStables = a.capitauxPropres + a.dettesFinancieres;
  const emploisStables = a.immobilisations;
  const fondsDeRoulement = ressourcesStables - emploisStables;
  const bfr = a.stocks + a.creancesClients - a.dettesFournisseurs;
  const tresorerieNette = fondsDeRoulement - bfr;

  return {
    ebitda,
    ebit,
    resultatFinancier,
    resultatNet,
    actifCirculant,
    passifCirculant,
    totalActif,
    ressourcesStables,
    emploisStables,
    fondsDeRoulement,
    bfr,
    tresorerieNette,
  };
}

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

type ThresholdDirection = "higher-better" | "lower-better";

function statusFromThreshold(
  value: number | null,
  good: number,
  warning: number,
  direction: ThresholdDirection
): RatioStatus {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) return "neutre";
  if (direction === "higher-better") {
    if (value >= good) return "bon";
    if (value >= warning) return "attention";
    return "critique";
  }
  if (value <= good) return "bon";
  if (value <= warning) return "attention";
  return "critique";
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function computeRatios(
  aggregates: Aggregates,
  derived: Derived,
  previous?: { aggregates: Aggregates } | null
): RatioValue[] {
  const a = aggregates;
  const d = derived;

  const margeBrute = safeDivide(a.chiffreAffaires - a.achatsConsommes, a.chiffreAffaires);
  const margeEbitda = safeDivide(d.ebitda, a.chiffreAffaires);
  const margeNette = safeDivide(d.resultatNet, a.chiffreAffaires);
  const roe = safeDivide(d.resultatNet, a.capitauxPropres);
  const roce = safeDivide(d.ebit, a.capitauxPropres + a.dettesFinancieres);

  const liquiditeGenerale = safeDivide(d.actifCirculant, d.passifCirculant);
  const quickRatio = safeDivide(d.actifCirculant - a.stocks, d.passifCirculant);
  const gearing = safeDivide(a.dettesFinancieres, a.capitauxPropres);
  const autonomieFinanciere = safeDivide(a.capitauxPropres, d.totalActif);
  const capaciteRemboursement = safeDivide(a.dettesFinancieres, d.ebitda);
  const couvertureInterets = safeDivide(d.ebit, a.chargesFinancieres);

  const dso = safeDivide(a.creancesClients, a.chiffreAffaires);
  const dpo = safeDivide(a.dettesFournisseurs, a.achatsConsommes);
  const dio = safeDivide(a.stocks, a.achatsConsommes);
  const dsoDays = dso !== null ? dso * 365 : null;
  const dpoDays = dpo !== null ? dpo * 365 : null;
  const dioDays = dio !== null ? dio * 365 : null;
  const cycleConversionCash =
    dsoDays !== null && dioDays !== null && dpoDays !== null ? dsoDays + dioDays - dpoDays : null;

  const croissanceCa = previous
    ? safeDivide(a.chiffreAffaires - previous.aggregates.chiffreAffaires, previous.aggregates.chiffreAffaires)
    : null;

  const ratios: RatioValue[] = [
    {
      id: "marge_brute",
      label: "Marge brute",
      category: "RENTABILITE",
      formula: "(CA − Achats consommés) / CA",
      unit: "pourcentage",
      value: margeBrute,
      status: statusFromThreshold(margeBrute, 0.3, 0.15, "higher-better"),
      interpretation: "Efficacité de la production ou de l'achat-revente.",
    },
    {
      id: "marge_ebitda",
      label: "Marge d'EBITDA",
      category: "RENTABILITE",
      formula: "EBITDA / CA",
      unit: "pourcentage",
      value: margeEbitda,
      status: statusFromThreshold(margeEbitda, 0.15, 0.05, "higher-better"),
      interpretation: "Rentabilité opérationnelle avant amortissements.",
    },
    {
      id: "marge_nette",
      label: "Marge nette",
      category: "RENTABILITE",
      formula: "Résultat net / CA",
      unit: "pourcentage",
      value: margeNette,
      status: statusFromThreshold(margeNette, 0.05, 0, "higher-better"),
      interpretation: "Ce qui reste après toutes les charges.",
    },
    {
      id: "roe",
      label: "ROE",
      category: "RENTABILITE",
      formula: "Résultat net / Capitaux propres",
      unit: "pourcentage",
      value: roe,
      status: statusFromThreshold(roe, 0.1, 0.05, "higher-better"),
      interpretation: "Rendement pour les actionnaires.",
    },
    {
      id: "roce",
      label: "ROCE",
      category: "RENTABILITE",
      formula: "EBIT / (Capitaux propres + Dettes financières)",
      unit: "pourcentage",
      value: roce,
      status: statusFromThreshold(roce, 0.1, 0.05, "higher-better"),
      interpretation: "Rendement des capitaux réellement engagés.",
    },
    {
      id: "liquidite_generale",
      label: "Ratio de liquidité générale",
      category: "LIQUIDITE",
      formula: "Actif circulant / Passif circulant",
      unit: "ratio",
      value: liquiditeGenerale,
      status: statusFromThreshold(liquiditeGenerale, 1.5, 1.0, "higher-better"),
      interpretation: "Capacité à couvrir le passif court terme.",
    },
    {
      id: "quick_ratio",
      label: "Quick ratio",
      category: "LIQUIDITE",
      formula: "(Actif circulant − Stocks) / Passif circulant",
      unit: "ratio",
      value: quickRatio,
      status: statusFromThreshold(quickRatio, 1.0, 0.7, "higher-better"),
      interpretation: "Liquidité hors dépendance aux stocks.",
    },
    {
      id: "fonds_de_roulement",
      label: "Fonds de roulement",
      category: "LIQUIDITE",
      formula: "Ressources stables − Emplois stables",
      unit: "devise",
      value: d.fondsDeRoulement,
      status: statusFromThreshold(d.fondsDeRoulement, 0, 0, "higher-better"),
      interpretation: "Marge de sécurité financière à long terme.",
    },
    {
      id: "bfr",
      label: "Besoin en fonds de roulement",
      category: "LIQUIDITE",
      formula: "(Stocks + Créances clients) − Dettes fournisseurs",
      unit: "devise",
      value: d.bfr,
      status: "neutre",
      interpretation: "Cash immobilisé par le cycle d'exploitation.",
    },
    {
      id: "tresorerie_nette",
      label: "Trésorerie nette",
      category: "LIQUIDITE",
      formula: "Fonds de roulement − BFR",
      unit: "devise",
      value: d.tresorerieNette,
      status: statusFromThreshold(d.tresorerieNette, 0, 0, "higher-better"),
      interpretation: "Cash réellement disponible.",
    },
    {
      id: "gearing",
      label: "Ratio d'endettement (gearing)",
      category: "SOLVABILITE",
      formula: "Dettes financières / Capitaux propres",
      unit: "ratio",
      value: gearing,
      status: statusFromThreshold(gearing, 1, 2, "lower-better"),
      interpretation: "Poids de la dette face aux fonds propres.",
    },
    {
      id: "autonomie_financiere",
      label: "Autonomie financière",
      category: "SOLVABILITE",
      formula: "Capitaux propres / Total bilan",
      unit: "pourcentage",
      value: autonomieFinanciere,
      status: statusFromThreshold(autonomieFinanciere, 0.3, 0.15, "higher-better"),
      interpretation: "Indépendance vis-à-vis des créanciers.",
    },
    {
      id: "capacite_remboursement",
      label: "Capacité de remboursement",
      category: "SOLVABILITE",
      formula: "Dettes financières / EBITDA",
      unit: "annees",
      value: capaciteRemboursement,
      status: statusFromThreshold(capaciteRemboursement, 3, 5, "lower-better"),
      interpretation: "Années d'EBITDA nécessaires pour rembourser la dette.",
    },
    {
      id: "couverture_interets",
      label: "Couverture des intérêts",
      category: "SOLVABILITE",
      formula: "EBIT / Charges d'intérêts",
      unit: "ratio",
      value: couvertureInterets,
      status: statusFromThreshold(couvertureInterets, 4, 2, "higher-better"),
      interpretation: "Marge de sécurité face au coût de la dette.",
    },
    {
      id: "dso",
      label: "DSO — délai clients",
      category: "ACTIVITE",
      formula: "(Créances clients / CA) × 365",
      unit: "jours",
      value: dsoDays,
      status: statusFromThreshold(dsoDays, 45, 60, "lower-better"),
      interpretation: "Jours moyens pour encaisser une vente.",
    },
    {
      id: "dpo",
      label: "DPO — délai fournisseurs",
      category: "ACTIVITE",
      formula: "(Dettes fournisseurs / Achats) × 365",
      unit: "jours",
      value: dpoDays,
      status: "neutre",
      interpretation: "Jours moyens pour payer un fournisseur.",
    },
    {
      id: "dio",
      label: "DIO — rotation des stocks",
      category: "ACTIVITE",
      formula: "(Stocks / Achats) × 365",
      unit: "jours",
      value: dioDays,
      status: statusFromThreshold(dioDays, 60, 90, "lower-better"),
      interpretation: "Jours moyens de détention du stock.",
    },
    {
      id: "cycle_conversion_cash",
      label: "Cycle de conversion cash",
      category: "ACTIVITE",
      formula: "DSO + DIO − DPO",
      unit: "jours",
      value: cycleConversionCash,
      status: statusFromThreshold(cycleConversionCash, 30, 60, "lower-better"),
      interpretation: "Jours entre décaissement et encaissement.",
    },
    {
      id: "croissance_ca",
      label: "Croissance du CA",
      category: "ACTIVITE",
      formula: "(CA n − CA n-1) / CA n-1",
      unit: "pourcentage",
      value: croissanceCa,
      status: statusFromThreshold(croissanceCa, 0.05, 0, "higher-better"),
      interpretation: "Dynamique commerciale vs période précédente.",
    },
  ];

  return ratios;
}
