/**
 * Catalogue des formules.
 *
 * Ce qu'on trouve ici : ce que chaque formule *autorise*. Ce qu'on n'y trouve
 * pas : les prix. Ils vivent dans Stripe, et le code ne connaît que
 * l'identifiant de tarif correspondant — sinon le prix affiché sur le site
 * finit tôt ou tard par diverger du prix réellement facturé, et c'est le
 * client qui le découvre sur son relevé.
 *
 * Les quotas sont ici plutôt que dispersés dans chaque module : quand ils
 * sont écrits en dur à l'endroit où on les vérifie, personne ne sait plus ce
 * qu'une formule donne réellement, et une limite oubliée devient une fuite de
 * revenu silencieuse.
 */

export type PlanId = "essai" | "solo" | "cabinet" | "groupe";

export interface Quotas {
  /** Nombre d'entités analysables. null = sans limite. */
  entites: number | null;
  /** Comptes utilisateurs de l'organisation, celui de l'admin compris. */
  utilisateurs: number | null;
  /** Périodes conservées par entité ; au-delà, l'import refuse. */
  periodes: number | null;
  /** La consolidation de groupe n'a de sens qu'à plusieurs entités. */
  consolidation: boolean;
  /** Import d'un fichier des écritures comptables. */
  fec: boolean;
}

export interface Plan {
  id: PlanId;
  label: string;
  /** Ce que la formule permet, en une phrase, pour la page de tarifs. */
  promesse: string;
  quotas: Quotas;
  /**
   * Identifiant de tarif Stripe, lu dans l'environnement. Absent pour l'essai,
   * qui ne passe par aucun paiement.
   */
  variableTarif: string | null;
}

export const PLANS: Record<PlanId, Plan> = {
  essai: {
    id: "essai",
    label: "Essai",
    promesse: "Quatorze jours pour importer un exercice et juger sur pièces.",
    quotas: { entites: 1, utilisateurs: 1, periodes: 12, consolidation: false, fec: true },
    variableTarif: null,
  },
  solo: {
    id: "solo",
    label: "Indépendant",
    promesse: "Une entreprise, un pilote, tout l'outil d'analyse.",
    quotas: { entites: 1, utilisateurs: 2, periodes: null, consolidation: false, fec: true },
    variableTarif: "STRIPE_PRICE_SOLO",
  },
  cabinet: {
    id: "cabinet",
    label: "Cabinet",
    promesse: "Plusieurs dossiers clients, plusieurs intervenants, la consolidation.",
    quotas: { entites: 15, utilisateurs: 10, periodes: null, consolidation: true, fec: true },
    variableTarif: "STRIPE_PRICE_CABINET",
  },
  groupe: {
    id: "groupe",
    label: "Groupe",
    promesse: "Sans limite de périmètre, pour les structures à filiales multiples.",
    quotas: { entites: null, utilisateurs: null, periodes: null, consolidation: true, fec: true },
    variableTarif: "STRIPE_PRICE_GROUPE",
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/** Formule d'une organisation sans abonnement : l'essai, pas le vide. */
export const PLAN_PAR_DEFAUT: PlanId = "essai";

export function estPlanConnu(valeur: string): valeur is PlanId {
  return valeur in PLANS;
}

/**
 * Statuts d'abonnement, repris de Stripe pour ne pas inventer un second
 * vocabulaire qu'il faudrait ensuite tenir en correspondance.
 */
export type StatutAbonnement =
  | "essai"
  | "actif"
  | "impaye"
  | "resilie"
  | "incomplet";

/**
 * Un abonnement impayé ne coupe pas l'accès immédiatement.
 *
 * Stripe relance la carte plusieurs jours ; couper au premier échec punirait
 * un client solvable dont la carte a expiré, et c'est le meilleur moyen de le
 * perdre pour de bon. L'accès reste ouvert pendant la relance, avec un
 * bandeau, et ne se ferme qu'à la résiliation effective.
 */
export function accesOuvert(statut: StatutAbonnement): boolean {
  return statut === "essai" || statut === "actif" || statut === "impaye";
}

/** Le statut mérite d'être signalé à l'utilisateur, sans bloquer. */
export function demandeAction(statut: StatutAbonnement): boolean {
  return statut === "impaye" || statut === "incomplet";
}

export interface Depassement {
  quota: keyof Quotas;
  /** Accordé au nombre : « 1 entité », « 15 entités ». */
  libelle: string;
  limite: number;
  actuel: number;
}

/**
 * Vérifie qu'une création reste dans les limites de la formule.
 *
 * Renvoie le dépassement plutôt qu'un booléen : l'appelant doit pouvoir dire
 * *laquelle* des limites est atteinte et à quelle valeur, sinon le message
 * d'erreur se résume à « formule insuffisante », ce qui n'aide ni à décider
 * ni à acheter.
 */
export function verifierQuota(
  plan: Plan,
  quota: "entites" | "utilisateurs" | "periodes",
  actuel: number
): Depassement | null {
  const limite = plan.quotas[quota];
  if (limite === null) return null;
  if (actuel < limite) return null;

  // Le libellé est accordé au nombre : un message qui dit « 1 entités » fait
  // douter du reste, et on parle ici de facturation.
  const libelles: Record<typeof quota, [singulier: string, pluriel: string]> = {
    entites: ["entité", "entités"],
    utilisateurs: ["utilisateur", "utilisateurs"],
    periodes: ["période par entité", "périodes par entité"],
  };
  const [singulier, pluriel] = libelles[quota];

  return { quota, libelle: limite > 1 ? pluriel : singulier, limite, actuel };
}
