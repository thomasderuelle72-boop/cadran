/**
 * L'état d'un dossier dans le portefeuille du cabinet.
 *
 * Quatre états, et pour chacun les motifs qui l'ont produit. Les motifs ne
 * sont pas un ornement : un badge « critique » sans raison écrite envoie le
 * collaborateur ouvrir le dossier pour comprendre, et dans un portefeuille de
 * quarante dossiers, c'est précisément ce qu'on veut lui épargner. Un état se
 * lit aussi sans couleur — le libellé et la phrase disent tout.
 *
 * Les règles sont volontairement peu nombreuses et vérifiables à la main. Un
 * score composite pondéré serait plus fin et beaucoup moins défendable : le
 * jour où un client demande pourquoi son dossier est rouge, la réponse doit
 * tenir en une ligne.
 */

export type EtatDossier = "critique" | "a_surveiller" | "sain" | "incomplet";

export interface FaitsDossier {
  /** Faux quand aucun exercice complet n'a encore été importé. */
  aDesDonnees: boolean;
  /** Périodes importées, complètes ou non : distingue « rien » de « pas assez ». */
  periodesImportees: number;
  capitauxPropres: number | null;
  tresorerieNette: number | null;
  resultatNet: number | null;
  /** Alertes déclenchées sur une règle active et pas encore acquittées. */
  alertesOuvertes: number;
  /** Actions à faire ou en cours dont l'échéance est passée. */
  actionsEnRetard: number;
  /** Mois écoulés depuis la fin de la dernière période importée. */
  moisDepuisDernieresDonnees: number | null;
}

export interface EvaluationDossier {
  etat: EtatDossier;
  /** Du plus grave au moins grave. Vide pour un dossier sain. */
  motifs: string[];
}

/**
 * Au-delà, les données ne disent plus rien de la situation présente.
 *
 * Treize mois et non douze : un cabinet qui importe les comptes annuels les
 * reçoit quelques semaines après la clôture. À douze mois, chaque dossier
 * passerait « à surveiller » la veille de son import annuel.
 */
export const MOIS_AVANT_DONNEES_ANCIENNES = 13;

function pluriel(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

export function evaluerDossier(faits: FaitsDossier): EvaluationDossier {
  if (!faits.aDesDonnees) {
    /*
     * « Aucune donnée » et « pas encore d'exercice complet » ne demandent pas
     * le même geste : le premier, un import ; le second, d'attendre la fin de
     * l'exercice ou de compléter les périodes manquantes. Les confondre
     * enverrait réimporter un dossier qui a déjà tout ce qu'il peut avoir.
     */
    return {
      etat: "incomplet",
      motifs: [
        faits.periodesImportees === 0
          ? "Aucune donnée importée"
          : `Pas encore d'exercice complet — ${pluriel(faits.periodesImportees, "période importée", "périodes importées")}`,
      ],
    };
  }

  const critiques: string[] = [];
  const aSurveiller: string[] = [];

  /*
   * Critique : ce qui menace la continuité, pas ce qui déçoit.
   *
   * Des capitaux propres négatifs imposent à une SAS ou une SARL de statuer
   * sur la poursuite de l'activité ; une trésorerie nette négative veut dire
   * que l'entreprise vit sur ses concours bancaires courants. Une perte, à
   * elle seule, n'en est pas là.
   */
  if (faits.capitauxPropres !== null && faits.capitauxPropres < 0) {
    critiques.push("Capitaux propres négatifs");
  }
  if (faits.tresorerieNette !== null && faits.tresorerieNette < 0) {
    critiques.push("Trésorerie nette négative");
  }

  if (faits.resultatNet !== null && faits.resultatNet < 0) {
    aSurveiller.push("Dernier exercice déficitaire");
  }
  if (faits.alertesOuvertes > 0) {
    aSurveiller.push(pluriel(faits.alertesOuvertes, "alerte non traitée", "alertes non traitées"));
  }
  if (faits.actionsEnRetard > 0) {
    aSurveiller.push(pluriel(faits.actionsEnRetard, "action en retard", "actions en retard"));
  }
  if (
    faits.moisDepuisDernieresDonnees !== null &&
    faits.moisDepuisDernieresDonnees > MOIS_AVANT_DONNEES_ANCIENNES
  ) {
    aSurveiller.push(`Dernières données il y a ${faits.moisDepuisDernieresDonnees} mois`);
  }

  if (critiques.length > 0) return { etat: "critique", motifs: [...critiques, ...aSurveiller] };
  if (aSurveiller.length > 0) return { etat: "a_surveiller", motifs: aSurveiller };
  return { etat: "sain", motifs: [] };
}

/** Mois entiers écoulés entre deux dates, arrondis à l'inférieur. */
export function moisEntre(debut: Date, fin: Date): number {
  const mois =
    (fin.getUTCFullYear() - debut.getUTCFullYear()) * 12 + (fin.getUTCMonth() - debut.getUTCMonth());
  return fin.getUTCDate() < debut.getUTCDate() ? Math.max(mois - 1, 0) : Math.max(mois, 0);
}
