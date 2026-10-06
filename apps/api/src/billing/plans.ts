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

export type PlanId = "essai" | "solo" | "cabinet" | "groupe" | "interne";

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
  /**
   * Questions au conseiller, par mois. null = sans limite.
   *
   * Aucune formule n'est illimitée ici, contrairement aux entités : chaque
   * question appelle un modèle facturé au jeton, et une limite absente est
   * une dépense non bornée. Les valeurs sont un premier calibrage — environ
   * un sixième à un quart du prix de la formule au coût observé — à ajuster
   * sur la consommation réelle, que `ConseilUsage` enregistre pour cela.
   */
  questionsConseil: number;
  /**
   * Documents exportés à la marque du client : logo, couleur, signature.
   *
   * La page de tarifs l'annonce à partir de Cabinet — c'est un argument de
   * vente destiné aux cabinets, qui remettent les rapports à leurs propres
   * clients sous leur nom. L'inclure plus bas viderait cet argument.
   */
  marqueDocuments: boolean;
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
    quotas: { entites: 1, utilisateurs: 1, periodes: 12, consolidation: false, fec: true, questionsConseil: 10, marqueDocuments: false },
    variableTarif: null,
  },
  solo: {
    id: "solo",
    label: "Indépendant",
    promesse: "Une entreprise, un pilote, tout l'outil d'analyse.",
    quotas: { entites: 1, utilisateurs: 2, periodes: null, consolidation: false, fec: true, questionsConseil: 60, marqueDocuments: false },
    variableTarif: "STRIPE_PRICE_SOLO",
  },
  cabinet: {
    id: "cabinet",
    label: "Cabinet",
    promesse: "Plusieurs dossiers clients, plusieurs intervenants, la consolidation.",
    quotas: { entites: 15, utilisateurs: 10, periodes: null, consolidation: true, fec: true, questionsConseil: 250, marqueDocuments: true },
    variableTarif: "STRIPE_PRICE_CABINET",
  },
  /**
   * Formule interne : l'exploitant de la plateforme, et lui seul.
   *
   * Elle existe pour que l'accès de l'administrateur ne dépende d'aucune
   * formule commerciale. Lui attribuer « Groupe » marchait, mais le liait à
   * un produit vendu : le jour où l'on retouche les quotas de Groupe pour une
   * raison tarifaire, on retouche sans le vouloir l'accès de celui qui
   * administre. Les deux décisions n'ont rien à voir ; elles sont séparées.
   *
   * Elle n'a pas de tarif Stripe, ne figure pas au catalogue public, et ne
   * s'obtient donc ni par la page d'abonnement ni par un paiement : seule la
   * console d'administration ou le script de création d'administrateur
   * l'attribuent.
   */
  interne: {
    id: "interne",
    label: "Interne",
    promesse: "Accès complet de l'exploitant, hors catalogue et hors facturation.",
    quotas: {
      entites: null,
      utilisateurs: null,
      periodes: null,
      consolidation: true,
      fec: true,
      /*
       * Un plafond, et non l'absence de plafond.
       *
       * Ce n'est pas une limite commerciale — personne ne pose cent mille
       * questions par mois — mais un fusible : chaque question appelle un
       * modèle facturé au jeton, et une boucle dans un script d'intégration
       * viderait un compte sans que rien ne l'arrête. Le chiffre se relève
       * ici, à un seul endroit.
       */
      questionsConseil: 100000,
      marqueDocuments: true,
    },
    variableTarif: null,
  },
  groupe: {
    id: "groupe",
    label: "Groupe",
    promesse: "Sans limite de périmètre, pour les structures à filiales multiples.",
    quotas: { entites: null, utilisateurs: null, periodes: null, consolidation: true, fec: true, questionsConseil: 800, marqueDocuments: true },
    variableTarif: "STRIPE_PRICE_GROUPE",
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/**
 * Formules qu'un client peut voir et souscrire.
 *
 * Dérivé de l'absence de tarif Stripe plutôt que d'une liste à tenir à jour :
 * une formule ajoutée sans tarif est par construction non vendable, et il
 * devient impossible d'en publier une par oubli. L'essai en fait partie
 * malgré lui — il n'a pas de tarif non plus — d'où la seconde condition.
 */
export const PLANS_PUBLICS: PlanId[] = PLAN_IDS.filter(
  (id) => PLANS[id].variableTarif !== null || id === "essai"
);

/** La formule de l'exploitant, qui ne se vend pas et ne s'achète pas. */
export function estPlanInterne(plan: PlanId): boolean {
  return plan === "interne";
}

/**
 * La formule qui s'applique réellement à une requête.
 *
 * Dans son organisation, l'administrateur de la plateforme porte la formule
 * « Interne » : rien ne le borne. La question se pose ailleurs — en accès
 * support, dans l'organisation d'un client — et la réponse n'est pas la même
 * pour tous les quotas, parce qu'ils ne coûtent pas la même chose au client.
 *
 * **Les fonctions se délient.** Consulter une consolidation, importer un FEC
 * pour reproduire un bogue, regarder un document à la marque du client : rien
 * de tout cela ne laisse de trace qui gêne le client ensuite. Les lui refuser
 * n'empêcherait que le dépannage.
 *
 * **Les stocks ne se délient pas.** Créer une entité, un utilisateur ou une
 * période laisse une ligne qui survit au départ de l'administrateur. Un
 * client en formule Indépendant retrouverait deux entités là où sa formule en
 * autorise une : ses propres écrans lui annonceraient un dépassement qu'il
 * n'a pas provoqué, et la prochaine création lui serait refusée sans qu'il
 * comprenne pourquoi. L'administrateur qui doit vraiment créer au-delà change
 * d'abord la formule du client depuis la console — un geste visible, qui
 * laisse une trace, et qui est exactement ce qu'il faut ici.
 */
export function planApplicable(plan: PlanId, administrateurPlateforme: boolean): Plan {
  const souscrit = PLANS[plan];
  if (!administrateurPlateforme) return souscrit;

  return {
    ...souscrit,
    quotas: {
      ...souscrit.quotas,
      consolidation: true,
      fec: true,
      marqueDocuments: true,
      questionsConseil: Math.max(
        souscrit.quotas.questionsConseil,
        PLANS.interne.quotas.questionsConseil
      ),
    },
  };
}

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
export function accesOuvert(statut: StatutAbonnement, plan?: PlanId): boolean {
  /*
   * La formule interne ne passe par aucun paiement : aucun événement Stripe
   * ne viendra jamais la faire passer à « resilie ». Si un statut périmé s'y
   * trouvait malgré tout — une ligne créée avant, une manipulation en base —
   * il fermerait l'accès de celui qui administre la plateforme, c'est-à-dire
   * de la seule personne capable de le rouvrir.
   */
  if (plan && estPlanInterne(plan)) return true;
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
/**
 * Le quota de questions est-il épuisé ?
 *
 * Séparé de `verifierQuota` parce qu'il ne compte pas la même chose : les
 * autres quotas bornent un stock (combien d'entités existent), celui-ci un
 * flux (combien de questions ce mois-ci). Les confondre donnerait un message
 * d'erreur qui parle de création alors qu'il s'agit d'un usage.
 */
export function questionsRestantes(plan: Plan, posees: number): number {
  return Math.max(plan.quotas.questionsConseil - posees, 0);
}

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
