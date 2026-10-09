/**
 * Ce qu'une action a rapporté, en euros.
 *
 * Le plan d'action sait déjà où en est l'indicateur suivi : « délai clients
 * passé de 69 à 52 jours ». Ce module en fait la phrase qu'un cabinet peut
 * mettre devant son client — « 17 jours de ventes encaissés plus tôt, soit
 * 46 000 € de trésorerie » — et celle qu'il peut mettre devant lui-même pour
 * justifier ses honoraires.
 *
 * Chaque conversion se fait sur l'activité de la dernière période (ventes
 * ou achats par jour) : on mesure ce que l'amélioration vaut aujourd'hui, au
 * volume d'aujourd'hui. Les indicateurs qui ne se traduisent pas en euros
 * sans hypothèse supplémentaire (un ratio d'endettement, une couverture
 * d'intérêts) ne sont pas chiffrés : le cabinet peut saisir le gain qu'il
 * retient, l'outil ne l'invente pas.
 */

export type NatureGain = "tresorerie" | "resultat";

export interface ContexteGain {
  /** Activité de la dernière période. */
  chiffreAffaires: number;
  achatsConsommes: number;
  /** Durée de cette période, en jours. */
  jours: number;
}

export interface Gain {
  montant: number | null;
  nature: NatureGain | null;
  explication: string;
}

const JOURS_AN = 365;

function euros(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function jours(n: number): string {
  return `${Math.round(Math.abs(n))} jour${Math.round(Math.abs(n)) > 1 ? "s" : ""}`;
}

function pourcent(n: number): string {
  return `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function calculerGain(
  ratioId: string | null,
  initiale: number | null,
  actuelle: number | null,
  c: ContexteGain | null,
): Gain {
  if (!ratioId || initiale === null || actuelle === null || !c || c.jours <= 0) {
    return {
      montant: null,
      nature: null,
      explication: "Pas d'indicateur mesurable sur la dernière période : saisissez le gain retenu si vous le connaissez.",
    };
  }

  const ventesParJour = c.chiffreAffaires / c.jours;
  const achatsParJour = c.achatsConsommes / c.jours;
  const caAnnuel = (c.chiffreAffaires / c.jours) * JOURS_AN;

  switch (ratioId) {
    case "dso": {
      const gagnes = initiale - actuelle;
      return {
        montant: gagnes * ventesParJour,
        nature: "tresorerie",
        explication: `Délai clients de ${Math.round(initiale)} à ${Math.round(actuelle)} jours : ${jours(gagnes)} de ventes (${euros(ventesParJour)} par jour) ${gagnes >= 0 ? "encaissés plus tôt" : "encaissés plus tard"}.`,
      };
    }
    case "dio": {
      const gagnes = initiale - actuelle;
      return {
        montant: gagnes * achatsParJour,
        nature: "tresorerie",
        explication: `Stock de ${Math.round(initiale)} à ${Math.round(actuelle)} jours d'achats : ${jours(gagnes)} d'achats (${euros(achatsParJour)} par jour) ${gagnes >= 0 ? "libérés" : "immobilisés en plus"}.`,
      };
    }
    case "dpo": {
      const gagnes = actuelle - initiale;
      return {
        montant: gagnes * achatsParJour,
        nature: "tresorerie",
        explication: `Délai fournisseurs de ${Math.round(initiale)} à ${Math.round(actuelle)} jours : ${jours(gagnes)} d'achats (${euros(achatsParJour)} par jour) payés ${gagnes >= 0 ? "plus tard" : "plus tôt"}.`,
      };
    }
    case "bfr":
      return {
        montant: initiale - actuelle,
        nature: "tresorerie",
        explication: `Besoin en fonds de roulement de ${euros(initiale)} à ${euros(actuelle)}.`,
      };
    case "tresorerie_nette":
      return {
        montant: actuelle - initiale,
        nature: "tresorerie",
        explication: `Trésorerie nette de ${euros(initiale)} à ${euros(actuelle)}.`,
      };
    case "marge_ebitda":
    case "marge_nette":
    case "marge_brute":
      return {
        montant: (actuelle - initiale) * caAnnuel,
        nature: "resultat",
        explication: `Marge de ${pourcent(initiale)} à ${pourcent(actuelle)}, sur un chiffre d'affaires annuel de ${euros(caAnnuel)}.`,
      };
    default:
      return {
        montant: null,
        nature: null,
        explication: "Cet indicateur ne se traduit pas en euros sans hypothèse : saisissez le gain retenu si vous le connaissez.",
      };
  }
}
