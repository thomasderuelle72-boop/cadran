import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Jetons de réinitialisation de mot de passe.
 *
 * Le jeton est traité comme un mot de passe, parce que c'en est un : celui
 * qui le détient peut prendre le compte. Il n'est donc jamais stocké en
 * clair — la base garde son empreinte, exactement comme pour les mots de
 * passe. Une fuite de la table ne donnerait alors aucun accès.
 *
 * SHA-256 suffit ici, là où un mot de passe exige bcrypt : un jeton de 256
 * bits tiré au hasard n'est pas devinable par force brute, contrairement à un
 * mot de passe choisi par un humain. Le coût de bcrypt protège contre les
 * dictionnaires, qui n'ont pas de prise sur de l'aléa pur.
 */

/** Une heure : assez pour relever ses courriels, trop court pour traîner. */
export const VALIDITE_JETON_MS = 60 * 60 * 1000;

export interface JetonEmis {
  /** Envoyé par courriel, jamais conservé. */
  jetonClair: string;
  /** Conservé en base à la place du jeton. */
  empreinte: string;
  expireLe: Date;
}

export function emettreJeton(maintenant = new Date()): JetonEmis {
  // 32 octets : le jeton voyage dans une URL, et 256 bits d'entropie rendent
  // toute énumération sans objet.
  const jetonClair = randomBytes(32).toString("base64url");
  return {
    jetonClair,
    empreinte: empreinteDe(jetonClair),
    expireLe: new Date(maintenant.getTime() + VALIDITE_JETON_MS),
  };
}

export function empreinteDe(jetonClair: string): string {
  return createHash("sha256").update(jetonClair).digest("hex");
}

/**
 * Compare deux empreintes en temps constant.
 *
 * Une comparaison ordinaire s'arrête au premier octet différent, et sa durée
 * renseigne sur le nombre d'octets déjà justes. Sur un secret, ça se mesure
 * et ça se remonte.
 */
export function empreintesEgales(a: string, b: string): boolean {
  const ta = Buffer.from(a, "utf8");
  const tb = Buffer.from(b, "utf8");
  // timingSafeEqual exige des longueurs égales ; on ne compare donc que des
  // empreintes, qui en ont toujours une fixe.
  if (ta.length !== tb.length) return false;
  return timingSafeEqual(ta, tb);
}

export type MotifRefus = "introuvable" | "expire" | "deja-utilise";

export interface JetonEnBase {
  empreinte: string;
  expireLe: Date;
  utiliseLe: Date | null;
}

/**
 * Décide si un jeton présenté est utilisable.
 *
 * Les trois motifs de refus sont distingués ici pour les journaux, jamais
 * pour la réponse envoyée : dire « ce jeton a déjà servi » confirmerait à un
 * inconnu qu'il a existé.
 */
export function verifierJeton(
  jetonClair: string,
  enBase: JetonEnBase | null,
  maintenant = new Date()
): { valide: true } | { valide: false; motif: MotifRefus } {
  if (!enBase) return { valide: false, motif: "introuvable" };
  if (!empreintesEgales(empreinteDe(jetonClair), enBase.empreinte)) {
    return { valide: false, motif: "introuvable" };
  }
  if (enBase.utiliseLe !== null) return { valide: false, motif: "deja-utilise" };
  if (enBase.expireLe.getTime() <= maintenant.getTime()) {
    return { valide: false, motif: "expire" };
  }
  return { valide: true };
}
