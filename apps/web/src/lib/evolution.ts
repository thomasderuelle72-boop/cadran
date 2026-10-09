import type { SerieExercice } from "../api/types";

/**
 * Lire l'évolution d'une entreprise sur ses derniers exercices.
 *
 * La méthode est celle du diagnostic financier tel que l'enseignent la CCI et
 * que l'ordonnent les fascicules de la Banque de France : l'activité, puis la
 * rentabilité, puis la structure financière, puis la trésorerie. Chaque thème
 * donne un état, deux ou trois mots pour la synthèse, et des phrases chiffrées
 * qui disent ce qu'il faut retenir — sans IA : des règles écrites, qu'on peut
 * relire et défendre devant le client.
 *
 * Deux garde-fous, parce que c'est là que l'ancien écran trompait :
 * - seuls les exercices **complets** se comparent : neuf mois face à douze
 *   donnent une « chute » qui n'existe pas ;
 * - une variation en pourcentage ne se calcule que sur une base positive :
 *   « +120 % » quand on part d'une perte ne veut rien dire.
 */

export type EtatLecture = "sain" | "a_surveiller" | "fragile";
export type Theme = "activite" | "rentabilite" | "structure" | "tresorerie";

export interface Lecture {
  theme: Theme;
  question: string;
  etat: EtatLecture;
  /** Deux ou trois mots, pour la synthèse : « en hausse », « en recul ». */
  resume: string;
  phrases: string[];
}

export const QUESTIONS: Record<Theme, string> = {
  activite: "L'activité progresse-t-elle ?",
  rentabilite: "Est-ce rentable ?",
  structure: "La structure est-elle solide ?",
  tresorerie: "La trésorerie suit-elle ?",
};

/** Jours moyens d'un mois, pour ramener un exercice partiel à un rythme mensuel. */
const JOURS_PAR_MOIS = 365.25 / 12;

export function valeur(exercice: SerieExercice, id: string): number | null {
  const v = exercice.valeurs[id];
  return v === undefined || v === null || !Number.isFinite(v) ? null : v;
}

/** Les exercices réalisés et complets, du plus ancien au plus récent ; les `nombre` derniers. */
export function exercicesComplets(series: SerieExercice[], nombre?: number): SerieExercice[] {
  const complets = series.filter((e) => e.reel && e.complet).sort((a, b) => a.annee - b.annee);
  return nombre ? complets.slice(-nombre) : complets;
}

/** Le dernier exercice réalisé, s'il est incomplet : l'exercice en cours. */
export function exerciceEnCours(series: SerieExercice[]): SerieExercice | null {
  const reels = series.filter((e) => e.reel).sort((a, b) => a.annee - b.annee);
  const dernier = reels[reels.length - 1];
  return dernier && !dernier.complet ? dernier : null;
}

// --- Écriture des nombres, à la française -----------------------------------

function nombre(v: number, chiffres = 0): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres });
}

/** 948 000 → « 948 k€ » ; 1 250 000 → « 1,3 M€ ». Le signe moins est typographique. */
export function montantCourt(v: number): string {
  const absolu = Math.abs(v);
  const signe = v < 0 ? "−" : "";
  if (absolu >= 1_000_000) return `${signe}${nombre(absolu / 1_000_000, absolu >= 10_000_000 ? 0 : 1)} M€`;
  if (absolu >= 1_000) return `${signe}${nombre(Math.round(absolu / 1_000))} k€`;
  return `${signe}${nombre(Math.round(absolu))} €`;
}

/** 0,048 → « +4,8 % ». */
export function pourcentSigne(taux: number, chiffres = 1): string {
  const arrondi = Number((Math.abs(taux) * 100).toFixed(chiffres));
  if (arrondi === 0) return `${nombre(0, chiffres)} %`;
  return `${taux > 0 ? "+" : "−"}${nombre(arrondi, chiffres)} %`;
}

function pourcent(taux: number, chiffres = 1): string {
  return `${nombre(taux * 100, chiffres)} %`;
}

/** « −2,9 points », « +1,5 point » : le pluriel commence à deux. */
function points(ecart: number): string {
  const absolu = Number(Math.abs(ecart).toFixed(1));
  return `${ecart >= 0 ? "+" : "−"}${nombre(absolu, 1)} point${absolu >= 2 ? "s" : ""}`;
}

// --- Calculs ------------------------------------------------------------------

/** Variation d'un montant ; le pourcentage n'existe que sur une base positive. */
export function variation(avant: number, apres: number): { montant: number; taux: number | null } {
  return { montant: apres - avant, taux: avant > 0 ? apres / avant - 1 : null };
}

/** Taux de croissance annuel moyen entre deux montants positifs, sur `annees` ans. */
export function tauxAnnuelMoyen(debut: number, fin: number, annees: number): number | null {
  if (debut <= 0 || fin <= 0 || annees <= 0) return null;
  return Math.pow(fin / debut, 1 / annees) - 1;
}

/** Charges d'exploitation décaissées : ce qui sépare le chiffre d'affaires de l'EBITDA. */
export function chargesExploitation(exercice: SerieExercice): number | null {
  const postes = ["achatsConsommes", "chargesExternes", "chargesPersonnel", "impotsTaxes"].map((p) =>
    valeur(exercice, `agregat.${p}`),
  );
  if (postes.every((p) => p === null)) return null;
  return postes.reduce<number>((s, p) => s + (p ?? 0), 0);
}

/** Une mesure en base 100 au premier exercice ; vide si la base n'est pas positive. */
export function base100(exercices: SerieExercice[], lire: (e: SerieExercice) => number | null): (number | null)[] {
  const base = exercices.length ? lire(exercices[0]) : null;
  if (base === null || base <= 0) return exercices.map(() => null);
  return exercices.map((e) => {
    const v = lire(e);
    return v === null ? null : (v / base) * 100;
  });
}

/** Le besoin en fonds de roulement exprimé en jours de chiffre d'affaires. */
export function bfrEnJours(exercice: SerieExercice): number | null {
  const ca = valeur(exercice, "agregat.chiffreAffaires");
  const bfr = valeur(exercice, "derive.bfr");
  if (ca === null || bfr === null || ca <= 0) return null;
  return (bfr / ca) * 365;
}

// --- Les quatre lectures ------------------------------------------------------

function bornes(exercices: SerieExercice[]) {
  const premier = exercices[0];
  const dernier = exercices[exercices.length - 1];
  return { premier, dernier, annees: dernier.annee - premier.annee };
}

export function lireActivite(exercices: SerieExercice[]): Lecture | null {
  const { premier, dernier, annees } = bornes(exercices);
  const ca0 = valeur(premier, "agregat.chiffreAffaires");
  const caN = valeur(dernier, "agregat.chiffreAffaires");
  if (ca0 === null || caN === null) return null;

  const taux = tauxAnnuelMoyen(ca0, caN, annees);
  const { taux: total } = variation(ca0, caN);

  let etat: EtatLecture = "sain";
  let resume = "stable";
  if (taux === null) {
    etat = caN >= ca0 ? "sain" : "a_surveiller";
    resume = caN >= ca0 ? "en hausse" : "en baisse";
  } else if (taux > 0.01) resume = "en hausse";
  else if (taux < -0.03) [etat, resume] = ["fragile", "en net recul"];
  else if (taux < -0.01) [etat, resume] = ["a_surveiller", "en baisse"];

  const detail =
    total === null
      ? ""
      : ` (${pourcentSigne(total)}${annees > 1 && taux !== null ? `, soit ${pourcentSigne(taux)} par an` : ""})`;
  const phrases = [
    `Le chiffre d'affaires est passé de ${montantCourt(ca0)} en ${premier.label} à ${montantCourt(caN)} en ${dernier.label}${detail}.`,
  ];
  if (exercices.length > 2) {
    const avant = valeur(exercices[exercices.length - 2], "agregat.chiffreAffaires");
    const recent = avant === null ? null : variation(avant, caN).taux;
    if (recent !== null) phrases.push(`Sur le dernier exercice : ${pourcentSigne(recent)}.`);
  }
  return { theme: "activite", question: QUESTIONS.activite, etat, resume, phrases };
}

export function lireRentabilite(exercices: SerieExercice[]): Lecture | null {
  const { premier, dernier } = bornes(exercices);
  const m0 = valeur(premier, "ratio.marge_ebitda");
  const mN = valeur(dernier, "ratio.marge_ebitda");
  const rnN = valeur(dernier, "derive.resultatNet");
  if (m0 === null && mN === null && rnN === null) return null;

  let etat: EtatLecture = "sain";
  let resume = "stable";
  const ecart = m0 !== null && mN !== null ? (mN - m0) * 100 : null;
  if (mN !== null && mN < 0) [etat, resume] = ["fragile", "en perte d'exploitation"];
  else if (ecart !== null && ecart <= -5) [etat, resume] = ["fragile", "en net recul"];
  else if (ecart !== null && ecart <= -2) [etat, resume] = ["a_surveiller", "en recul"];
  else if (ecart !== null && ecart >= 2) resume = "en progrès";
  if (rnN !== null && rnN < 0 && etat === "sain") [etat, resume] = ["a_surveiller", "dernier exercice en perte"];

  const phrases: string[] = [];
  if (m0 !== null && mN !== null && ecart !== null) {
    phrases.push(
      Math.abs(ecart) < 0.1
        ? `La marge d'EBITDA est restée stable, autour de ${pourcent(mN)} du chiffre d'affaires.`
        : `La marge d'EBITDA est passée de ${pourcent(m0)} à ${pourcent(mN)} du chiffre d'affaires (${points(ecart)}).`,
    );
  }

  // L'effet ciseaux : les ventes et les charges qui ne vont pas au même pas.
  const ca0 = valeur(premier, "agregat.chiffreAffaires");
  const caN = valeur(dernier, "agregat.chiffreAffaires");
  const c0 = chargesExploitation(premier);
  const cN = chargesExploitation(dernier);
  if (ca0 !== null && caN !== null && c0 !== null && cN !== null) {
    const ventes = variation(ca0, caN).taux;
    const charges = variation(c0, cN).taux;
    if (ventes !== null && charges !== null) {
      const constat = `Sur la période, les charges d'exploitation ont évolué de ${pourcentSigne(charges)} et les ventes de ${pourcentSigne(ventes)}`;
      // Un écart de quelques points est un signal ; l'effet ciseaux, c'est
      // quand il est franc, ou qu'il a déjà coûté de la marge.
      if (charges - ventes >= 0.05 || (charges - ventes > 0.02 && ecart !== null && ecart <= -2)) {
        phrases.push(`${constat} : les charges vont plus vite que les ventes, c'est un effet ciseaux qui réduit la marge.`);
      } else if (charges - ventes > 0.02) {
        phrases.push(`${constat} : les charges vont un peu plus vite que les ventes, à surveiller avant que la marge ne s'en ressente.`);
      } else if (ventes - charges > 0.02) {
        phrases.push(`${constat} : les ventes vont plus vite que les charges, chaque euro vendu rapporte davantage.`);
      }
    }
  }

  if (rnN !== null) {
    const pertes = exercices.filter((e) => (valeur(e, "derive.resultatNet") ?? 0) < 0);
    if (rnN < 0) {
      phrases.push(`Le dernier exercice se solde par une perte de ${montantCourt(-rnN)}.`);
    } else if (pertes.length > 0) {
      const liste = pertes.map((e) => e.label).join(", ");
      phrases.push(
        `${pertes.length} exercice${pertes.length > 1 ? "s" : ""} en perte sur la période (${liste}) ; ${dernier.label} est bénéficiaire (${montantCourt(rnN)}).`,
      );
    }
  }
  return { theme: "rentabilite", question: QUESTIONS.rentabilite, etat, resume, phrases };
}

export function lireStructure(exercices: SerieExercice[]): Lecture | null {
  const { premier, dernier } = bornes(exercices);
  const cp0 = valeur(premier, "agregat.capitauxPropres");
  const cpN = valeur(dernier, "agregat.capitauxPropres");
  if (cp0 === null || cpN === null) return null;
  const dettes = valeur(dernier, "agregat.dettesFinancieres") ?? 0;
  const ebitda = valeur(dernier, "derive.ebitda");
  const autonomie = valeur(dernier, "ratio.autonomie_financiere");
  const annees = dettes > 0 && ebitda !== null && ebitda > 0 ? dettes / ebitda : null;

  let etat: EtatLecture = "sain";
  let resume = "solide";
  if (cpN <= 0) [etat, resume] = ["fragile", "capitaux propres négatifs"];
  else if (dettes > 0 && annees === null) [etat, resume] = ["fragile", "dette sans EBITDA"];
  else if (annees !== null && annees > 4) [etat, resume] = ["fragile", "endettement lourd"];
  else if ((annees !== null && annees > 3) || (autonomie !== null && autonomie < 0.2)) {
    [etat, resume] = ["a_surveiller", "à surveiller"];
  }

  const evolution = variation(cp0, cpN).taux;
  const phrases = [
    evolution !== null && Math.abs(evolution) < 0.01
      ? `Les capitaux propres sont stables, à ${montantCourt(cpN)}.`
      : `Les capitaux propres sont passés de ${montantCourt(cp0)} à ${montantCourt(cpN)}${evolution === null ? "" : ` (${pourcentSigne(evolution)})`}.`,
  ];
  if (cpN <= 0) {
    phrases.push(
      "Ils sont négatifs : la société doit les reconstituer (articles L223-42 et L225-248 du Code de commerce).",
    );
  }
  if (dettes <= 0) phrases.push("L'entreprise n'a pas de dette financière.");
  else if (annees !== null) {
    phrases.push(
      `Les dettes financières (${montantCourt(dettes)}) représentent ${nombre(annees, 1)} année${annees >= 2 ? "s" : ""} d'EBITDA ; au-delà de 3 à 4 ans, un banquier les juge lourdes.`,
    );
  } else {
    phrases.push(`Les dettes financières s'élèvent à ${montantCourt(dettes)}, sans EBITDA positif pour les rembourser.`);
  }
  if (autonomie !== null && cpN > 0) phrases.push(`Les capitaux propres financent ${pourcent(autonomie, 0)} du bilan.`);
  return { theme: "structure", question: QUESTIONS.structure, etat, resume, phrases };
}

export function lireTresorerie(exercices: SerieExercice[]): Lecture | null {
  const { premier, dernier } = bornes(exercices);
  const t0 = valeur(premier, "derive.tresorerieNette");
  const tN = valeur(dernier, "derive.tresorerieNette");
  if (t0 === null || tN === null) return null;
  const fr = valeur(dernier, "derive.fondsDeRoulement");
  const bfr = valeur(dernier, "derive.bfr");
  const j0 = bfrEnJours(premier);
  const jN = bfrEnJours(dernier);
  const caN = valeur(dernier, "agregat.chiffreAffaires");

  let etat: EtatLecture = "sain";
  let resume = tN > t0 ? "en hausse" : "stable";
  if (tN < 0) [etat, resume] = ["fragile", "négative"];
  else if (j0 !== null && jN !== null && jN - j0 >= 10 && tN < t0) [etat, resume] = ["a_surveiller", "sous tension"];
  else if (t0 > 0 && tN < t0 * 0.8) [etat, resume] = ["a_surveiller", "en baisse"];

  const phrases = [`La trésorerie nette est passée de ${montantCourt(t0)} à ${montantCourt(tN)}.`];
  if (fr !== null && bfr !== null) {
    phrases.push(
      `Elle se lit comme le fonds de roulement (${montantCourt(fr)}) diminué du besoin en fonds de roulement (${montantCourt(bfr)}).`,
    );
  }
  if (j0 !== null && jN !== null && caN !== null && Math.abs(jN - j0) >= 3) {
    const montant = (Math.abs(jN - j0) / 365) * caN;
    phrases.push(
      `Le besoin en fonds de roulement est passé de ${nombre(j0)} à ${nombre(jN)} jours de chiffre d'affaires : à activité égale, le cycle d'exploitation immobilise ${montantCourt(montant)} de ${jN > j0 ? "plus" : "moins"} qu'au début de la période.`,
    );
  }
  return { theme: "tresorerie", question: QUESTIONS.tresorerie, etat, resume, phrases };
}

/** Les quatre lectures, dans l'ordre du diagnostic. Il faut deux exercices complets. */
export function lireEvolution(exercices: SerieExercice[]): Lecture[] {
  if (exercices.length < 2) return [];
  return [lireActivite, lireRentabilite, lireStructure, lireTresorerie]
    .map((lire) => lire(exercices))
    .filter((l): l is Lecture => l !== null);
}

// --- L'exercice en cours --------------------------------------------------------

export interface RythmeEnCours {
  exercice: SerieExercice;
  mois: number;
  /** Chiffre d'affaires moyen par mois, sur l'exercice en cours et sur le dernier complet. */
  caMensuel: number | null;
  caMensuelPrecedent: number | null;
  ecart: number | null;
  resultat: number | null;
}

/**
 * Ce que l'exercice en cours dit déjà, sans le comparer à une année pleine :
 * on rapporte les deux à un rythme mensuel moyen. C'est une indication — la
 * saisonnalité n'y est pas — et l'écran le dit.
 */
export function rythmeEnCours(series: SerieExercice[]): RythmeEnCours | null {
  const enCours = exerciceEnCours(series);
  if (!enCours || !enCours.jours) return null;
  const precedent = exercicesComplets(series).at(-1) ?? null;
  const ca = valeur(enCours, "agregat.chiffreAffaires");
  const caPrecedent = precedent ? valeur(precedent, "agregat.chiffreAffaires") : null;
  const caMensuel = ca === null ? null : (ca / enCours.jours) * JOURS_PAR_MOIS;
  const caMensuelPrecedent =
    caPrecedent === null || !precedent ? null : (caPrecedent / (precedent.jours ?? 365)) * JOURS_PAR_MOIS;
  return {
    exercice: enCours,
    mois: Math.max(1, Math.round(enCours.jours / JOURS_PAR_MOIS)),
    caMensuel,
    caMensuelPrecedent,
    ecart: caMensuel !== null && caMensuelPrecedent !== null ? variation(caMensuelPrecedent, caMensuel).taux : null,
    resultat: valeur(enCours, "derive.resultatNet"),
  };
}
