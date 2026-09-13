import type { PlanId, StatutAbonnement } from "@prisma/client";

/**
 * Traduction des états Stripe vers ceux de l'application.
 *
 * Stripe distingue sept états d'abonnement, dont plusieurs recouvrent la même
 * réalité pour nous. Les fondre sans y penser conduit à deux erreurs
 * classiques : couper l'accès d'un client dont la carte a simplement expiré,
 * ou laisser ouvert celui d'un abonnement jamais confirmé.
 *
 * La règle retenue :
 *   trialing              → essai      (accès ouvert, aucun paiement encore)
 *   active               → actif
 *   past_due, unpaid     → impayé     (accès maintenu pendant les relances)
 *   incomplete           → incomplet  (premier paiement jamais abouti)
 *   canceled,
 *   incomplete_expired   → résilié    (accès fermé)
 *
 * `past_due` garde l'accès ouvert *volontairement* : Stripe relance la carte
 * pendant plusieurs jours, et fermer au premier échec punit un client
 * solvable. `incomplete`, en revanche, n'a jamais rien payé — il n'y a pas de
 * confiance à accorder.
 */
export function statutDepuisStripe(statutStripe: string): StatutAbonnement {
  switch (statutStripe) {
    case "trialing":
      return "essai";
    case "active":
      return "actif";
    case "past_due":
    case "unpaid":
      return "impaye";
    case "incomplete":
      return "incomplet";
    case "canceled":
    case "incomplete_expired":
      return "resilie";
    default:
      // Un état inconnu vient forcément d'une évolution de Stripe. Le traiter
      // comme « incomplet » ferme la porte sans détruire l'abonnement : on
      // préfère un faux blocage réparable à un accès accordé par défaut.
      return "incomplet";
  }
}

/**
 * Retrouve la formule à partir du tarif facturé.
 *
 * La correspondance passe par l'environnement plutôt que par une table en
 * base : les identifiants de tarif diffèrent entre le mode test et le mode
 * production, et les figer en base obligerait à les réécrire à chaque
 * bascule.
 */
export function planDepuisTarif(
  priceId: string | null | undefined,
  environnement: Record<string, string | undefined>
): PlanId | null {
  if (!priceId) return null;
  const correspondances: Array<[string, PlanId]> = [
    ["STRIPE_PRICE_SOLO", "solo"],
    ["STRIPE_PRICE_CABINET", "cabinet"],
    ["STRIPE_PRICE_GROUPE", "groupe"],
  ];
  const trouve = correspondances.find(([variable]) => environnement[variable] === priceId);
  return trouve ? trouve[1] : null;
}

/**
 * Événements Stripe auxquels on réagit.
 *
 * La liste est délibérément courte. Stripe en émet plus de deux cents ;
 * s'abonner largement donne l'illusion d'être complet et noie les quelques-uns
 * qui portent réellement un changement d'état.
 */
export const EVENEMENTS_SUIVIS = [
  // Fin du paiement initial : c'est ici, et nulle part ailleurs, que l'accès
  // s'accorde. L'URL de retour ne prouve rien — un client peut fermer
  // l'onglet après avoir payé, et un autre peut l'appeler sans payer.
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  // Échec de prélèvement : déclenche la relance, pas la coupure.
  "invoice.payment_failed",
  "invoice.paid",
] as const;

export type EvenementSuivi = (typeof EVENEMENTS_SUIVIS)[number];

export function estEvenementSuivi(type: string): type is EvenementSuivi {
  return (EVENEMENTS_SUIVIS as readonly string[]).includes(type);
}
