/**
 * Structure de coûts et besoin de financement du cycle.
 *
 * Deux calculs que les dix-neuf ratios ne font pas, et qui répondent chacun à
 * une question qu'un dirigeant pose tôt ou tard :
 *
 *   - « à partir de quel chiffre d'affaires je gagne de l'argent ? », et son
 *     corollaire beaucoup plus utile : « de combien puis-je baisser avant de
 *     perdre de l'argent ? » ;
 *   - « de combien ai-je besoin pour financer ma croissance ? », qui est le
 *     calcul que ne font pas les entreprises qui meurent de croître.
 *
 * Module pur.
 */

import { LinePoste } from "@prisma/client";
import type { Aggregates, Derived } from "../ratios/engine";

/**
 * Part variable par défaut de chaque poste de charge, c'est-à-dire la
 * fraction qui suit l'activité.
 *
 * Ce sont des hypothèses, pas des mesures : une comptabilité générale ne
 * distingue pas le fixe du variable, seule une comptabilité analytique le
 * fait. Les valeurs retenues sont celles d'une activité de transformation —
 * les achats suivent les ventes, les loyers et les amortissements non, les
 * charges externes et le personnel partiellement. Elles sont surchargeables
 * poste par poste, et le résultat indique toujours l'hypothèse utilisée.
 */
export const PART_VARIABLE_DEFAUT: Partial<Record<LinePoste, number>> = {
  ACHATS_CONSOMMES: 1,
  CHARGES_EXTERNES: 0.3,
  CHARGES_PERSONNEL: 0.15,
  IMPOTS_TAXES: 0,
  DOTATIONS_AMORTISSEMENTS: 0,
  CHARGES_FINANCIERES: 0,
};

const POSTES_DE_CHARGE: LinePoste[] = [
  LinePoste.ACHATS_CONSOMMES,
  LinePoste.CHARGES_EXTERNES,
  LinePoste.CHARGES_PERSONNEL,
  LinePoste.IMPOTS_TAXES,
  LinePoste.DOTATIONS_AMORTISSEMENTS,
  LinePoste.CHARGES_FINANCIERES,
];

const MONTANT_PAR_POSTE: Record<string, keyof Aggregates> = {
  ACHATS_CONSOMMES: "achatsConsommes",
  CHARGES_EXTERNES: "chargesExternes",
  CHARGES_PERSONNEL: "chargesPersonnel",
  IMPOTS_TAXES: "impotsTaxes",
  DOTATIONS_AMORTISSEMENTS: "dotationsAmortissements",
  CHARGES_FINANCIERES: "chargesFinancieres",
};

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
  /** Marge sur coût variable rapportée au chiffre d'affaires. */
  tauxMargeSurCoutVariable: number | null;
  /** Chiffre d'affaires à partir duquel le résultat d'exploitation s'annule. */
  seuilRentabilite: number | null;
  /** Écart entre le chiffre d'affaires réalisé et le seuil. */
  margeSecurite: number | null;
  /** Marge de sécurité rapportée au chiffre d'affaires : de combien on peut baisser. */
  indiceSecurite: number | null;
  /**
   * Jour de la période où le seuil est atteint, en jours depuis son début.
   * Le « point mort » au sens propre : la date à partir de laquelle
   * l'entreprise travaille pour elle.
   */
  pointMortJours: number | null;
  /**
   * Levier opérationnel : de combien le résultat varie quand le chiffre
   * d'affaires varie de 1 %. Un levier élevé récompense la croissance et
   * punit durement la baisse.
   */
  levierOperationnel: number | null;
  joursPeriode: number;
}

export function computeSeuilRentabilite(
  a: Aggregates,
  joursPeriode: number,
  partsVariables: Partial<Record<LinePoste, number>> = {}
): SeuilRentabilite {
  const ventilation: VentilationCharge[] = POSTES_DE_CHARGE.map((poste) => {
    const montant = a[MONTANT_PAR_POSTE[poste]];
    const partVariable = partsVariables[poste] ?? PART_VARIABLE_DEFAUT[poste] ?? 0;
    const variable = montant * partVariable;
    return { poste, montant, partVariable, variable, fixe: montant - variable };
  });

  const chargesVariables = ventilation.reduce((somme, ligne) => somme + ligne.variable, 0);
  const chargesFixes = ventilation.reduce((somme, ligne) => somme + ligne.fixe, 0);

  const margeSurCoutVariable = a.chiffreAffaires - chargesVariables;
  const tauxMargeSurCoutVariable =
    a.chiffreAffaires === 0 ? null : margeSurCoutVariable / a.chiffreAffaires;

  // Un taux de marge nul ou négatif rend le seuil inatteignable : vendre plus
  // creuse alors la perte, et annoncer un seuil serait un contresens.
  const seuilRentabilite =
    tauxMargeSurCoutVariable === null || tauxMargeSurCoutVariable <= 0
      ? null
      : chargesFixes / tauxMargeSurCoutVariable;

  const margeSecurite = seuilRentabilite === null ? null : a.chiffreAffaires - seuilRentabilite;
  const indiceSecurite =
    margeSecurite === null || a.chiffreAffaires === 0 ? null : margeSecurite / a.chiffreAffaires;

  const pointMortJours =
    seuilRentabilite === null || a.chiffreAffaires <= 0
      ? null
      : (seuilRentabilite / a.chiffreAffaires) * joursPeriode;

  // Levier = marge sur coût variable / résultat d'exploitation, le résultat
  // d'exploitation étant ici celui de la ventilation (marge − charges fixes).
  const resultatExploitation = margeSurCoutVariable - chargesFixes;
  const levierOperationnel =
    resultatExploitation === 0 ? null : margeSurCoutVariable / resultatExploitation;

  return {
    ventilation,
    chargesVariables,
    chargesFixes,
    margeSurCoutVariable,
    tauxMargeSurCoutVariable,
    seuilRentabilite,
    margeSecurite,
    indiceSecurite,
    pointMortJours,
    levierOperationnel,
    joursPeriode,
  };
}

export interface BfrNormatif {
  /** Besoin en fonds de roulement retenu, périmètre d'exploitation. */
  bfr: number;
  /** Chiffre d'affaires d'une journée sur la période. */
  caJournalier: number | null;
  /**
   * BFR exprimé en jours de chiffre d'affaires. C'est cette forme qui le rend
   * projetable : en euros, le BFR est un constat ; en jours, c'est une
   * constante d'exploitation.
   */
  bfrEnJours: number | null;
  composantes: Array<{ id: string; label: string; montant: number; jours: number | null }>;
  /** Trésorerie qu'il faudrait immobiliser pour financer une croissance donnée. */
  besoinCroissance: Array<{ croissance: number; caSupplementaire: number; besoin: number }>;
  joursPeriode: number;
}

/** Hypothèses de croissance proposées par défaut. */
const CROISSANCES = [0.1, 0.25, 0.5, 1];

export function computeBfrNormatif(
  a: Aggregates,
  d: Derived,
  joursPeriode: number
): BfrNormatif {
  const caJournalier = joursPeriode > 0 && a.chiffreAffaires > 0 ? a.chiffreAffaires / joursPeriode : null;
  const enJours = (montant: number) => (caJournalier === null ? null : montant / caJournalier);

  const bfrEnJours = enJours(d.bfr);

  return {
    bfr: d.bfr,
    caJournalier,
    bfrEnJours,
    composantes: [
      { id: "stocks", label: "Stocks", montant: a.stocks, jours: enJours(a.stocks) },
      {
        id: "clients",
        label: "Créances clients",
        montant: a.creancesClients,
        jours: enJours(a.creancesClients),
      },
      {
        id: "fournisseurs",
        label: "Dettes fournisseurs",
        montant: -a.dettesFournisseurs,
        jours: enJours(-a.dettesFournisseurs),
      },
    ],
    // À structure d'exploitation inchangée, le BFR suit le chiffre d'affaires :
    // croître de 50 % immobilise 50 % de BFR en plus, avant d'encaisser le
    // premier euro de marge supplémentaire.
    besoinCroissance:
      caJournalier === null
        ? []
        : CROISSANCES.map((croissance) => ({
            croissance,
            caSupplementaire: a.chiffreAffaires * croissance,
            besoin: d.bfr * croissance,
          })),
    joursPeriode,
  };
}

/** Nombre de jours couverts par une période, bornes comprises. */
export function joursEntreDates(debut: Date, fin: Date): number {
  const JOUR_MS = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((fin.getTime() - debut.getTime()) / JOUR_MS) + 1);
}
