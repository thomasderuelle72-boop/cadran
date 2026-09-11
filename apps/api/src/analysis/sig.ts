/**
 * Soldes intermédiaires de gestion et capacité d'autofinancement.
 *
 * La cascade du plan comptable général répond à une question que l'EBITDA ne
 * répond pas : *où* la richesse se crée et *entre qui* elle se partage. La
 * valeur ajoutée dit ce que l'entreprise ajoute aux achats qu'elle fait ; la
 * suite de la cascade montre ce qu'en prennent l'État, les salariés, les
 * prêteurs, puis l'actionnaire.
 *
 * La CAF, elle, est le chaînon entre le résultat et la trésorerie : c'est
 * l'indicateur que regarde une banque pour calibrer une échéance de prêt.
 *
 * Module pur. Les soldes se raccordent exactement à ceux du moteur de ratios
 * (`ebitda` y est l'excédent brut d'exploitation, `ebit` le résultat
 * d'exploitation, `resultatNet` le résultat net) — les tests le vérifient,
 * pour qu'un même chiffre ne puisse jamais différer d'un écran à l'autre.
 */

import { computeDerived, type Aggregates } from "../ratios/engine";

export interface SoldeIntermediaire {
  id: string;
  label: string;
  valeur: number;
  /** Formule, affichée sous le solde : le lecteur doit pouvoir recalculer. */
  formule: string;
  /** Part du chiffre d'affaires, ou null quand le CA est nul. */
  partDuCa: number | null;
  /** Un solde majeur est mis en avant ; les autres sont des étapes. */
  majeur: boolean;
}

export interface Sig {
  soldes: SoldeIntermediaire[];
  valeurAjoutee: number;
  excedentBrutExploitation: number;
  resultatExploitation: number;
  resultatCourantAvantImpots: number;
  resultatNet: number;
  capaciteAutofinancement: number;
  /**
   * Répartition de la valeur ajoutée entre ses bénéficiaires. Somme à 100 %
   * de la VA quand celle-ci est positive ; null sinon, parce qu'une part de
   * grandeur négative n'a pas de sens.
   */
  partageValeurAjoutee: Array<{ id: string; label: string; montant: number; part: number | null }> | null;
}

function part(valeur: number, base: number): number | null {
  return base === 0 ? null : valeur / base;
}

export function computeSig(a: Aggregates): Sig {
  const derived = computeDerived(a);

  const consommationsTiers = a.achatsConsommes + a.chargesExternes;
  // Simplification assumée : la production stockée et immobilisée (71, 72) et
  // les subventions d'exploitation (74) sont regroupées dans le poste
  // « autres produits et charges d'exploitation » et prises en compte au
  // niveau de l'excédent brut, non de la valeur ajoutée. L'écart est nul pour
  // une entreprise de services et faible ailleurs ; le lever demanderait de
  // scinder le poste, ce qui est possible dès qu'on importe un FEC.
  const valeurAjoutee = a.chiffreAffaires - consommationsTiers;

  // L'excédent brut d'exploitation du PCG et l'EBITDA du moteur sont le même
  // solde : on réutilise celui du moteur plutôt que d'en écrire un second.
  const excedentBrutExploitation = derived.ebitda;
  const resultatExploitation = derived.ebit;
  const resultatFinancier = derived.resultatFinancier;
  const resultatCourantAvantImpots = resultatExploitation + resultatFinancier;
  const resultatNet = derived.resultatNet;

  // CAF, méthode additive : on repart du résultat net et on neutralise la
  // seule charge non décaissable que la nomenclature isole, les dotations.
  //
  // Limite connue : les plus et moins-values de cession d'actif (675 / 775)
  // sont comprises dans le résultat exceptionnel et devraient en être
  // retirées. Au niveau d'agrégat actuel, elles ne sont pas séparables — la
  // CAF est donc juste à une cession près.
  const capaciteAutofinancement = resultatNet + a.dotationsAmortissements;

  const soldes: SoldeIntermediaire[] = [
    {
      id: "chiffre_affaires",
      label: "Chiffre d'affaires",
      valeur: a.chiffreAffaires,
      formule: "Ventes de biens et de services",
      partDuCa: part(a.chiffreAffaires, a.chiffreAffaires),
      majeur: true,
    },
    {
      id: "consommations_tiers",
      label: "Consommations en provenance de tiers",
      valeur: consommationsTiers,
      formule: "Achats consommés + charges externes",
      partDuCa: part(consommationsTiers, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "valeur_ajoutee",
      label: "Valeur ajoutée",
      valeur: valeurAjoutee,
      formule: "Chiffre d'affaires − consommations en provenance de tiers",
      partDuCa: part(valeurAjoutee, a.chiffreAffaires),
      majeur: true,
    },
    {
      id: "charges_personnel",
      label: "Charges de personnel",
      valeur: a.chargesPersonnel,
      formule: "Salaires et charges sociales",
      partDuCa: part(a.chargesPersonnel, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "impots_taxes",
      label: "Impôts et taxes",
      valeur: a.impotsTaxes,
      formule: "Hors impôt sur les sociétés",
      partDuCa: part(a.impotsTaxes, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "ebe",
      label: "Excédent brut d'exploitation",
      valeur: excedentBrutExploitation,
      formule: "Valeur ajoutée + autres produits et charges − charges de personnel − impôts et taxes",
      partDuCa: part(excedentBrutExploitation, a.chiffreAffaires),
      majeur: true,
    },
    {
      id: "dotations",
      label: "Dotations aux amortissements",
      valeur: a.dotationsAmortissements,
      formule: "Charge constatée, non décaissée",
      partDuCa: part(a.dotationsAmortissements, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "resultat_exploitation",
      label: "Résultat d'exploitation",
      valeur: resultatExploitation,
      formule: "Excédent brut d'exploitation − dotations",
      partDuCa: part(resultatExploitation, a.chiffreAffaires),
      majeur: true,
    },
    {
      id: "resultat_financier",
      label: "Résultat financier",
      valeur: resultatFinancier,
      formule: "Produits financiers − charges financières",
      partDuCa: part(resultatFinancier, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "rcai",
      label: "Résultat courant avant impôts",
      valeur: resultatCourantAvantImpots,
      formule: "Résultat d'exploitation + résultat financier",
      partDuCa: part(resultatCourantAvantImpots, a.chiffreAffaires),
      majeur: true,
    },
    {
      id: "resultat_exceptionnel",
      label: "Résultat exceptionnel",
      valeur: a.resultatExceptionnel,
      formule: "Produits exceptionnels − charges exceptionnelles",
      partDuCa: part(a.resultatExceptionnel, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "impot_societes",
      label: "Impôt sur les sociétés",
      valeur: a.impotSocietes,
      formule: "Charge d'impôt de la période",
      partDuCa: part(a.impotSocietes, a.chiffreAffaires),
      majeur: false,
    },
    {
      id: "resultat_net",
      label: "Résultat net",
      valeur: resultatNet,
      formule: "Résultat courant + résultat exceptionnel − impôt sur les sociétés",
      partDuCa: part(resultatNet, a.chiffreAffaires),
      majeur: true,
    },
    {
      id: "caf",
      label: "Capacité d'autofinancement",
      valeur: capaciteAutofinancement,
      formule: "Résultat net + dotations aux amortissements",
      partDuCa: part(capaciteAutofinancement, a.chiffreAffaires),
      majeur: true,
    },
  ];

  const partageValeurAjoutee =
    valeurAjoutee > 0
      ? [
          {
            id: "salaries",
            label: "Salariés",
            montant: a.chargesPersonnel,
            part: part(a.chargesPersonnel, valeurAjoutee),
          },
          {
            id: "etat",
            label: "État",
            montant: a.impotsTaxes + a.impotSocietes,
            part: part(a.impotsTaxes + a.impotSocietes, valeurAjoutee),
          },
          {
            id: "preteurs",
            label: "Prêteurs",
            montant: a.chargesFinancieres,
            part: part(a.chargesFinancieres, valeurAjoutee),
          },
          {
            id: "entreprise",
            label: "Entreprise",
            montant: capaciteAutofinancement,
            part: part(capaciteAutofinancement, valeurAjoutee),
          },
        ]
      : null;

  return {
    soldes,
    valeurAjoutee,
    excedentBrutExploitation,
    resultatExploitation,
    resultatCourantAvantImpots,
    resultatNet,
    capaciteAutofinancement,
    partageValeurAjoutee,
  };
}
