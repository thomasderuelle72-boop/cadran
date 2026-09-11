/**
 * Tableau de flux de trésorerie.
 *
 * Répond à la question la plus fréquente et la plus angoissante d'un
 * dirigeant : « je suis rentable, pourquoi je n'ai pas de trésorerie ? ».
 * La réponse tient dans la décomposition de la variation de trésorerie en
 * trois flux — ce que l'exploitation génère, ce que l'investissement consomme,
 * ce que le financement apporte.
 *
 * Construit par différence entre deux bilans successifs, méthode indirecte.
 *
 * Propriété garantie par construction, et vérifiée par les tests : dès lors
 * que les deux bilans s'équilibrent, la somme des trois flux égale exactement
 * la variation des disponibilités. Le tableau n'est donc pas une estimation,
 * c'est une identité comptable — et l'écart de réconciliation, quand il n'est
 * pas nul, dénonce un bilan déséquilibré plutôt qu'une erreur de calcul.
 *
 * Module pur.
 */

import { computeDerived, type Aggregates } from "../ratios/engine";

export interface LigneFlux {
  id: string;
  label: string;
  montant: number;
  /** Commentaire de lecture, affiché sous la ligne. */
  explication: string;
}

export interface SectionFlux {
  id: "exploitation" | "investissement" | "financement";
  label: string;
  lignes: LigneFlux[];
  total: number;
}

export interface TableauFlux {
  sections: SectionFlux[];
  fluxExploitation: number;
  fluxInvestissement: number;
  fluxFinancement: number;
  variationTresorerie: number;
  tresorerieOuverture: number;
  tresorerieCloture: number;
  /**
   * Différence entre la variation reconstituée et la variation réellement
   * constatée aux disponibilités. Nulle sur des bilans équilibrés ; non nulle,
   * elle signale que l'un des deux bilans ne boucle pas.
   */
  ecartReconciliation: number;
}

/**
 * Besoin en fonds de roulement au sens large, seul périmètre qui permet au
 * tableau de boucler : le BFR d'exploitation du moteur de ratios ignore
 * volontairement les autres créances et autres dettes, mais elles consomment
 * et libèrent de la trésorerie comme les autres.
 */
export function bfrComplet(a: Aggregates): number {
  return (
    a.stocks + a.creancesClients + a.autresCreances - a.dettesFournisseurs - a.autresDettes
  );
}

function arrondi(valeur: number): number {
  const arrondie = Math.round(valeur * 100) / 100;
  // Normalise le zéro négatif : une ligne à −0 s'afficherait « −0 € » et se
  // sérialise en JSON tel quel.
  return arrondie === 0 ? 0 : arrondie;
}

export function computeTableauFlux(ouverture: Aggregates, cloture: Aggregates): TableauFlux {
  const derivedCloture = computeDerived(cloture);

  const resultatNet = derivedCloture.resultatNet;
  const dotations = cloture.dotationsAmortissements;
  const caf = resultatNet + dotations;

  const variationBfr = bfrComplet(cloture) - bfrComplet(ouverture);
  const fluxExploitation = caf - variationBfr;

  // Les immobilisations sont suivies en valeur nette : leur baisse mécanique
  // par l'amortissement doit être neutralisée pour retrouver ce qui a
  // réellement été décaissé en investissement.
  const acquisitionsNettes = cloture.immobilisations - ouverture.immobilisations + dotations;
  const fluxInvestissement = -acquisitionsNettes;

  const variationDettesFinancieres = cloture.dettesFinancieres - ouverture.dettesFinancieres;
  // Mouvements de capitaux propres hors résultat de la période : apports,
  // distributions de dividendes, subventions d'investissement.
  const mouvementsCapital = cloture.capitauxPropres - ouverture.capitauxPropres - resultatNet;
  const fluxFinancement = variationDettesFinancieres + mouvementsCapital;

  const variationTresorerie = fluxExploitation + fluxInvestissement + fluxFinancement;
  const variationConstatee = cloture.disponibilites - ouverture.disponibilites;

  const sections: SectionFlux[] = [
    {
      id: "exploitation",
      label: "Flux de trésorerie d'exploitation",
      total: arrondi(fluxExploitation),
      lignes: [
        {
          id: "caf",
          label: "Capacité d'autofinancement",
          montant: arrondi(caf),
          explication: "Résultat net augmenté des dotations, qui ne sont pas décaissées.",
        },
        {
          id: "variation_bfr",
          label: "Variation du besoin en fonds de roulement",
          montant: arrondi(-variationBfr),
          explication:
            variationBfr > 0
              ? "Le cycle d'exploitation a immobilisé de la trésorerie : stocks ou créances en hausse, ou dettes en baisse."
              : "Le cycle d'exploitation a libéré de la trésorerie.",
        },
      ],
    },
    {
      id: "investissement",
      label: "Flux de trésorerie d'investissement",
      total: arrondi(fluxInvestissement),
      lignes: [
        {
          id: "acquisitions",
          label: "Acquisitions nettes d'immobilisations",
          montant: arrondi(-acquisitionsNettes),
          explication:
            "Variation des immobilisations nettes, corrigée des dotations de la période.",
        },
      ],
    },
    {
      id: "financement",
      label: "Flux de trésorerie de financement",
      total: arrondi(fluxFinancement),
      lignes: [
        {
          id: "dettes_financieres",
          label: "Variation des dettes financières",
          montant: arrondi(variationDettesFinancieres),
          explication:
            variationDettesFinancieres >= 0
              ? "Nouveaux emprunts, nets des remboursements."
              : "Remboursements d'emprunts, nets des nouveaux tirages.",
        },
        {
          id: "capital",
          label: "Mouvements de capitaux propres",
          montant: arrondi(mouvementsCapital),
          explication: "Apports et distributions, hors résultat de la période.",
        },
      ],
    },
  ];

  return {
    sections,
    fluxExploitation: arrondi(fluxExploitation),
    fluxInvestissement: arrondi(fluxInvestissement),
    fluxFinancement: arrondi(fluxFinancement),
    variationTresorerie: arrondi(variationTresorerie),
    tresorerieOuverture: arrondi(ouverture.disponibilites),
    tresorerieCloture: arrondi(cloture.disponibilites),
    ecartReconciliation: arrondi(variationTresorerie - variationConstatee),
  };
}
