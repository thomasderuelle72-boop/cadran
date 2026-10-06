import { randomInt } from "node:crypto";

/**
 * Fabrication d'un mot de passe provisoire.
 *
 * Trois décisions, chacune contre une erreur classique.
 *
 * **`randomInt` de `node:crypto`, jamais `Math.random`.** Le générateur
 * ordinaire de JavaScript est prévisible : connaissant quelques tirages, on
 * reconstitue son état et donc les suivants. Un mot de passe d'administrateur
 * tiré ainsi est devinable.
 *
 * **Pas de modulo sur un octet aléatoire.** `octet % 62` favorise les
 * premières lettres de l'alphabet, parce que 256 n'est pas un multiple de 62.
 * Le biais est petit mais réel ; `randomInt(n)` rejette les tirages de trop
 * et n'en a pas.
 *
 * **Un alphabet sans caractères ambigus.** Ce mot de passe sera lu dans un
 * terminal, recopié à la main, parfois dicté. `O` et `0`, `l`, `1` et `I`
 * coûtent plus en appels au support qu'ils ne rapportent en entropie — et on
 * la regagne en longueur, qui est gratuite.
 */

/** 0, O, o, 1, l, I écartés : ils se confondent selon la police. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Groupes séparés par un tiret : un mot de passe se recopie par blocs. */
const TAILLE_GROUPE = 5;

/**
 * Longueur par défaut : 20 caractères utiles.
 *
 * Dans un alphabet de 56 signes, cela fait environ 116 bits. Hors d'atteinte
 * d'une attaque hors ligne, ce qui est le seul scénario qui compte ici :
 * en ligne, le limiteur de débit arrête l'affaire bien avant.
 */
export const LONGUEUR_PAR_DEFAUT = 20;

export function genererMotDePasse(longueur: number = LONGUEUR_PAR_DEFAUT): string {
  if (longueur < 12) {
    throw new Error("Un mot de passe de moins de 12 caractères n'a pas à être généré.");
  }
  const signes = Array.from({ length: longueur }, () => ALPHABET[randomInt(ALPHABET.length)]);

  const groupes: string[] = [];
  for (let debut = 0; debut < signes.length; debut += TAILLE_GROUPE) {
    groupes.push(signes.slice(debut, debut + TAILLE_GROUPE).join(""));
  }
  return groupes.join("-");
}

/**
 * Entropie d'un mot de passe tiré dans cet alphabet, en bits.
 *
 * Les tirets ne comptent pas : ils sont à des positions connues d'avance et
 * n'ajoutent rien. Les compter ferait annoncer une solidité qu'on n'a pas,
 * ce qui est pire que de ne rien annoncer.
 */
export function bitsEntropie(longueur: number): number {
  return Math.round(longueur * Math.log2(ALPHABET.length));
}
