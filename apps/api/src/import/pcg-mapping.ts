import { LinePoste } from "@prisma/client";

/**
 * Correspondance entre préfixes du Plan Comptable Général et postes Cadran.
 *
 * Deux usages, qu'il faut distinguer parce que l'ancien commentaire les
 * confondait : à l'import d'une balance, la table pré-remplit une
 * classification que l'utilisateur relit et corrige ; à l'import d'un FEC,
 * elle est **appliquée directement**, écriture par écriture. Les comptes
 * qu'elle ne reconnaît pas ne sont pas perdus : ils remontent en « comptes
 * non classés », visibles à l'écran. Une erreur ici fausse donc un FEC sans
 * que personne ne l'ait relue — d'où le soin apporté aux préfixes longs.
 *
 * Le préfixe le plus long l'emporte : « 757 » passe devant « 75 ».
 *
 * **Les deux plans comptables cohabitent.** Le règlement ANC 2022-06 s'applique
 * aux exercices ouverts depuis le 1er janvier 2025, et Cadran compare des
 * exercices de part et d'autre de cette date. Chaque correspondance est donc
 * écrite pour que la même opération atterrisse dans le même poste, qu'elle ait
 * été comptabilisée avant ou après la réforme :
 *
 * - une cession d'immobilisation (775/675 avant, 757/657 et 7671/6671 après)
 *   va toujours en RESULTAT_CESSIONS, jamais dans l'EBITDA ;
 * - la quote-part de subvention d'investissement (777 avant, 747 après)
 *   vient toujours en déduction des dotations, puisqu'elle en est la
 *   contrepartie et ne produit pas un euro de trésorerie ;
 * - les transferts de charges (79, supprimés par la réforme) reviennent dans
 *   le poste qu'ils corrigeaient.
 *
 * Sans cela, une PME qui revend un camion en 2025 voyait son EBITDA gonfler du
 * montant de la plus-value, et la même vente faite en 2024 ne l'aurait pas
 * touché : le pluriannuel aurait comparé deux définitions différentes.
 */
export const PCG_PREFIX_MAPPING: Array<{ prefix: string; poste: LinePoste; label: string }> = [
  { prefix: "70", poste: LinePoste.CHIFFRE_AFFAIRES, label: "Ventes de produits, prestations, marchandises" },
  { prefix: "60", poste: LinePoste.ACHATS_CONSOMMES, label: "Achats" },
  { prefix: "61", poste: LinePoste.CHARGES_EXTERNES, label: "Services extérieurs" },
  { prefix: "62", poste: LinePoste.CHARGES_EXTERNES, label: "Autres services extérieurs" },
  { prefix: "63", poste: LinePoste.IMPOTS_TAXES, label: "Impôts, taxes et versements assimilés" },
  { prefix: "64", poste: LinePoste.CHARGES_PERSONNEL, label: "Charges de personnel" },
  { prefix: "65", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Autres charges de gestion courante" },
  // Réforme 2025 : valeur nette comptable des immobilisations corporelles et
  // incorporelles cédées. Rangée sous 65 par le PCG, mais hors EBITDA ici.
  { prefix: "657", poste: LinePoste.RESULTAT_CESSIONS, label: "Valeur comptable des immobilisations cédées" },
  { prefix: "66", poste: LinePoste.CHARGES_FINANCIERES, label: "Charges financières" },
  // Réforme 2025 : valeur comptable des immobilisations financières cédées.
  // Le 667 seul garde son sens historique (charges nettes sur cessions de
  // valeurs mobilières de placement) : seuls les sous-comptes 6671 et 6672
  // désignent une cession d'immobilisation.
  { prefix: "6671", poste: LinePoste.RESULTAT_CESSIONS, label: "Valeur comptable des immobilisations financières cédées" },
  { prefix: "6672", poste: LinePoste.RESULTAT_CESSIONS, label: "Charges nettes sur cessions de titres de portefeuille" },
  { prefix: "67", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Charges exceptionnelles" },
  // Avant la réforme : valeur comptable des éléments d'actif cédés.
  { prefix: "675", poste: LinePoste.RESULTAT_CESSIONS, label: "Valeur comptable des éléments d'actif cédés (avant 2025)" },
  { prefix: "68", poste: LinePoste.DOTATIONS_AMORTISSEMENTS, label: "Dotations aux amortissements et provisions" },
  // Le préfixe 68 couvre trois natures : les dotations d'exploitation (681)
  // restent ici, les financières et les exceptionnelles rejoignent leur poste.
  { prefix: "686", poste: LinePoste.CHARGES_FINANCIERES, label: "Dotations financières" },
  { prefix: "687", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Dotations exceptionnelles" },
  { prefix: "69", poste: LinePoste.IMPOT_SOCIETES, label: "Participation, impôts sur les bénéfices" },
  { prefix: "71", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Production stockée" },
  { prefix: "72", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Production immobilisée" },
  { prefix: "74", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Subventions d'exploitation" },
  // Réforme 2025 : quote-part des subventions d'investissement virée au
  // résultat. Rangée sous 74 par le PCG, mais ce n'est pas une subvention
  // d'exploitation : c'est la contrepartie de l'amortissement du bien
  // subventionné, sans encaissement. En déduction des dotations, elle sort de
  // l'EBITDA et s'annule dans la CAF — exactement comme il faut.
  { prefix: "747", poste: LinePoste.DOTATIONS_AMORTISSEMENTS, label: "Quote-part des subventions d'investissement" },
  { prefix: "75", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Autres produits de gestion courante" },
  // Réforme 2025 : prix de cession des immobilisations corporelles et
  // incorporelles. Rangé sous 75 par le PCG, mais hors EBITDA ici.
  { prefix: "757", poste: LinePoste.RESULTAT_CESSIONS, label: "Produits de cession d'immobilisations" },
  { prefix: "76", poste: LinePoste.PRODUITS_FINANCIERS, label: "Produits financiers" },
  { prefix: "7671", poste: LinePoste.RESULTAT_CESSIONS, label: "Produits de cession d'immobilisations financières" },
  { prefix: "7672", poste: LinePoste.RESULTAT_CESSIONS, label: "Produits nets sur cessions de titres de portefeuille" },
  { prefix: "77", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Produits exceptionnels" },
  // Avant la réforme : produits de cession et quote-part de subvention, tous
  // deux sortis de l'exceptionnel pour être traités comme après 2025.
  { prefix: "775", poste: LinePoste.RESULTAT_CESSIONS, label: "Produits des cessions d'éléments d'actif (avant 2025)" },
  { prefix: "777", poste: LinePoste.DOTATIONS_AMORTISSEMENTS, label: "Quote-part des subventions d'investissement (avant 2025)" },
  // Reprises sur amortissements et provisions : la table les ignorait, et la
  // reprise d'une dépréciation de stock remontait en compte non classé. Elles
  // viennent en déduction de la dotation de même nature.
  { prefix: "781", poste: LinePoste.DOTATIONS_AMORTISSEMENTS, label: "Reprises d'exploitation sur amortissements et provisions" },
  { prefix: "786", poste: LinePoste.PRODUITS_FINANCIERS, label: "Reprises financières sur provisions" },
  { prefix: "787", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Reprises exceptionnelles sur provisions" },
  // Transferts de charges, supprimés par la réforme mais présents dans tous
  // les FEC antérieurs à 2025. Chacun revient dans le résultat qu'il corrige.
  { prefix: "791", poste: LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION, label: "Transferts de charges d'exploitation (avant 2025)" },
  { prefix: "796", poste: LinePoste.PRODUITS_FINANCIERS, label: "Transferts de charges financières (avant 2025)" },
  { prefix: "797", poste: LinePoste.RESULTAT_EXCEPTIONNEL, label: "Transferts de charges exceptionnelles (avant 2025)" },
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
  RESULTAT_CESSIONS: "Résultat de cession d'actifs",
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
