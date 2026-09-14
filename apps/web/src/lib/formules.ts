/**
 * Grille tarifaire affichée sur la page d'accueil.
 *
 * Ces montants sont ceux *annoncés*. Ils ne facturent rien : la facturation
 * applique le tarif Stripe correspondant, et le code de l'API ne connaît que
 * son identifiant (cf. apps/api/src/billing/plans.ts). Les deux doivent donc
 * être tenus cohérents à la main, ce qui est le prix à payer pour ne jamais
 * facturer depuis une valeur recopiée — un montant dupliqué côté serveur
 * finirait par diverger de celui encaissé, au détriment du client.
 *
 * Les quotas, eux, viennent de l'API (/billing/formules) : les redéfinir ici
 * créerait une seconde vérité qui mentirait dès la première modification.
 */

export const REMISE_ANNUELLE = 0.2;

export interface FormuleAffichee {
  id: "essai" | "solo" | "cabinet" | "groupe";
  label: string;
  pourQui: string;
  /** Prix mensuel hors taxes, en euros. null pour l'essai. */
  prixMensuel: number | null;
  /** Ce que la formule ajoute par rapport à la précédente. */
  arguments: string[];
  /** Mise en avant : une seule, sinon plus aucune ne ressort. */
  recommandee?: boolean;
}

export const FORMULES: FormuleAffichee[] = [
  {
    id: "essai",
    label: "Essai",
    pourQui: "Pour juger sur pièces",
    prixMensuel: null,
    arguments: [
      "14 jours, sans carte bancaire",
      "Une entreprise, un exercice complet",
      "Import FEC et analyse intégrale",
    ],
  },
  {
    id: "solo",
    label: "Indépendant",
    pourQui: "Une entreprise, un pilote",
    prixMensuel: 29,
    arguments: [
      "Une entité, deux utilisateurs",
      "Historique illimité",
      "Ratios, soldes de gestion, flux de trésorerie",
      "Diagnostic de fragilité et plan d'action",
    ],
  },
  {
    id: "cabinet",
    label: "Cabinet",
    pourQui: "Plusieurs dossiers, plusieurs intervenants",
    prixMensuel: 89,
    recommandee: true,
    arguments: [
      "Jusqu'à 15 entités, 10 utilisateurs",
      "Consolidation de groupe",
      "Rôles et cloisonnement par dossier",
      "Exports PDF et Excel à votre marque",
    ],
  },
  {
    id: "groupe",
    label: "Groupe",
    pourQui: "Structures à filiales multiples",
    prixMensuel: 249,
    arguments: [
      "Entités et utilisateurs sans limite",
      "Consolidation multi-devises",
      "Piste d'audit complète",
      "Accompagnement à la mise en route",
    ],
  },
];

/** Prix mensuel équivalent lorsqu'on règle à l'année. */
export function prixAnnualise(prixMensuel: number): number {
  return Math.round(prixMensuel * (1 - REMISE_ANNUELLE));
}

export function economieAnnuelle(prixMensuel: number): number {
  return prixMensuel * 12 - prixAnnualise(prixMensuel) * 12;
}
