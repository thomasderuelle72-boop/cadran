/**
 * Validation des images de marque téléversées.
 *
 * Accepter un fichier envoyé par un client est le point d'entrée le plus
 * exposé d'une application. Trois règles tiennent ici.
 *
 * **On ne croit pas le type déclaré.** L'en-tête `Content-Type` et
 * l'extension du fichier sont choisis par l'appelant. Le format est donc
 * déterminé par les octets de tête, jamais par ce qu'on nous annonce.
 *
 * **On borne les dimensions, pas seulement le poids.** Une image PNG de
 * 40 ko peut se décompresser en 50 000 × 50 000 pixels : le poids passe le
 * contrôle, et le générateur de PDF s'effondre en essayant de la placer.
 *
 * **Pas de SVG.** C'est pourtant le format idéal pour un logo. Mais un SVG
 * est un document XML : il peut porter du script, référencer des entités
 * externes, et aucun générateur de PDF ne l'embarque sans le convertir. Le
 * refuser coûte un peu de netteté et évite une classe entière d'attaques.
 */

export type FormatImage = "image/png" | "image/jpeg";

/** 2 Mo : large pour un logo, trop petit pour servir de stockage. */
export const POIDS_MAX = 2 * 1024 * 1024;

/** Au-delà, c'est une photographie, pas une marque. */
export const COTE_MAX = 4000;

/** En deçà, le logo sera illisible une fois posé dans un document. */
export const COTE_MIN = 16;

export interface ImageValide {
  format: FormatImage;
  largeur: number;
  hauteur: number;
}

export type Refus =
  | "vide"
  | "trop-lourde"
  | "format-inconnu"
  | "illisible"
  | "trop-grande"
  | "trop-petite";

export const MOTIFS: Record<Refus, string> = {
  vide: "Le fichier est vide.",
  "trop-lourde": `L'image dépasse ${POIDS_MAX / (1024 * 1024)} Mo.`,
  "format-inconnu": "Seuls les fichiers PNG et JPEG sont acceptés.",
  illisible: "Le fichier est annoncé comme une image mais n'a pas pu être lu.",
  "trop-grande": `L'image dépasse ${COTE_MAX} pixels de côté.`,
  "trop-petite": `L'image fait moins de ${COTE_MIN} pixels de côté : elle serait illisible.`,
};

export type Verdict = { valide: true; image: ImageValide } | { valide: false; motif: Refus };

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SIGNATURE_JPEG = [0xff, 0xd8, 0xff];

function commencePar(octets: Buffer, signature: number[]): boolean {
  if (octets.length < signature.length) return false;
  return signature.every((valeur, index) => octets[index] === valeur);
}

/**
 * Dimensions d'un PNG : elles sont dans le bloc IHDR, toujours le premier,
 * à position fixe. Pas de parcours à faire.
 */
function dimensionsPng(octets: Buffer): { largeur: number; hauteur: number } | null {
  // 8 octets de signature + 4 de longueur + 4 de type, puis largeur et hauteur.
  if (octets.length < 24) return null;
  if (octets.toString("ascii", 12, 16) !== "IHDR") return null;
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

/**
 * Dimensions d'un JPEG : il faut parcourir les segments jusqu'au marqueur
 * de début de trame (SOF), dont la position varie selon ce que l'appareil
 * ou le logiciel a inséré avant.
 */
function dimensionsJpeg(octets: Buffer): { largeur: number; hauteur: number } | null {
  let position = 2;
  while (position + 9 < octets.length) {
    if (octets[position] !== 0xff) return null;
    const marqueur = octets[position + 1];

    /* Les SOF portent les dimensions, sauf C4 (table de Huffman), C8
     * (extension) et CC (codage arithmétique), qui partagent la plage sans
     * en être. */
    const estSof =
      marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
    if (estSof) {
      return { hauteur: octets.readUInt16BE(position + 5), largeur: octets.readUInt16BE(position + 7) };
    }

    const longueur = octets.readUInt16BE(position + 2);
    /* Un segment déclare sa propre longueur ; si elle est absurde, le
     * fichier est corrompu ou forgé pour nous faire boucler. */
    if (longueur < 2) return null;
    position += 2 + longueur;
  }
  return null;
}

export function validerImage(octets: Buffer): Verdict {
  if (octets.length === 0) return { valide: false, motif: "vide" };
  if (octets.length > POIDS_MAX) return { valide: false, motif: "trop-lourde" };

  let format: FormatImage;
  let dimensions: { largeur: number; hauteur: number } | null;

  if (commencePar(octets, SIGNATURE_PNG)) {
    format = "image/png";
    dimensions = dimensionsPng(octets);
  } else if (commencePar(octets, SIGNATURE_JPEG)) {
    format = "image/jpeg";
    dimensions = dimensionsJpeg(octets);
  } else {
    return { valide: false, motif: "format-inconnu" };
  }

  if (!dimensions) return { valide: false, motif: "illisible" };
  if (dimensions.largeur > COTE_MAX || dimensions.hauteur > COTE_MAX) {
    return { valide: false, motif: "trop-grande" };
  }
  if (dimensions.largeur < COTE_MIN || dimensions.hauteur < COTE_MIN) {
    return { valide: false, motif: "trop-petite" };
  }

  return { valide: true, image: { format, ...dimensions } };
}

/**
 * Place une image dans une boîte sans la déformer.
 *
 * Le générateur de PDF accepte une largeur et une hauteur imposées, et
 * étire l'image pour les remplir : un logo carré posé dans une boîte large
 * en ressort aplati. On calcule donc la taille qui tient dans la boîte en
 * conservant les proportions, et on ne grossit jamais au-delà de la taille
 * d'origine — un logo de 60 pixels agrandi à 200 est flou, et le flou se
 * remarque plus que la petite taille.
 */
export function ajuster(
  image: { largeur: number; hauteur: number },
  boite: { largeur: number; hauteur: number }
): { largeur: number; hauteur: number } {
  const facteur = Math.min(
    boite.largeur / image.largeur,
    boite.hauteur / image.hauteur,
    1
  );
  return {
    largeur: Math.round(image.largeur * facteur * 100) / 100,
    hauteur: Math.round(image.hauteur * facteur * 100) / 100,
  };
}
