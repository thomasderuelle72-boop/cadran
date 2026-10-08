import type { Aggregates, Derived } from "../ratios/engine";

/**
 * Les ratios sectoriels, calculés à la manière de la Banque de France.
 *
 * Les fascicules d'indicateurs sectoriels publient des quartiles pour trente
 * ratios dont les définitions ne sont pas celles du moteur de Cadran. Le délai
 * clients y est calculé sur le chiffre d'affaires **toutes taxes comprises** et
 * sur 360 jours ; le « taux de marge » y est l'EBE rapporté à la **valeur
 * ajoutée**, pas au chiffre d'affaires. Placer notre DSO dans leurs quartiles
 * reviendrait à comparer deux grandeurs différentes et à conclure sur l'écart.
 *
 * Chaque ratio est donc recalculé ici selon la définition publiée (« Détail
 * ratio » de chaque fascicule), avec ce que les agrégats de Cadran permettent,
 * et porte une **comparabilité** :
 *
 * - « exacte » quand la définition est reproduite telle quelle ;
 * - « approchée » quand il manque une information au niveau d'agrégat de
 *   Cadran — la phrase `ecart` dit laquelle, et l'écran l'affiche.
 *
 * Les ratios que les agrégats ne permettent pas d'approcher honnêtement
 * (taux d'exportation, marge commerciale, part du personnel extérieur,
 * répartition des revenus…) ne figurent pas ici : un ratio absent vaut mieux
 * qu'un ratio inventé.
 *
 * Unités : celles des fascicules. Pourcentages en points (22,2 pour 22,2 %),
 * délais en jours sur une année de 360, montants par salarié en milliers
 * d'euros.
 */

export type Unite = "pourcentage" | "jours" | "milliers_euros";

/**
 * Ce que signifie une valeur haute.
 *
 * « neutre » pour les ratios de structure : un taux de valeur ajoutée élevé
 * décrit un métier (le conseil) plus qu'une performance, et un coût salarial
 * élevé n'est pas en soi une mauvaise nouvelle. Les juger produirait des
 * conclusions absurdes d'un secteur à l'autre.
 */
export type Sens = "haut_favorable" | "bas_favorable" | "neutre";

export type Comparabilite = "exacte" | "approchee";

export interface Contexte {
  aggregates: Aggregates;
  derived: Derived;
  /** L'exercice complet précédent, pour les taux de variation. */
  precedent?: { aggregates: Aggregates } | null;
  /** Effectif moyen saisi sur le dossier. */
  effectif?: number | null;
}

export interface DefinitionRatio {
  id: string;
  /** Intitulé du fascicule, pour que le lecteur retrouve la ligne. */
  libelle: string;
  unite: Unite;
  sens: Sens;
  comparabilite: Comparabilite;
  /** Définition de la Banque de France, en clair. */
  definition: string;
  /** Ce qui sépare notre calcul du leur. Absent quand il est exact. */
  ecart?: string;
  calculer: (c: Contexte) => number | null;
}

/**
 * TVA appliquée pour ramener un montant hors taxes à son équivalent toutes
 * taxes comprises. Le taux normal : faux pour un exportateur, une activité
 * exonérée ou au taux réduit, et c'est ce que dit l'écart affiché.
 */
export const TAUX_TVA_SUPPOSE = 0.2;

/**
 * Division protégée, à la manière des fascicules : « les ratios ne sont pas
 * calculés pour les dénominateurs inférieurs ou égaux à zéro ». Reproduire la
 * règle évite de placer dans des quartiles une valeur que l'échantillon
 * lui-même aurait écartée.
 */
function diviser(numerateur: number, denominateur: number): number | null {
  if (!Number.isFinite(numerateur) || !Number.isFinite(denominateur) || denominateur <= 0) {
    return null;
  }
  return numerateur / denominateur;
}

function pourcent(valeur: number | null): number | null {
  return valeur === null ? null : valeur * 100;
}

function jours(valeur: number | null): number | null {
  return valeur === null ? null : valeur * 360;
}

/**
 * Valeur ajoutée au niveau d'agrégat de Cadran.
 *
 * La Banque de France la calcule sur la production et les ventes de
 * marchandises ; Cadran ne sépare pas la production stockée et immobilisée,
 * rangées avec les autres produits d'exploitation. L'écart est nul pour une
 * entreprise de services, faible ailleurs.
 */
function valeurAjoutee(a: Aggregates): number {
  return a.chiffreAffaires - a.achatsConsommes - a.chargesExternes;
}

const ECART_VA =
  "Valeur ajoutée calculée sur le chiffre d'affaires : la production stockée et immobilisée n'est pas isolée.";
const ECART_EBE =
  "Excédent brut calculé avec les autres produits et charges de gestion courante, que la Banque de France range après l'EBE.";

export const RATIOS_SECTORIELS: DefinitionRatio[] = [
  {
    id: "variation_ca",
    libelle: "Taux de variation du chiffre d'affaires HT",
    unite: "pourcentage",
    sens: "haut_favorable",
    comparabilite: "exacte",
    definition: "Variation du chiffre d'affaires HT entre deux exercices.",
    calculer: ({ aggregates, precedent }) => {
      if (!precedent) return null;
      const base = diviser(aggregates.chiffreAffaires, precedent.aggregates.chiffreAffaires);
      return base === null ? null : (base - 1) * 100;
    },
  },
  {
    id: "variation_va",
    libelle: "Taux de variation de la valeur ajoutée",
    unite: "pourcentage",
    sens: "haut_favorable",
    comparabilite: "approchee",
    definition: "Variation de la valeur ajoutée entre deux exercices.",
    ecart: ECART_VA,
    calculer: ({ aggregates, precedent }) => {
      if (!precedent) return null;
      const base = diviser(valeurAjoutee(aggregates), valeurAjoutee(precedent.aggregates));
      return base === null ? null : (base - 1) * 100;
    },
  },
  {
    id: "taux_va",
    libelle: "Taux de valeur ajoutée",
    unite: "pourcentage",
    sens: "neutre",
    comparabilite: "approchee",
    definition: "Valeur ajoutée / (production + ventes de marchandises).",
    ecart: ECART_VA,
    calculer: ({ aggregates }) => pourcent(diviser(valeurAjoutee(aggregates), aggregates.chiffreAffaires)),
  },
  {
    id: "delai_clients",
    libelle: "Délai net de règlement des clients",
    unite: "jours",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "(Créances clients − avances reçues) / chiffre d'affaires TTC, en jours.",
    ecart:
      "Chiffre d'affaires TTC reconstitué avec une TVA de 20 % ; les avances reçues des clients ne sont pas déduites.",
    calculer: ({ aggregates }) =>
      jours(diviser(aggregates.creancesClients, aggregates.chiffreAffaires * (1 + TAUX_TVA_SUPPOSE))),
  },
  {
    id: "delai_fournisseurs",
    libelle: "Délai net de règlement aux fournisseurs",
    unite: "jours",
    sens: "neutre",
    comparabilite: "approchee",
    definition: "(Dettes fournisseurs − avances versées) / achats et charges externes TTC, en jours.",
    ecart:
      "Achats TTC reconstitués avec une TVA de 20 % ; les avances versées et le retraitement du crédit-bail ne sont pas appliqués.",
    calculer: ({ aggregates }) =>
      jours(
        diviser(
          aggregates.dettesFournisseurs,
          (aggregates.achatsConsommes + aggregates.chargesExternes) * (1 + TAUX_TVA_SUPPOSE),
        ),
      ),
  },
  {
    id: "poids_stocks",
    libelle: "Poids des stocks",
    unite: "jours",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "Stocks (marchandises, produits finis, en-cours, approvisionnements) / chiffre d'affaires HT, en jours.",
    ecart: "Stocks retenus pour leur valeur nette de dépréciation.",
    calculer: ({ aggregates }) => jours(diviser(aggregates.stocks, aggregates.chiffreAffaires)),
  },
  {
    id: "poids_bfre",
    libelle: "Poids du BFR d'exploitation",
    unite: "jours",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "Besoin en fonds de roulement d'exploitation / chiffre d'affaires HT, en jours.",
    ecart:
      "BFR calculé sur l'ensemble des autres créances et dettes, sans séparer ce qui relève de l'exploitation.",
    calculer: ({ aggregates: a }) =>
      jours(
        diviser(
          a.stocks + a.creancesClients + a.autresCreances - a.dettesFournisseurs - a.autresDettes,
          a.chiffreAffaires,
        ),
      ),
  },
  {
    id: "rendement_mo",
    libelle: "Rendement de la main d'œuvre",
    unite: "milliers_euros",
    sens: "haut_favorable",
    comparabilite: "approchee",
    definition: "Valeur ajoutée / effectif permanent moyen, en milliers d'euros par personne.",
    ecart: `${ECART_VA} Effectif tel que saisi sur le dossier.`,
    calculer: ({ aggregates, effectif }) => {
      const parPersonne = diviser(valeurAjoutee(aggregates), effectif ?? 0);
      return parPersonne === null ? null : parPersonne / 1000;
    },
  },
  {
    id: "cout_mo",
    libelle: "Coût apparent de la main d'œuvre",
    unite: "milliers_euros",
    sens: "neutre",
    comparabilite: "approchee",
    definition: "Charges de personnel permanent / effectif permanent moyen, en milliers d'euros par personne.",
    ecart:
      "Toutes charges de personnel, intérim compris le cas échéant ; effectif tel que saisi sur le dossier.",
    calculer: ({ aggregates, effectif }) => {
      const parPersonne = diviser(aggregates.chargesPersonnel, effectif ?? 0);
      return parPersonne === null ? null : parPersonne / 1000;
    },
  },
  {
    id: "taux_marge",
    libelle: "Taux de marge",
    unite: "pourcentage",
    sens: "haut_favorable",
    comparabilite: "approchee",
    definition: "Excédent brut d'exploitation / valeur ajoutée.",
    ecart: `${ECART_EBE} ${ECART_VA}`,
    calculer: ({ aggregates, derived }) => pourcent(diviser(derived.ebitda, valeurAjoutee(aggregates))),
  },
  {
    id: "taux_ebg",
    libelle: "Taux d'excédent brut global",
    unite: "pourcentage",
    sens: "haut_favorable",
    comparabilite: "approchee",
    definition: "Excédent brut global / chiffre d'affaires HT.",
    ecart:
      "Excédent brut global approché par l'EBITDA de Cadran, qui comprend aussi les autres produits et charges de gestion courante.",
    calculer: ({ aggregates, derived }) => pourcent(diviser(derived.ebitda, aggregates.chiffreAffaires)),
  },
  {
    id: "poids_interets",
    libelle: "Poids des intérêts sur l'excédent brut global",
    unite: "pourcentage",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "Charges d'intérêts / excédent brut global.",
    ecart: "Toutes charges financières, pas seulement les intérêts ; excédent brut global approché par l'EBITDA.",
    calculer: ({ aggregates, derived }) => pourcent(diviser(aggregates.chargesFinancieres, derived.ebitda)),
  },
  {
    id: "endettement_brut",
    libelle: "Taux brut d'endettement financier",
    unite: "pourcentage",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "Endettement financier / capitaux propres appelés.",
    ecart:
      "Capitaux propres pris en totalité, capital non appelé compris ; crédit-bail non réintégré dans l'endettement.",
    calculer: ({ aggregates }) => pourcent(diviser(aggregates.dettesFinancieres, aggregates.capitauxPropres)),
  },
  {
    id: "endettement_net",
    libelle: "Taux net d'endettement financier",
    unite: "pourcentage",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "Endettement financier net de la trésorerie active / capitaux propres appelés.",
    ecart:
      "Capitaux propres pris en totalité, capital non appelé compris ; crédit-bail non réintégré dans l'endettement.",
    calculer: ({ aggregates }) =>
      pourcent(diviser(aggregates.dettesFinancieres - aggregates.disponibilites, aggregates.capitauxPropres)),
  },
  {
    id: "cout_endettement",
    libelle: "Coût apparent de l'endettement",
    unite: "pourcentage",
    sens: "bas_favorable",
    comparabilite: "approchee",
    definition: "Intérêts et charges assimilées / endettement financier.",
    ecart:
      "Toutes charges financières rapportées à l'endettement de clôture, et non à l'endettement moyen de l'exercice.",
    calculer: ({ aggregates }) => pourcent(diviser(aggregates.chargesFinancieres, aggregates.dettesFinancieres)),
  },
];

/**
 * Descripteurs de taille de l'échantillon, publiés en tête de chaque
 * fascicule. Ils ne se comparent pas : ils disent si la comparaison a un sens.
 */
export const DESCRIPTEURS_TAILLE = ["taille_ca", "taille_effectif"] as const;

export const IDS_ACCEPTES: ReadonlySet<string> = new Set([
  ...RATIOS_SECTORIELS.map((r) => r.id),
  ...DESCRIPTEURS_TAILLE,
]);
