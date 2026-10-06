import {
  Aggregates,
  Derived,
  RatioUnit,
  RatioValue,
  computeDerived,
  computeRatios,
} from "../ratios/engine";

/**
 * Catalogue des grandeurs qu'un tableau de bord peut tracer.
 *
 * Il sert à deux choses que rien d'autre ne sait faire : proposer un choix à
 * l'écran, et dire de quelle **unité** relève chaque grandeur. La seconde est
 * la plus importante. Un graphique qui superpose un chiffre d'affaires en
 * millions et une marge en pourcentage sur un seul axe ne montre rien ; le
 * réflexe est alors d'ajouter un second axe, et deux échelles superposées
 * permettent de faire dire n'importe quoi à deux courbes selon la façon dont
 * on les cadre. On interdit donc le mélange, et c'est l'unité déclarée ici
 * qui permet de l'interdire.
 *
 * Les ratios ne sont pas recopiés : ils sont lus dans le moteur lui-même, en
 * l'exécutant une fois sur des agrégats nuls. Une liste tenue à la main
 * finirait par mentir sur un libellé ou une unité, et personne ne s'en
 * apercevrait avant de lire un graphique faux.
 */

export type FamilleMesure = "resultat" | "bilan" | "intermediaire" | "ratio";

export interface Mesure {
  id: string;
  label: string;
  unite: RatioUnit;
  famille: FamilleMesure;
  /** Un ratio ne s'additionne pas : l'écran ne doit pas proposer d'empiler. */
  cumulable: boolean;
}

const LABELS_AGGREGATS: Record<keyof Aggregates, { label: string; famille: FamilleMesure }> = {
  chiffreAffaires: { label: "Chiffre d'affaires", famille: "resultat" },
  achatsConsommes: { label: "Achats consommés", famille: "resultat" },
  chargesExternes: { label: "Charges externes", famille: "resultat" },
  chargesPersonnel: { label: "Charges de personnel", famille: "resultat" },
  impotsTaxes: { label: "Impôts et taxes", famille: "resultat" },
  dotationsAmortissements: { label: "Dotations aux amortissements", famille: "resultat" },
  autresProduitsChargesExploitation: {
    label: "Autres produits et charges d'exploitation",
    famille: "resultat",
  },
  chargesFinancieres: { label: "Charges financières", famille: "resultat" },
  produitsFinanciers: { label: "Produits financiers", famille: "resultat" },
  resultatExceptionnel: { label: "Résultat exceptionnel", famille: "resultat" },
  impotSocietes: { label: "Impôt sur les sociétés", famille: "resultat" },
  stocks: { label: "Stocks", famille: "bilan" },
  creancesClients: { label: "Créances clients", famille: "bilan" },
  autresCreances: { label: "Autres créances", famille: "bilan" },
  disponibilites: { label: "Disponibilités", famille: "bilan" },
  capitauxPropres: { label: "Capitaux propres", famille: "bilan" },
  dettesFinancieres: { label: "Dettes financières", famille: "bilan" },
  dettesFournisseurs: { label: "Dettes fournisseurs", famille: "bilan" },
  autresDettes: { label: "Autres dettes", famille: "bilan" },
  immobilisations: { label: "Immobilisations", famille: "bilan" },
};

const LABELS_DERIVES: Record<keyof Derived, { label: string; famille: FamilleMesure }> = {
  ebitda: { label: "EBITDA", famille: "intermediaire" },
  ebit: { label: "EBIT — résultat d'exploitation", famille: "intermediaire" },
  resultatFinancier: { label: "Résultat financier", famille: "intermediaire" },
  resultatNet: { label: "Résultat net", famille: "intermediaire" },
  actifCirculant: { label: "Actif circulant", famille: "bilan" },
  passifCirculant: { label: "Passif circulant", famille: "bilan" },
  totalActif: { label: "Total actif", famille: "bilan" },
  totalPassif: { label: "Total passif", famille: "bilan" },
  ecartBilan: { label: "Écart de bilan", famille: "bilan" },
  ressourcesStables: { label: "Ressources stables", famille: "bilan" },
  emploisStables: { label: "Emplois stables", famille: "bilan" },
  fondsDeRoulement: { label: "Fonds de roulement", famille: "intermediaire" },
  bfr: { label: "Besoin en fonds de roulement", famille: "intermediaire" },
  tresorerieNette: { label: "Trésorerie nette", famille: "intermediaire" },
};

/** Agrégats nuls : sert à faire parler le moteur sans données. */
function agregatsNuls(): Aggregates {
  const vide = {} as Aggregates;
  for (const cle of Object.keys(LABELS_AGGREGATS) as (keyof Aggregates)[]) vide[cle] = 0;
  return vide;
}

function mesuresRatios(): Mesure[] {
  const nuls = agregatsNuls();
  return computeRatios(nuls, computeDerived(nuls)).map((ratio) => ({
    id: `ratio.${ratio.id}`,
    label: ratio.label,
    unite: ratio.unit,
    famille: "ratio" as const,
    cumulable: false,
  }));
}

export const MESURES: Mesure[] = [
  ...(Object.entries(LABELS_AGGREGATS) as [keyof Aggregates, { label: string; famille: FamilleMesure }][]).map(
    ([cle, { label, famille }]) => ({
      id: `agregat.${cle}`,
      label,
      unite: "devise" as RatioUnit,
      famille,
      cumulable: true,
    })
  ),
  ...(Object.entries(LABELS_DERIVES) as [keyof Derived, { label: string; famille: FamilleMesure }][]).map(
    ([cle, { label, famille }]) => ({
      id: `derive.${cle}`,
      label,
      unite: "devise" as RatioUnit,
      famille,
      // Un solde intermédiaire est une différence, pas une part : l'empiler
      // avec d'autres additionnerait des grandeurs qui se recouvrent.
      cumulable: false,
    })
  ),
  ...mesuresRatios(),
];

const PAR_ID = new Map(MESURES.map((mesure) => [mesure.id, mesure]));

export function mesure(id: string): Mesure | undefined {
  return PAR_ID.get(id);
}

/**
 * Valeur d'une mesure pour un exercice donné.
 *
 * Rend `null` et non zéro quand la mesure est inconnue ou indisponible :
 * zéro est une valeur, et l'afficher à la place d'une absence ferait croire à
 * une activité nulle là où il n'y a pas de donnée.
 */
export function valeurMesure(
  id: string,
  source: { aggregates: Aggregates; derived: Derived; ratios: RatioValue[] }
): number | null {
  const [prefixe, cle] = id.split(".", 2);
  if (!cle) return null;

  if (prefixe === "agregat") {
    const valeur = source.aggregates[cle as keyof Aggregates];
    return typeof valeur === "number" ? valeur : null;
  }
  if (prefixe === "derive") {
    const valeur = source.derived[cle as keyof Derived];
    return typeof valeur === "number" ? valeur : null;
  }
  if (prefixe === "ratio") {
    return source.ratios.find((ratio) => ratio.id === cle)?.value ?? null;
  }
  return null;
}

/**
 * Deux mesures peuvent-elles partager un axe ?
 *
 * La règle tient en une ligne — même unité — et c'est elle qui empêche le
 * double axe. Elle vit ici plutôt qu'à l'écran parce que le serveur doit
 * pouvoir refuser une configuration qui l'enfreint, qu'elle vienne de notre
 * interface ou d'un appel direct.
 */
export function memeAxe(ids: string[]): boolean {
  const unites = new Set(ids.map((id) => mesure(id)?.unite).filter(Boolean));
  return unites.size <= 1;
}
