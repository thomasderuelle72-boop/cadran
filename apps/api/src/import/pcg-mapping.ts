import { LinePoste } from "@prisma/client";

/**
 * Table de correspondance indicative entre préfixes du Plan Comptable
 * Général (PCG) français et postes normalisés Cadran. Sert uniquement à
 * pré-remplir la classification proposée à l'utilisateur lors de l'import :
 * la classification retenue reste toujours celle validée manuellement par
 * l'utilisateur, jamais celle-ci appliquée automatiquement sans revue.
 */
export const PCG_PREFIX_MAPPING: Array<{ prefix: string; poste: LinePoste; label: string }> = [
  { prefix: "70", poste: LinePoste.CHIFFRE_AFFAIRES, label: "Ventes de produits, prestations, marchandises" },
  { prefix: "60", poste: LinePoste.ACHATS_CONSOMMES, label: "Achats" },
  { prefix: "61", poste: LinePoste.CHARGES_EXTERNES, label: "Services extérieurs" },
  { prefix: "62", poste: LinePoste.CHARGES_EXTERNES, label: "Autres services extérieurs" },
  { prefix: "63", poste: LinePoste.IMPOTS_TAXES, label: "Impôts, taxes et versements assimilés" },
  { prefix: "64", poste: LinePoste.CHARGES_PERSONNEL, label: "Charges de personnel" },
  { prefix: "65", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Autres charges de gestion courante" },
  { prefix: "66", poste: LinePoste.CHARGES_FINANCIERES, label: "Charges financières" },
  { prefix: "67", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Charges exceptionnelles" },
  { prefix: "68", poste: LinePoste.DOTATIONS_AMORTISSEMENTS, label: "Dotations aux amortissements et provisions" },
  { prefix: "69", poste: LinePoste.IMPOT_SOCIETES, label: "Participation, impôts sur les bénéfices" },
  { prefix: "71", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Production stockée" },
  { prefix: "72", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Production immobilisée" },
  { prefix: "74", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Subventions d'exploitation" },
  { prefix: "75", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Autres produits de gestion courante" },
  { prefix: "76", poste: LinePoste.PRODUITS_FINANCIERS, label: "Produits financiers" },
  { prefix: "77", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Produits exceptionnels" },
  { prefix: "20", poste: LinePoste.IMMOBILISATIONS, label: "Immobilisations incorporelles" },
  { prefix: "21", poste: LinePoste.IMMOBILISATIONS, label: "Immobilisations corporelles" },
  { prefix: "27", poste: LinePoste.IMMOBILISATIONS, label: "Immobilisations financières" },
  { prefix: "28", poste: LinePoste.IMMOBILISATIONS, label: "Amortissements des immobilisations" },
  { prefix: "3", poste: LinePoste.STOCKS, label: "Stocks et en-cours" },
  { prefix: "40", poste: LinePoste.DETTES_FOURNISSEURS, label: "Fournisseurs et comptes rattachés" },
  { prefix: "41", poste: LinePoste.CREANCES_CLIENTS, label: "Clients et comptes rattachés" },
  { prefix: "42", poste: LinePoste.AUTRES_DETTES, label: "Personnel et comptes rattachés" },
  { prefix: "43", poste: LinePoste.AUTRES_DETTES, label: "Sécurité sociale et organismes sociaux" },
  { prefix: "44", poste: LinePoste.AUTRES_DETTES, label: "État et collectivités publiques" },
  { prefix: "46", poste: LinePoste.AUTRES_CREANCES, label: "Débiteurs et créditeurs divers" },
  { prefix: "10", poste: LinePoste.CAPITAUX_PROPRES, label: "Capital et réserves" },
  { prefix: "11", poste: LinePoste.CAPITAUX_PROPRES, label: "Report à nouveau" },
  { prefix: "12", poste: LinePoste.CAPITAUX_PROPRES, label: "Résultat de l'exercice" },
  { prefix: "16", poste: LinePoste.DETTES_FINANCIERES, label: "Emprunts et dettes financières" },
  { prefix: "51", poste: LinePoste.DISPONIBILITES, label: "Banques" },
  { prefix: "53", poste: LinePoste.DISPONIBILITES, label: "Caisse" },
];

export function suggestPoste(accountCode: string): LinePoste | null {
  const trimmed = accountCode.trim();
  // On teste du préfixe le plus long (le plus spécifique) au plus court.
  const sorted = [...PCG_PREFIX_MAPPING].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find((entry) => trimmed.startsWith(entry.prefix));
  return match ? match.poste : null;
}

export const POSTE_LABELS: Record<LinePoste, string> = {
  CHIFFRE_AFFAIRES: "Chiffre d'affaires",
  ACHATS_CONSOMMES: "Achats consommés",
  CHARGES_EXTERNES: "Charges externes",
  CHARGES_PERSONNEL: "Charges de personnel",
  IMPOTS_TAXES: "Impôts et taxes",
  DOTATIONS_AMORTISSEMENTS: "Dotations aux amortissements",
  AUTRES_PRODUITS_CHARGES_EXPLOITATION: "Autres produits / charges d'exploitation",
  CHARGES_FINANCIERES: "Charges financières",
  PRODUITS_FINANCIERS: "Produits financiers",
  RESULTAT_EXCEPTIONNEL: "Résultat exceptionnel",
  IMPOT_SOCIETES: "Impôt sur les sociétés",
  STOCKS: "Stocks",
  CREANCES_CLIENTS: "Créances clients",
  AUTRES_CREANCES: "Autres créances",
  DISPONIBILITES: "Disponibilités",
  CAPITAUX_PROPRES: "Capitaux propres",
  DETTES_FINANCIERES: "Dettes financières",
  DETTES_FOURNISSEURS: "Dettes fournisseurs",
  AUTRES_DETTES: "Autres dettes",
  IMMOBILISATIONS: "Immobilisations",
};
