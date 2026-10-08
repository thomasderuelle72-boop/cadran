import type { Sens } from "./ratios-sectoriels";

/**
 * Situer une valeur dans les quartiles d'un secteur.
 *
 * Deux informations distinctes, gardées séparées : **où** se trouve la valeur
 * (un fait, quel que soit le ratio) et **ce que cela veut dire** (qui dépend
 * du sens du ratio). Les mélanger produirait « parmi les meilleurs » pour un
 * délai clients parmi les plus longs.
 */

export interface Quartiles {
  q1: number;
  q2: number;
  q3: number;
}

/** 1 : sous Q1 ; 2 : de Q1 à la médiane ; 3 : de la médiane à Q3 ; 4 : au-delà. */
export type Quart = 1 | 2 | 3 | 4;

export type Lecture = "favorable" | "defavorable" | "intermediaire" | "neutre";

export interface Position {
  quart: Quart;
  lecture: Lecture;
  /** Ce que dit la position, sans jugement. */
  phrase: string;
}

const PHRASES: Record<Quart, string> = {
  1: "Parmi les 25 % les plus bas du secteur",
  2: "Sous la médiane du secteur",
  3: "Au-dessus de la médiane du secteur",
  4: "Parmi les 25 % les plus élevés du secteur",
};

export function quartDe(valeur: number, { q1, q2, q3 }: Quartiles): Quart {
  if (valeur < q1) return 1;
  if (valeur < q2) return 2;
  if (valeur < q3) return 3;
  return 4;
}

/**
 * La lecture ne qualifie que les extrêmes.
 *
 * Être dans le deuxième ou le troisième quart, c'est être comme la moitié des
 * entreprises du secteur : en tirer « bon » ou « mauvais » ferait passer une
 * position ordinaire pour un constat. Seuls les quarts extrêmes sont lus.
 */
export function lire(quart: Quart, sens: Sens): Lecture {
  if (sens === "neutre") return "neutre";
  if (quart === 2 || quart === 3) return "intermediaire";
  const haut = quart === 4;
  return haut === (sens === "haut_favorable") ? "favorable" : "defavorable";
}

export function situer(valeur: number, quartiles: Quartiles, sens: Sens): Position {
  const quart = quartDe(valeur, quartiles);
  return { quart, lecture: lire(quart, sens), phrase: PHRASES[quart] };
}

/**
 * Des quartiles cohérents : trois nombres finis, dans l'ordre.
 *
 * Vérifié à l'import, parce qu'une erreur de saisie ou de lecture du PDF —
 * Q1 et Q3 intervertis — classerait chaque entreprise à l'envers sans que rien
 * ne le signale à l'écran.
 */
export function quartilesValides(q: Partial<Quartiles>): q is Quartiles {
  return (
    typeof q.q1 === "number" &&
    typeof q.q2 === "number" &&
    typeof q.q3 === "number" &&
    Number.isFinite(q.q1) &&
    Number.isFinite(q.q2) &&
    Number.isFinite(q.q3) &&
    q.q1 <= q.q2 &&
    q.q2 <= q.q3
  );
}
