import { Aggregates, Derived, RatioValue, computeDerived, computeRatios } from "../ratios/engine";

/**
 * Projection d'exercices à venir à partir d'hypothèses explicites.
 *
 * Deux partis pris gouvernent ce fichier.
 *
 * **Aucun chiffre projeté n'est sans cause.** Chaque ligne découle d'une
 * hypothèse que l'utilisateur a saisie et peut retrouver. Un prévisionnel
 * qu'on ne sait pas expliquer ne se défend pas devant un banquier, et ne sert
 * donc à rien — c'est précisément à ce moment-là qu'on en a besoin.
 *
 * **La trésorerie est la variable d'ajustement.** On projette le compte de
 * résultat, puis les postes de bilan pilotés par les hypothèses (délais,
 * investissements, emprunts), et la trésorerie est ce qui reste pour que le
 * bilan s'équilibre. C'est la méthode habituelle de la modélisation
 * financière, et elle a une vertu : le bilan projeté est équilibré par
 * construction, ce qu'un test vérifie. Une trésorerie négative n'est alors
 * pas une erreur de calcul mais un besoin de financement — l'information
 * qu'on vient précisément chercher.
 *
 * La sortie a la même forme qu'un exercice réel : mêmes agrégats, mêmes
 * calculs dérivés, mêmes ratios, par le même moteur. Le tableau de bord peut
 * donc tracer réalisé et projeté sur le même axe sans traitement particulier.
 */

export interface Hypotheses {
  /** Nombre d'exercices projetés, à partir du dernier réalisé. */
  horizon: number;
  /** Croissance annuelle du chiffre d'affaires, en taux (0,08 pour 8 %). */
  croissanceCa: number;
  /** Achats consommés en part du chiffre d'affaires. */
  partAchats: number;
  /** Impôts et taxes en part du chiffre d'affaires. */
  partImpotsTaxes: number;
  /** Croissance annuelle des charges externes, appliquée au dernier réalisé. */
  croissanceChargesExternes: number;
  /** Croissance annuelle des charges de personnel. */
  croissanceChargesPersonnel: number;
  /** Délai de règlement client, en jours. */
  dso: number;
  /** Délai de règlement fournisseur, en jours. */
  dpo: number;
  /** Durée de détention du stock, en jours. */
  dio: number;
  /** Investissements de l'exercice, en devise. */
  investissements: number;
  /** Durée d'amortissement des immobilisations, en années. */
  dureeAmortissement: number;
  /** Emprunts nouveaux encaissés dans l'exercice. */
  nouveauxEmprunts: number;
  /** Remboursements de capital de l'exercice. */
  remboursements: number;
  /** Taux d'intérêt appliqué à l'encours de dette d'ouverture. */
  tauxInteret: number;
  /** Taux d'impôt sur les sociétés. */
  tauxIS: number;
  /** Dividendes distribués, prélevés sur les capitaux propres. */
  dividendes: number;
}

export const HYPOTHESES_PAR_DEFAUT: Hypotheses = {
  horizon: 3,
  croissanceCa: 0.05,
  partAchats: 0.4,
  partImpotsTaxes: 0.01,
  croissanceChargesExternes: 0.02,
  croissanceChargesPersonnel: 0.03,
  dso: 45,
  dpo: 45,
  dio: 30,
  investissements: 0,
  dureeAmortissement: 5,
  nouveauxEmprunts: 0,
  remboursements: 0,
  tauxInteret: 0.04,
  // Taux normal de l'impôt sur les sociétés en France. Le taux réduit de 15 %
  // s'applique sous conditions que ce moteur ne connaît pas : il est à saisir.
  tauxIS: 0.25,
  dividendes: 0,
};

/** Jours d'un exercice plein. Les délais saisis s'y rapportent. */
const JOURS_EXERCICE = 365;

export interface ExerciceProjete {
  annee: number;
  label: string;
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
  /**
   * Trésorerie manquante pour équilibrer le bilan, le cas échéant.
   *
   * Nulle quand la trésorerie projetée est positive. Sinon, c'est le montant
   * qu'il faut trouver — en emprunt, en apport, ou en réduisant le besoin en
   * fonds de roulement. On l'expose séparément pour que l'écran le dise au
   * lieu d'afficher un solde négatif que l'œil prend pour une coquille.
   */
  besoinFinancement: number;
}

/** Ce que le prévisionnel prend comme point de départ : le dernier réalisé. */
export interface PointDeDepart {
  annee: number;
  aggregates: Aggregates;
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/**
 * Projette un exercice à partir du précédent.
 *
 * Isolée parce qu'elle contient tout le modèle, et qu'on doit pouvoir la lire
 * d'un bout à l'autre : l'ordre des lignes est celui dans lequel un
 * prévisionnel se construit à la main.
 */
function projeterUnExercice(
  precedent: Aggregates,
  h: Hypotheses,
  rangChargesFixes: number,
  chargesExternesBase: number,
  chargesPersonnelBase: number
): Aggregates {
  // 1. Compte de résultat.
  const chiffreAffaires = precedent.chiffreAffaires * (1 + h.croissanceCa);
  const achatsConsommes = chiffreAffaires * h.partAchats;
  const chargesExternes = chargesExternesBase * (1 + h.croissanceChargesExternes) ** rangChargesFixes;
  const chargesPersonnel =
    chargesPersonnelBase * (1 + h.croissanceChargesPersonnel) ** rangChargesFixes;
  const impotsTaxes = chiffreAffaires * h.partImpotsTaxes;

  /* L'amortissement porte sur l'encours d'ouverture augmenté de
   * l'investissement de l'exercice : une approximation assumée, qui évite de
   * tenir un plan d'amortissement par immobilisation — hors de portée d'un
   * prévisionnel saisi en dix champs. */
  const assiette = precedent.immobilisations + h.investissements;
  const dotationsAmortissements =
    h.dureeAmortissement > 0 ? Math.min(assiette, assiette / h.dureeAmortissement) : 0;

  // Les intérêts portent sur l'encours d'ouverture : la dette nouvelle de
  // l'exercice n'a pas couru toute l'année.
  const chargesFinancieres = precedent.dettesFinancieres * h.tauxInteret;

  const resultatAvantImpot =
    chiffreAffaires -
    achatsConsommes -
    chargesExternes -
    chargesPersonnel -
    impotsTaxes -
    dotationsAmortissements -
    chargesFinancieres;

  // Pas d'impôt sur une perte. Les reports déficitaires ne sont pas modélisés :
  // les ignorer surestime l'impôt des exercices suivant une perte, ce qui est
  // l'erreur prudente.
  const impotSocietes = resultatAvantImpot > 0 ? resultatAvantImpot * h.tauxIS : 0;
  const resultatNet = resultatAvantImpot - impotSocietes;

  // 2. Postes de bilan pilotés par les hypothèses.
  const creancesClients = (chiffreAffaires * h.dso) / JOURS_EXERCICE;
  const dettesFournisseurs = (achatsConsommes * h.dpo) / JOURS_EXERCICE;
  const stocks = (achatsConsommes * h.dio) / JOURS_EXERCICE;

  const immobilisations = Math.max(
    0,
    precedent.immobilisations + h.investissements - dotationsAmortissements
  );
  const dettesFinancieres = Math.max(
    0,
    precedent.dettesFinancieres + h.nouveauxEmprunts - h.remboursements
  );
  const capitauxPropres = precedent.capitauxPropres + resultatNet - h.dividendes;

  /* Postes qu'aucune hypothèse ne pilote : on les reconduit tels quels plutôt
   * que de les mettre à zéro, ce qui créerait une variation de trésorerie
   * fictive dès le premier exercice projeté. */
  const autresCreances = precedent.autresCreances;
  const autresDettes = precedent.autresDettes;

  /*
   * 3. La trésorerie équilibre le bilan — calculée sur les postes **déjà
   * arrondis**.
   *
   * L'ordre compte. Calculer la trésorerie sur les valeurs exactes puis
   * arrondir les vingt postes laisse un écart de bilan de quelques centimes :
   * chaque arrondi déplace un peu, et la variable d'ajustement n'ajuste plus
   * rien. Un centime d'écart n'a aucune portée comptable, mais il fait mentir
   * l'invariant du modèle — et c'est l'invariant qui garantit que le reste
   * est juste.
   */
  const bilan = {
    stocks: arrondir(stocks),
    creancesClients: arrondir(creancesClients),
    autresCreances: arrondir(autresCreances),
    capitauxPropres: arrondir(capitauxPropres),
    dettesFinancieres: arrondir(dettesFinancieres),
    dettesFournisseurs: arrondir(dettesFournisseurs),
    autresDettes: arrondir(autresDettes),
    immobilisations: arrondir(immobilisations),
  };

  const disponibilites = arrondir(
    bilan.capitauxPropres +
      bilan.dettesFinancieres +
      bilan.dettesFournisseurs +
      bilan.autresDettes -
      bilan.immobilisations -
      bilan.stocks -
      bilan.creancesClients -
      bilan.autresCreances
  );

  return {
    chiffreAffaires: arrondir(chiffreAffaires),
    achatsConsommes: arrondir(achatsConsommes),
    chargesExternes: arrondir(chargesExternes),
    chargesPersonnel: arrondir(chargesPersonnel),
    impotsTaxes: arrondir(impotsTaxes),
    dotationsAmortissements: arrondir(dotationsAmortissements),
    autresProduitsChargesExploitation: 0,
    chargesFinancieres: arrondir(chargesFinancieres),
    produitsFinanciers: 0,
    resultatExceptionnel: 0,
    resultatCessions: 0,
    impotSocietes: arrondir(impotSocietes),
    disponibilites,
    ...bilan,
  };
}

export function projeter(depart: PointDeDepart, hypotheses: Hypotheses): ExerciceProjete[] {
  const horizon = Math.max(0, Math.min(10, Math.trunc(hypotheses.horizon)));
  const exercices: ExerciceProjete[] = [];

  /*
   * `precedent` porte toujours l'exercice qui précède immédiatement celui
   * qu'on projette : le dernier réalisé au premier tour, puis le projeté du
   * tour d'avant. C'est aussi la référence que `computeRatios` attend pour la
   * croissance — une variable de plus, décalée d'un cran, faisait lire au
   * deuxième exercice une croissance cumulée depuis le départ.
   */
  let precedent = depart.aggregates;

  for (let rang = 1; rang <= horizon; rang += 1) {
    const aggregates = projeterUnExercice(
      precedent,
      hypotheses,
      rang,
      depart.aggregates.chargesExternes,
      depart.aggregates.chargesPersonnel
    );
    const derived = computeDerived(aggregates);
    const ratios = computeRatios(aggregates, derived, { aggregates: precedent }, JOURS_EXERCICE);

    exercices.push({
      annee: depart.annee + rang,
      label: String(depart.annee + rang),
      aggregates,
      derived,
      ratios,
      besoinFinancement: aggregates.disponibilites < 0 ? -aggregates.disponibilites : 0,
    });

    precedent = aggregates;
  }

  return exercices;
}

/**
 * Ramène des hypothèses venues du client dans des bornes où le modèle garde
 * un sens.
 *
 * Une part d'achats de 400 % ou un délai client de 10 000 jours ne sont pas
 * des scénarios, ce sont des saisies fautives. Les accepter produirait un
 * prévisionnel absurde présenté avec le même aplomb qu'un bon.
 */
export function assainirHypotheses(brut: Partial<Hypotheses>): Hypotheses {
  const borne = (valeur: number | undefined, defaut: number, min: number, max: number): number => {
    if (valeur === undefined || !Number.isFinite(valeur)) return defaut;
    return Math.min(max, Math.max(min, valeur));
  };
  const d = HYPOTHESES_PAR_DEFAUT;

  return {
    horizon: Math.trunc(borne(brut.horizon, d.horizon, 1, 10)),
    croissanceCa: borne(brut.croissanceCa, d.croissanceCa, -0.9, 3),
    partAchats: borne(brut.partAchats, d.partAchats, 0, 2),
    partImpotsTaxes: borne(brut.partImpotsTaxes, d.partImpotsTaxes, 0, 1),
    croissanceChargesExternes: borne(brut.croissanceChargesExternes, d.croissanceChargesExternes, -0.9, 3),
    croissanceChargesPersonnel: borne(
      brut.croissanceChargesPersonnel,
      d.croissanceChargesPersonnel,
      -0.9,
      3
    ),
    dso: borne(brut.dso, d.dso, 0, 365),
    dpo: borne(brut.dpo, d.dpo, 0, 365),
    dio: borne(brut.dio, d.dio, 0, 365),
    investissements: borne(brut.investissements, d.investissements, 0, 1e12),
    dureeAmortissement: borne(brut.dureeAmortissement, d.dureeAmortissement, 1, 50),
    nouveauxEmprunts: borne(brut.nouveauxEmprunts, d.nouveauxEmprunts, 0, 1e12),
    remboursements: borne(brut.remboursements, d.remboursements, 0, 1e12),
    tauxInteret: borne(brut.tauxInteret, d.tauxInteret, 0, 1),
    tauxIS: borne(brut.tauxIS, d.tauxIS, 0, 1),
    dividendes: borne(brut.dividendes, d.dividendes, 0, 1e12),
  };
}
