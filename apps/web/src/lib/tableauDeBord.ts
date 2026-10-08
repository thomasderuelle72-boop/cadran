import type { Aggregates, Derived, Period, RatioStatus, RatioValue } from "../api/types";

/**
 * Les calculs d'affichage du tableau de bord, séparés des composants pour
 * être éprouvés seuls : une cascade qui ne retombe pas sur le résultat net,
 * ou un écart calculé contre la mauvaise période, se verrait à peine à
 * l'écran et tromperait pourtant le lecteur.
 */

const JOUR = 24 * 60 * 60 * 1000;

function duree(p: Pick<Period, "startDate" | "endDate">): number {
  return (new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / JOUR;
}

/**
 * Les périodes comparables à la période choisie, jusqu'à elle incluse, de la
 * plus ancienne à la plus récente.
 *
 * Comparable veut dire de même durée, à 15 % près : un dossier mêle souvent
 * des exercices et des trimestres, et un trimestre comparé à l'exercice
 * précédent afficherait une « chute » de 75 % du chiffre d'affaires qui
 * n'existe pas. Les 15 % absorbent les trimestres de 90 ou 92 jours.
 */
export function periodesComparables(periodes: Period[], choisie: string | null): Period[] {
  const reference = periodes.find((p) => p.id === choisie);
  if (!reference) return [];
  const d = duree(reference);
  return periodes
    .filter((p) => Math.abs(duree(p) - d) <= d * 0.15)
    .filter((p) => new Date(p.startDate) <= new Date(reference.startDate))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export interface Ecart {
  /** Variation relative, quand elle a un sens (base strictement positive). */
  pourcentage: number | null;
  absolu: number;
}

/**
 * L'écart entre deux valeurs. En pourcentage seulement sur une base
 * positive : « +250 % » d'une perte de 2 000 € à un bénéfice de 3 000 € ne
 * veut rien dire, alors que « +5 000 € » se lit.
 */
export function ecart(courant: number, precedent: number | null | undefined): Ecart | null {
  if (precedent === null || precedent === undefined || !Number.isFinite(precedent)) return null;
  const absolu = courant - precedent;
  return { absolu, pourcentage: precedent > 0 ? absolu / precedent : null };
}

export type Verdict = "sain" | "a_surveiller" | "fragile";

export interface EtatIndicateurs {
  bon: number;
  attention: number;
  critique: number;
  /** Indicateurs jugés : ceux qui ont une valeur et un seuil. */
  total: number;
  verdict: Verdict;
  /** Les indicateurs qui décrochent, les critiques d'abord. */
  aSurveiller: RatioValue[];
}

/**
 * Où en sont les indicateurs, compté et non noté.
 *
 * Pas de « score sur 100 » : une note composite cache comment elle est
 * faite, et on ne saurait pas l'expliquer à un client. Ici, c'est un
 * décompte qu'on peut vérifier ligne à ligne dans les familles en dessous.
 * Le verdict suit une règle qui s'énonce en une phrase : un indicateur
 * critique, ou plus d'un quart à surveiller, et le dossier n'est plus sain.
 */
export function etatIndicateurs(ratios: RatioValue[]): EtatIndicateurs {
  const juges = ratios.filter((r) => r.value !== null && r.status !== "neutre");
  const compter = (s: RatioStatus) => juges.filter((r) => r.status === s).length;
  const bon = compter("bon");
  const attention = compter("attention");
  const critique = compter("critique");
  const total = juges.length;

  let verdict: Verdict = "sain";
  if (critique >= 2 || (total > 0 && critique / total > 0.15)) verdict = "fragile";
  else if (critique === 1 || (total > 0 && attention / total > 0.25)) verdict = "a_surveiller";

  const aSurveiller = [
    ...juges.filter((r) => r.status === "critique"),
    ...juges.filter((r) => r.status === "attention"),
  ];
  return { bon, attention, critique, total, verdict, aSurveiller };
}

export interface EtapeCascade {
  libelle: string;
  /** Total intermédiaire (barre pleine depuis zéro) ou variation (barre flottante). */
  nature: "total" | "variation";
  /** Montant porté par la barre : le total, ou la variation signée. */
  montant: number;
  /** Bornes de la barre, de la plus basse à la plus haute. */
  bas: number;
  haut: number;
  aide: string;
}

/**
 * Du chiffre d'affaires au résultat net, en neuf barres.
 *
 * Chaque total intermédiaire vient du serveur (EBITDA, résultat
 * d'exploitation, résultat net) ; les variations entre deux totaux sont
 * calculées par différence. La cascade retombe donc toujours exactement sur
 * les chiffres affichés ailleurs — même quand un poste secondaire (autres
 * produits d'exploitation, par exemple) n'a pas sa propre barre : il est
 * compris dans la variation qui le contient, dont l'aide le dit.
 */
export function etapesCascade(a: Aggregates, d: Derived): EtapeCascade[] {
  const valeurAjoutee = a.chiffreAffaires - (a.achatsConsommes ?? 0) - (a.chargesExternes ?? 0);
  const ebitda = d.ebitda;
  const exploitation = d.ebit;
  const net = d.resultatNet;
  const impot = a.impotSocietes ?? 0;
  const avantImpot = net + impot;

  const etapes: EtapeCascade[] = [];
  let courant = 0;
  const total = (libelle: string, montant: number, aide: string) => {
    etapes.push({ libelle, nature: "total", montant, bas: Math.min(0, montant), haut: Math.max(0, montant), aide });
    courant = montant;
  };
  const variation = (libelle: string, vers: number, aide: string) => {
    const montant = vers - courant;
    etapes.push({ libelle, nature: "variation", montant, bas: Math.min(courant, vers), haut: Math.max(courant, vers), aide });
    courant = vers;
  };

  total("Chiffre d'affaires", a.chiffreAffaires, "Les ventes de la période, hors taxes.");
  variation("Achats et charges externes", valeurAjoutee, "Matières, marchandises, sous-traitance, loyers, honoraires…");
  total("Valeur ajoutée", valeurAjoutee, "Ce que l'entreprise crée elle-même, après ce qu'elle achète à d'autres.");
  variation(
    "Personnel et impôts",
    ebitda,
    "Salaires, charges sociales, impôts et taxes (hors impôt sur les sociétés), et autres produits ou charges d'exploitation.",
  );
  total("EBITDA", ebitda, "Ce que l'activité dégage, avant amortissements, intérêts et impôt sur les sociétés.");
  variation("Amortissements", exploitation, "L'usure des équipements, étalée sur leur durée de vie : une charge qui ne sort pas de la caisse.");
  variation(
    "Financier et exceptionnel",
    avantImpot,
    "Intérêts payés ou reçus, plus ou moins-values de cession et opérations exceptionnelles.",
  );
  variation("Impôt sur les sociétés", net, "L'impôt dû sur le bénéfice de la période.");
  total("Résultat net", net, "Ce qui reste à l'entreprise : le bénéfice, ou la perte.");
  return etapes;
}
