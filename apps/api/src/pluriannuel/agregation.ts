import {
  Aggregates,
  Derived,
  RatioValue,
  computeDerived,
  computeRatios,
} from "../ratios/engine";

/**
 * Regroupement de plusieurs périodes en exercices.
 *
 * C'est le fichier où l'on peut fabriquer des chiffres faux qui ont l'air
 * justes, et il n'y a qu'une façon de l'éviter : distinguer trois natures de
 * grandeur, parce qu'elles ne s'agrègent pas de la même manière.
 *
 * **Les flux se somment.** Un chiffre d'affaires annuel est la somme des
 * douze mois. Évident, et c'est la seule des trois à l'être.
 *
 * **Les stocks ne se somment pas.** La trésorerie au 31 décembre n'est pas la
 * somme des douze soldes mensuels — ce serait douze fois trop. C'est le solde
 * du dernier mois. Sommer un poste de bilan est l'erreur classique, et elle
 * produit un total si gros qu'on la remarque ; la variante discrète est d'en
 * faire une moyenne, qui donne un nombre crédible et faux.
 *
 * **Les ratios ne s'agrègent pas du tout : ils se recalculent.** La marge
 * annuelle n'est pas la moyenne des marges mensuelles. Un mois à 1 000 € de
 * CA et 50 % de marge, un mois à 100 000 € et 10 % : la moyenne des marges
 * donne 30 %, la vraie marge annuelle est 10,4 %. On reconstruit donc les
 * agrégats de l'exercice, puis on repasse par le même moteur que pour une
 * période — jamais par une moyenne.
 */

/** Postes de compte de résultat : ils se somment sur l'exercice. */
export const POSTES_FLUX = [
  "chiffreAffaires",
  "achatsConsommes",
  "chargesExternes",
  "chargesPersonnel",
  "impotsTaxes",
  "dotationsAmortissements",
  "autresProduitsChargesExploitation",
  "chargesFinancieres",
  "produitsFinanciers",
  "resultatExceptionnel",
  "resultatCessions",
  "impotSocietes",
] as const satisfies readonly (keyof Aggregates)[];

/** Postes de bilan : on retient la clôture, jamais la somme ni la moyenne. */
export const POSTES_STOCK = [
  "stocks",
  "creancesClients",
  "autresCreances",
  "disponibilites",
  "capitauxPropres",
  "dettesFinancieres",
  "dettesFournisseurs",
  "autresDettes",
  "immobilisations",
] as const satisfies readonly (keyof Aggregates)[];

export interface PeriodeSource {
  id: string;
  label: string;
  debut: Date;
  fin: Date;
  aggregates: Aggregates;
}

export interface Exercice {
  /** Millésime : l'année de la date de clôture. */
  annee: number;
  label: string;
  debut: Date;
  fin: Date;
  /** Périodes réunies, dans l'ordre. Sert à dire ce qui a été agrégé. */
  periodes: string[];
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
  /**
   * Faux quand l'exercice ne couvre pas douze mois.
   *
   * Un exercice incomplet n'est pas une erreur — c'est le cas de l'année en
   * cours, et de la première année d'une entreprise. Mais ses flux ne se
   * comparent pas à ceux d'une année pleine, et les délais calculés dessus
   * sont faussés si on les rapporte à 365 jours. L'écran doit pouvoir le
   * signaler plutôt que de laisser croire à une chute d'activité.
   */
  complet: boolean;
  joursCouverts: number;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours couverts, bornes incluses. */
export function joursEntre(debut: Date, fin: Date): number {
  return Math.round((fin.getTime() - debut.getTime()) / JOUR_MS) + 1;
}

function agregatsVides(): Aggregates {
  const vide = {} as Aggregates;
  for (const poste of [...POSTES_FLUX, ...POSTES_STOCK]) vide[poste] = 0;
  return vide;
}

/**
 * Réunit les périodes d'un même exercice.
 *
 * `periodes` doit être trié par date de début ; la clôture est prise sur la
 * dernière, ce qui n'a de sens que si l'ordre est respecté. On trie donc ici
 * plutôt que de faire confiance à l'appelant.
 */
export function reunirExercice(periodes: PeriodeSource[]): Aggregates {
  const triees = [...periodes].sort((a, b) => a.debut.getTime() - b.debut.getTime());
  const total = agregatsVides();

  for (const periode of triees) {
    for (const poste of POSTES_FLUX) total[poste] += periode.aggregates[poste];
  }

  const cloture = triees[triees.length - 1];
  if (cloture) {
    for (const poste of POSTES_STOCK) total[poste] = cloture.aggregates[poste];
  }

  return total;
}

/**
 * Millésime d'une période : l'année de sa clôture.
 *
 * Un exercice décalé — du 1er juillet au 30 juin — porte le millésime de son
 * année de clôture, comme le veut l'usage comptable. Prendre l'année
 * d'ouverture scinderait chaque exercice décalé en deux.
 */
export function millesime(periode: { fin: Date }): number {
  return periode.fin.getUTCFullYear();
}

/**
 * Construit la suite des exercices à partir des périodes d'une entité.
 *
 * Les ratios de chaque exercice sont recalculés par le moteur, avec
 * l'exercice précédent en référence — c'est ce qui permet à la croissance du
 * chiffre d'affaires d'être annuelle et non mensuelle.
 */
export function construireExercices(periodes: PeriodeSource[]): Exercice[] {
  const parAnnee = new Map<number, PeriodeSource[]>();
  for (const periode of periodes) {
    const annee = millesime(periode);
    const lot = parAnnee.get(annee);
    if (lot) lot.push(periode);
    else parAnnee.set(annee, [periode]);
  }

  const annees = [...parAnnee.keys()].sort((a, b) => a - b);
  const exercices: Exercice[] = [];

  for (const annee of annees) {
    const lot = [...parAnnee.get(annee)!].sort((a, b) => a.debut.getTime() - b.debut.getTime());
    const aggregates = reunirExercice(lot);
    const derived = computeDerived(aggregates);

    const debut = lot[0].debut;
    const fin = lot[lot.length - 1].fin;
    const joursCouverts = joursEntre(debut, fin);

    /*
     * Les délais (DSO, DPO, DIO) rapportent un encours à un flux sur une
     * durée. Passer 365 jours à un exercice qui n'en couvre que 90 donnerait
     * un DSO quatre fois trop élevé — un chiffre alarmant et faux. On passe
     * donc la durée réellement couverte.
     */
    const precedent = exercices[exercices.length - 1];
    const ratios = computeRatios(
      aggregates,
      derived,
      precedent ? { aggregates: precedent.aggregates } : null,
      joursCouverts
    );

    exercices.push({
      annee,
      label: String(annee),
      debut,
      fin,
      periodes: lot.map((p) => p.label),
      aggregates,
      derived,
      ratios,
      // 350 jours et non 365 : un exercice du 1er janvier au 31 décembre
      // couvre 365 jours, mais douze périodes mensuelles importées peuvent
      // laisser des trous de quelques jours sans cesser d'être une année.
      complet: joursCouverts >= 350,
      joursCouverts,
    });
  }

  return exercices;
}
