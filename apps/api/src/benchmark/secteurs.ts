/**
 * Du code NAF d'un dossier au secteur de comparaison.
 *
 * Les fascicules sont publiés par **division** (les deux premiers chiffres du
 * code NAF : « 25 » pour 2599B) et par **section** (la lettre qui regroupe
 * les divisions : « C » pour l'industrie manufacturière). La division est plus
 * proche du métier ; quand elle n'est pas publiée — moins de cent entreprises
 * dans l'échantillon, ou une seule qui fait l'essentiel de la valeur ajoutée —
 * on se rabat sur la section, en le disant.
 */

/** Première division de chaque section de la NAF rév. 2. */
const SECTIONS: Array<[premiere: number, section: string]> = [
  [1, "A"],
  [5, "B"],
  [10, "C"],
  [35, "D"],
  [36, "E"],
  [41, "F"],
  [45, "G"],
  [49, "H"],
  [55, "I"],
  [58, "J"],
  [64, "K"],
  [68, "L"],
  [69, "M"],
  [77, "N"],
  [84, "O"],
  [85, "P"],
  [86, "Q"],
  [90, "R"],
  [94, "S"],
  [97, "T"],
  [99, "U"],
];

export interface CodesSecteur {
  division: string;
  section: string;
}

/**
 * Accepte « 2599B », « 25.99B », « 25.99Z » ou « 25 ». Renvoie null pour ce
 * qui ne ressemble pas à un code NAF : mieux vaut pas de comparaison qu'une
 * comparaison au mauvais secteur.
 */
export function codesSecteur(nafCode: string | null | undefined): CodesSecteur | null {
  if (!nafCode) return null;
  const chiffres = nafCode.replace(/[\s.]/g, "").match(/^(\d{2})/);
  if (!chiffres) return null;

  const division = Number(chiffres[1]);
  if (division < 1 || division > 99) return null;

  let section: string | null = null;
  for (const [premiere, lettre] of SECTIONS) {
    if (division >= premiere) section = lettre;
  }
  return section ? { division: chiffres[1], section } : null;
}
