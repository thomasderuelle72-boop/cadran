/**
 * Lecture de l'état d'abonnement.
 *
 * Le serveur renvoie un statut brut (« impaye ») et des dates ; cet écran
 * doit en faire une phrase que lit un dirigeant. La traduction vit ici,
 * séparée du composant, parce que c'est elle qui porte les décisions — un
 * accès encore ouvert malgré un impayé, un essai expiré, une résiliation
 * déjà demandée — et qu'une décision qu'on ne peut pas tester se vérifie à
 * l'œil, c'est-à-dire mal.
 */

export type StatutAbonnement = "essai" | "actif" | "impaye" | "resilie" | "incomplet";

export type PlanId = "essai" | "solo" | "cabinet" | "groupe";

export interface Quotas {
  entites: number | null;
  utilisateurs: number | null;
  periodes: number | null;
  consolidation: boolean;
  fec: boolean;
}

export interface EtatAbonnement {
  plan: { id: PlanId; label: string; promesse: string; quotas: Quotas };
  statut: StatutAbonnement;
  accesOuvert: boolean;
  demandeAction: boolean;
  finPeriode: string | null;
  resiliationDemandee: boolean;
  paiementDisponible: boolean;
  consommation: { entites: number; utilisateurs: number };
}

/** Gravité de l'état, qui commande la couleur ET le libellé — jamais la
 *  couleur seule : un bandeau rouge sans texte ne dit pas quoi faire. */
export type Ton = "neutre" | "attention" | "critique";

export interface LectureStatut {
  ton: Ton;
  titre: string;
  explication: string;
  /** Ce que l'utilisateur doit faire, s'il doit faire quelque chose. */
  action: string | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Jours restants, arrondis au supérieur.
 *
 * Au supérieur parce qu'il reste bien « 1 jour » tant que l'échéance n'est
 * pas passée : annoncer 0 jour à quelqu'un qui a encore six heures le
 * pousserait à payer dans la précipitation, ou à croire qu'il a perdu son
 * accès.
 */
export function joursRestants(finPeriode: string | null, maintenant: Date): number | null {
  if (!finPeriode) return null;
  const fin = new Date(finPeriode).getTime();
  if (Number.isNaN(fin)) return null;
  return Math.ceil((fin - maintenant.getTime()) / JOUR_MS);
}

export function dateLisible(valeur: string | null): string | null {
  if (!valeur) return null;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function lireStatut(etat: EtatAbonnement, maintenant: Date): LectureStatut {
  const jours = joursRestants(etat.finPeriode, maintenant);
  const date = dateLisible(etat.finPeriode);

  /* L'impayé passe avant tout le reste : c'est le seul cas où l'accès est
   * encore ouvert mais va se fermer, et où un geste de l'utilisateur
   * l'empêche. Le signaler après l'état du plan le noierait. */
  if (etat.statut === "impaye") {
    return {
      ton: "attention",
      titre: "Paiement en échec",
      explication:
        "Votre dernier prélèvement n'a pas abouti. Votre accès reste ouvert le temps que nous " +
        "réessayions, et vos données ne sont pas touchées.",
      action: "Mettre à jour le moyen de paiement",
    };
  }

  if (etat.statut === "incomplet") {
    return {
      ton: "attention",
      titre: "Souscription non finalisée",
      explication:
        "Le paiement a été entamé mais pas confirmé. Tant qu'il ne l'est pas, la formule " +
        "précédente reste en vigueur.",
      action: "Reprendre la souscription",
    };
  }

  if (etat.statut === "resilie") {
    return {
      ton: "critique",
      titre: "Abonnement terminé",
      explication: date
        ? `Votre accès a pris fin le ${date}. Vos données sont conservées trois mois.`
        : "Votre accès a pris fin. Vos données sont conservées trois mois.",
      action: "Choisir une formule",
    };
  }

  if (etat.statut === "essai") {
    if (jours !== null && jours <= 0) {
      return {
        ton: "critique",
        titre: "Essai terminé",
        explication:
          "La période d'essai est écoulée. Vos données sont conservées : choisir une formule " +
          "rouvre l'accès là où vous l'aviez laissé.",
        action: "Choisir une formule",
      };
    }
    return {
      ton: jours !== null && jours <= 3 ? "attention" : "neutre",
      titre:
        jours === null
          ? "Période d'essai"
          : `Essai — ${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""}`,
      explication: date
        ? `L'essai court jusqu'au ${date}. Aucun paiement ne sera prélevé : l'accès est simplement ` +
          "suspendu à son terme, jusqu'à ce que vous choisissiez une formule."
        : "Aucun paiement ne sera prélevé automatiquement à son terme.",
      action: null,
    };
  }

  /* actif */
  if (etat.resiliationDemandee) {
    return {
      ton: "attention",
      titre: "Résiliation enregistrée",
      explication: date
        ? `Votre abonnement prend fin le ${date}. Jusque-là, rien ne change : vous gardez tout.`
        : "Votre abonnement prendra fin au terme de la période en cours.",
      action: "Annuler la résiliation",
    };
  }

  return {
    ton: "neutre",
    titre: "Abonnement actif",
    explication: date
      ? `Prochaine échéance le ${date}.`
      : "Votre abonnement est en cours.",
    action: null,
  };
}

/**
 * Part du quota consommée, entre 0 et 1. `null` quand la formule est
 * illimitée — et c'est bien `null` et non 0 : une jauge vide laisserait
 * croire à une limite qu'on n'a pas encore approchée.
 */
export function partUtilisee(actuel: number, limite: number | null): number | null {
  if (limite === null) return null;
  if (limite <= 0) return 1;
  return Math.min(actuel / limite, 1);
}

export function quotaAtteint(actuel: number, limite: number | null): boolean {
  return limite !== null && actuel >= limite;
}

/** Ordre des formules, pour savoir si un changement monte ou descend. */
export const RANG: Record<PlanId, number> = { essai: 0, solo: 1, cabinet: 2, groupe: 3 };

export type SensChangement = "actuelle" | "superieure" | "inferieure";

export function sensChangement(courante: PlanId, cible: PlanId): SensChangement {
  if (courante === cible) return "actuelle";
  return RANG[cible] > RANG[courante] ? "superieure" : "inferieure";
}

/**
 * Libellé du bouton d'une formule.
 *
 * Il dépend de l'état et pas seulement de la formule visée : proposer
 * « Passer à Cabinet » à qui vient de résilier, ou « Revenir à Indépendant »
 * à qui n'a jamais payé, sont deux contresens.
 */
export function libelleBouton(
  etat: EtatAbonnement,
  cible: PlanId,
  maintenant: Date
): { texte: string; actif: boolean } {
  if (cible === "essai") {
    return { texte: "Accordé à l'inscription", actif: false };
  }

  const sens = sensChangement(etat.plan.id, cible);
  if (sens === "actuelle") {
    return { texte: "Votre formule", actif: false };
  }

  const essaiFini =
    etat.statut === "essai" && (joursRestants(etat.finPeriode, maintenant) ?? 1) <= 0;

  if (etat.statut === "resilie" || essaiFini || etat.statut === "essai") {
    return { texte: "Choisir cette formule", actif: true };
  }

  return {
    texte: sens === "superieure" ? "Passer à cette formule" : "Revenir à cette formule",
    actif: true,
  };
}

/**
 * Peut-on résilier en ligne, et sinon pourquoi ?
 *
 * Les conditions générales promettent une résiliation en trois clics ; cet
 * écran doit donc soit l'offrir, soit expliquer très précisément ce qui s'y
 * oppose. Une promesse contractuelle dont l'interface ne dit rien est un
 * manquement.
 */
export function resiliationPossible(etat: EtatAbonnement): { possible: boolean; motif: string } {
  if (etat.statut === "resilie") {
    return { possible: false, motif: "Votre abonnement est déjà terminé." };
  }
  if (etat.resiliationDemandee) {
    return { possible: false, motif: "Votre résiliation est déjà enregistrée." };
  }
  if (etat.statut === "essai") {
    return {
      possible: false,
      motif:
        "Vous êtes en période d'essai : il n'y a rien à résilier. Aucun prélèvement n'aura lieu, " +
        "l'accès s'arrête de lui-même au terme des quatorze jours.",
    };
  }
  if (!etat.paiementDisponible) {
    return {
      possible: false,
      motif:
        "La gestion en ligne est momentanément indisponible. Écrivez-nous : nous résilions sous " +
        "48 heures, sans justification à fournir.",
    };
  }
  return { possible: true, motif: "" };
}
