/**
 * Scores de fragilité financière.
 *
 * Deux modèles statistiques publiés, calculés à partir des agrégats déjà
 * présents. Ils ne prédisent rien : ce sont des indices, à confronter au
 * reste du diagnostic.
 *
 * Trois précautions sont intégrées au résultat plutôt que laissées à
 * l'interprétation :
 *
 *   1. chaque composante est renvoyée avec sa formule, sa valeur, son
 *      coefficient et sa contribution au total — le score est auditable,
 *      pas une boîte noire ;
 *   2. le domaine de calibration de chaque modèle est explicite, et une
 *      entreprise qui en sort est signalée ;
 *   3. un score dont une composante n'est pas calculable est rendu
 *      indisponible avec son motif, jamais approché en silence.
 *
 * Module pur.
 */

import type { Aggregates, Derived } from "../ratios/engine";

export type ZoneScore = "sain" | "incertain" | "danger" | "indisponible";

export interface ComposanteScore {
  id: string;
  label: string;
  formule: string;
  valeur: number | null;
  coefficient: number;
  /** Coefficient × valeur : ce que la composante pèse dans le total. */
  contribution: number | null;
}

export interface ScoreRisque {
  id: string;
  label: string;
  source: string;
  valeur: number | null;
  zone: ZoneScore;
  /** Bornes de la zone grise : en dessous, danger ; au-dessus, sain. */
  seuilDanger: number;
  seuilSain: number;
  composantes: ComposanteScore[];
  /** Ce que le modèle ne sait pas faire. Toujours affiché à côté du score. */
  limites: string;
  /** Renseigné quand l'entreprise sort du domaine sur lequel le modèle a été calibré. */
  avertissementCalibration: string | null;
  /** Renseigné quand le score n'a pas pu être calculé, avec la raison. */
  motifIndisponibilite: string | null;
}

export interface EntreesScores {
  aggregates: Aggregates;
  derived: Derived;
  /**
   * Réserves et report à nouveau, hors capital social et hors résultat de la
   * période. Le modèle d'Altman en a besoin : c'est la mesure de ce que
   * l'entreprise a accumulé par elle-même plutôt que reçu de ses associés.
   * Les vingt postes normalisés ne permettent pas de l'isoler — seul le
   * détail d'un grand livre le donne (comptes 106, 11 et 12).
   */
  reservesEtReportANouveau?: number | null;
  /**
   * Nombre de jours couverts par la période. Sert à annualiser les flux avant
   * de les rapporter à un poste de bilan ; à défaut, un exercice est supposé.
   */
  joursPeriode?: number;
}

function zone(valeur: number, seuilDanger: number, seuilSain: number): ZoneScore {
  if (valeur < seuilDanger) return "danger";
  if (valeur > seuilSain) return "sain";
  return "incertain";
}

function diviser(numerateur: number, denominateur: number): number | null {
  return denominateur === 0 ? null : numerateur / denominateur;
}

function arrondi(valeur: number): number {
  const arrondie = Math.round(valeur * 10000) / 10000;
  return arrondie === 0 ? 0 : arrondie;
}

/**
 * Ramène un flux à son équivalent annuel.
 *
 * Les deux modèles ont été établis sur des exercices complets, et plusieurs de
 * leurs composantes rapportent un flux (chiffre d'affaires, résultat, excédent
 * brut) à un stock de bilan. Appliquées telles quelles à un mois, elles
 * divisent ce rapport par douze et classent en danger une entreprise saine.
 * Toute composante mêlant flux et stock passe donc par ici ; celles qui
 * rapportent un flux à un autre flux sont invariantes et n'y passent pas.
 */
function annualiser(flux: number, joursPeriode: number | undefined): number {
  const jours = joursPeriode && joursPeriode > 0 ? joursPeriode : 365;
  return (flux * 365) / jours;
}

/** Compose un score à partir de ses composantes, ou l'écarte si l'une manque. */
function assembler(
  base: Omit<ScoreRisque, "valeur" | "zone" | "contribution" | "motifIndisponibilite">,
  motifSiIncalculable: string
): ScoreRisque {
  const manquante = base.composantes.find((c) => c.valeur === null);
  if (manquante) {
    return {
      ...base,
      valeur: null,
      zone: "indisponible",
      motifIndisponibilite: `${motifSiIncalculable} (${manquante.label} non calculable).`,
    };
  }

  const total = base.composantes.reduce((somme, c) => somme + (c.contribution ?? 0), 0);
  return {
    ...base,
    valeur: arrondi(total),
    zone: zone(total, base.seuilDanger, base.seuilSain),
    motifIndisponibilite: null,
  };
}

function composante(
  id: string,
  label: string,
  formule: string,
  valeur: number | null,
  coefficient: number
): ComposanteScore {
  return {
    id,
    label,
    formule,
    valeur: valeur === null ? null : arrondi(valeur),
    coefficient,
    contribution: valeur === null ? null : arrondi(valeur * coefficient),
  };
}

/**
 * Z' d'Altman (1983), la variante destinée aux sociétés non cotées : la
 * valeur comptable des capitaux propres y remplace la capitalisation
 * boursière, ce qui la rend applicable à une PME française.
 */
export function scoreAltman(entrees: EntreesScores): ScoreRisque {
  const { aggregates: a, derived: d } = entrees;

  const dettesTotales = a.dettesFinancieres + a.dettesFournisseurs + a.autresDettes;
  const fondsDeRoulementNet = d.actifCirculant - d.passifCirculant;

  const caAnnualise = annualiser(a.chiffreAffaires, entrees.joursPeriode);
  const ebitAnnualise = annualiser(d.ebit, entrees.joursPeriode);

  const composantes = [
    composante(
      "x1",
      "Fonds de roulement net / total actif",
      "(actif circulant − passif circulant) / total actif",
      diviser(fondsDeRoulementNet, d.totalActif),
      0.717
    ),
    composante(
      "x2",
      "Réserves accumulées / total actif",
      "(réserves + report à nouveau) / total actif",
      entrees.reservesEtReportANouveau === null || entrees.reservesEtReportANouveau === undefined
        ? null
        : diviser(entrees.reservesEtReportANouveau, d.totalActif),
      0.847
    ),
    composante(
      "x3",
      "Résultat d'exploitation / total actif",
      "EBIT annualisé / total actif",
      diviser(ebitAnnualise, d.totalActif),
      3.107
    ),
    composante(
      "x4",
      "Capitaux propres / dettes totales",
      "capitaux propres (valeur comptable) / dettes totales",
      diviser(a.capitauxPropres, dettesTotales),
      0.42
    ),
    composante(
      "x5",
      "Rotation de l'actif",
      "chiffre d'affaires annualisé / total actif",
      diviser(caAnnualise, d.totalActif),
      0.998
    ),
  ];

  return assembler(
    {
      id: "altman_z_prime",
      label: "Z' d'Altman",
      source: "Altman (1983), variante pour sociétés non cotées",
      seuilDanger: 1.23,
      seuilSain: 2.9,
      composantes,
      limites:
        "Calibré sur des industrielles américaines des années 1960-1980. Il mesure une structure, pas une trésorerie : une entreprise saine au sens du score peut manquer de liquidités le mois suivant.",
      avertissementCalibration: null,
    },
    "Le Z' d'Altman demande les réserves accumulées, que seul le détail d'un grand livre permet d'isoler"
  );
}

/** Domaine de calibration du modèle Conan & Holder, en chiffre d'affaires annuel. */
const CONAN_HOLDER_CA_MIN = 1_500_000;
const CONAN_HOLDER_CA_MAX = 75_000_000;

/**
 * Score de Conan & Holder (1979), construit sur des entreprises
 * industrielles françaises. Contrairement au Z', il fait une place explicite
 * au coût de la dette et au partage de la valeur ajoutée — deux angles très
 * français, qui expliquent qu'il soit encore enseigné.
 */
export function scoreConanHolder(entrees: EntreesScores): ScoreRisque {
  const { aggregates: a, derived: d } = entrees;

  const dettesTotales = a.dettesFinancieres + a.dettesFournisseurs + a.autresDettes;
  const realisableDisponible = a.creancesClients + a.autresCreances + a.disponibilites;
  const valeurAjoutee = a.chiffreAffaires - a.achatsConsommes - a.chargesExternes;

  const caAnnualise = annualiser(a.chiffreAffaires, entrees.joursPeriode);
  const ebeAnnualise = annualiser(d.ebitda, entrees.joursPeriode);

  const composantes = [
    composante(
      "r1",
      "Excédent brut d'exploitation / dettes totales",
      "EBE annualisé / (dettes financières + fournisseurs + autres dettes)",
      diviser(ebeAnnualise, dettesTotales),
      0.24
    ),
    composante(
      "r2",
      "Capitaux permanents / total actif",
      "(capitaux propres + dettes financières) / total actif",
      diviser(d.ressourcesStables, d.totalActif),
      0.22
    ),
    composante(
      "r3",
      "Réalisable et disponible / total actif",
      "(créances + disponibilités) / total actif",
      diviser(realisableDisponible, d.totalActif),
      0.16
    ),
    composante(
      "r4",
      "Charges financières / chiffre d'affaires",
      "charges financières / chiffre d'affaires",
      diviser(a.chargesFinancieres, a.chiffreAffaires),
      -0.87
    ),
    composante(
      "r5",
      "Charges de personnel / valeur ajoutée",
      "charges de personnel / valeur ajoutée",
      diviser(a.chargesPersonnel, valeurAjoutee),
      -0.1
    ),
  ];

  const horsDomaine =
    caAnnualise > 0 && (caAnnualise < CONAN_HOLDER_CA_MIN || caAnnualise > CONAN_HOLDER_CA_MAX);

  return assembler(
    {
      id: "conan_holder",
      label: "Score de Conan & Holder",
      source:
        "Conan & Holder (1979), établi sur 190 PME industrielles françaises. Coefficients 0,24 / 0,22 / 0,16 / −0,87 / −0,10.",
      // Les seuils publiés s'expriment en pourcentage du score : danger
      // au-dessous de 4 %, prudence entre 4 et 9 %, stabilité au-delà. Les
      // porter en unités, comme on le lit parfois, classerait en danger toute
      // entreprise quelle que soit sa santé — le score lui-même dépasse
      // rarement 1.
      seuilDanger: 0.04,
      seuilSain: 0.09,
      composantes,
      limites:
        "Modèle de 1979, établi sur un échantillon de PME industrielles françaises pour un horizon de trois ans. Les publications divergent sur le premier ratio — excédent brut ici, résultat d'exploitation ailleurs : chaque composante est affichée avec son coefficient pour que le calcul reste vérifiable.",
      avertissementCalibration: horsDomaine
        ? `Calibré sur des entreprises réalisant de 1,5 à 75 M€ de chiffre d'affaires annuel ; celle-ci est à ${Math.round(caAnnualise).toLocaleString("fr-FR")} €. Le score se calcule, mais sort du domaine du modèle.`
        : null,
    },
    "Le score de Conan & Holder n'est pas calculable"
  );
}

export interface Diagnostic {
  scores: ScoreRisque[];
  /**
   * Lecture d'ensemble. Deux modèles qui convergent valent mieux qu'un seul,
   * et deux modèles qui divergent sont eux-mêmes une information : ils ne
   * regardent pas la même chose.
   */
  convergence: "convergente" | "divergente" | "partielle";
  commentaire: string;
}

export function computeDiagnostic(entrees: EntreesScores): Diagnostic {
  const scores = [scoreAltman(entrees), scoreConanHolder(entrees)];
  const calcules = scores.filter((s) => s.zone !== "indisponible");

  if (calcules.length === 0) {
    return {
      scores,
      convergence: "partielle",
      commentaire: "Aucun des deux modèles n'est calculable sur les données disponibles.",
    };
  }

  if (calcules.length === 1) {
    return {
      scores,
      convergence: "partielle",
      commentaire: `Un seul modèle est calculable (${calcules[0].label}) : à confronter au reste du diagnostic plutôt qu'à prendre pour lui-même.`,
    };
  }

  const zones = new Set(calcules.map((s) => s.zone));
  if (zones.size === 1) {
    const commune = calcules[0].zone;
    const texte =
      commune === "sain"
        ? "Les deux modèles situent l'entreprise en zone saine. C'est un indice de solidité structurelle, pas une garantie de trésorerie."
        : commune === "danger"
          ? "Les deux modèles situent l'entreprise en zone de danger. Deux lectures indépendantes qui convergent méritent qu'on reprenne la structure de financement."
          : "Les deux modèles situent l'entreprise en zone grise : aucun signal franc, dans un sens ou dans l'autre.";
    return { scores, convergence: "convergente", commentaire: texte };
  }

  return {
    scores,
    convergence: "divergente",
    commentaire:
      "Les deux modèles divergent. Ils ne pèsent pas les mêmes choses — Altman la structure de bilan, Conan & Holder le coût de la dette et le partage de la valeur ajoutée : regardez laquelle des deux lectures correspond à la situation.",
  };
}
