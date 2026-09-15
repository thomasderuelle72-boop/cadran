import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Session par cookie, et sa défense anti-CSRF.
 *
 * Pourquoi quitter le localStorage : le jeton y était lisible par tout
 * JavaScript s'exécutant dans la page. Une seule faille d'injection — une
 * dépendance compromise suffit — et la session part avec. Un cookie
 * `httpOnly` est invisible au JavaScript : le navigateur l'attache, personne
 * ne le lit.
 *
 * Pourquoi ce n'est pas gratuit : le frontend et l'API sont hébergés sur deux
 * sites distincts (vercel.app et up.railway.app). Un cookie ne franchit cette
 * frontière qu'en `SameSite=None`, ce qui annule la protection que
 * `SameSite=Lax` donnait contre la falsification de requête : n'importe quel
 * site pourrait faire émettre au navigateur de la victime une requête
 * authentifiée.
 *
 * D'où le second cookie. Il porte une valeur aléatoire, il est lisible par le
 * JavaScript de l'application, et celui-ci la recopie dans un en-tête à chaque
 * requête modifiante. Un site tiers peut déclencher la requête, mais il ne
 * peut pas lire le cookie — la politique de même origine l'en empêche — donc
 * il ne peut pas produire l'en-tête. C'est le motif du « double envoi ».
 *
 * Le jour où l'API vivra sous le même domaine que le site (api.cadran.fr et
 * cadran.fr), `SameSite=Lax` redeviendra possible et cette mécanique passera
 * de nécessaire à redondante — on la gardera quand même, deux verrous valant
 * mieux qu'un.
 */

export const COOKIE_SESSION = "cadran_session";
export const COOKIE_CSRF = "cadran_csrf";

/** Aligné sur la durée de validité du jeton (JWT_EXPIRES_IN, 7 jours par
 *  défaut) : un cookie qui survit au jeton ne provoque qu'un 401 obscur. */
export const DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/** Ces méthodes ne modifient rien : exiger un en-tête dessus n'apporterait
 *  aucune sécurité et casserait la navigation. */
export const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OptionsCookie {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none";
  path: string;
  maxAge: number;
}

/**
 * En production, le frontend et l'API sont sur deux sites : il faut
 * `SameSite=None`, que les navigateurs n'acceptent qu'avec `Secure`. En
 * développement, tout est sur localhost — même site malgré les ports
 * différents — donc `Lax` suffit et `Secure` empêcherait le cookie en HTTP.
 */
export function optionsSession(production: boolean): OptionsCookie {
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
    maxAge: DUREE_SESSION_MS,
  };
}

/** Mêmes attributs, sauf `httpOnly` : c'est tout l'objet de ce cookie que le
 *  JavaScript de l'application puisse le lire pour le recopier en en-tête. */
export function optionsCsrf(production: boolean): OptionsCookie {
  return { ...optionsSession(production), httpOnly: false };
}

/** 32 octets d'aléa : ni devinable, ni énumérable. */
export function emettreCsrf(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Compare le cookie et l'en-tête à durée constante.
 *
 * Une comparaison naïve renseigne sur le nombre de caractères devinés par la
 * durée du refus — c'est peu, mais on ne compare pas des secrets avec `===`.
 */
export function csrfValide(cookie: unknown, entete: unknown): boolean {
  if (typeof cookie !== "string" || typeof entete !== "string") return false;
  if (cookie.length === 0 || cookie.length !== entete.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(entete));
}

/**
 * L'origine déclarée fait-elle partie des origines autorisées ?
 *
 * Deuxième verrou, indépendant du premier. Le contrôle CORS empêche un site
 * tiers de *lire* nos réponses, mais pas toujours d'émettre la requête : un
 * envoi de formulaire n'est pas soumis à la requête préalable. Vérifier
 * l'origine côté serveur ferme ce cas.
 *
 * Une requête sans en-tête `Origin` est acceptée : les clients hors
 * navigateur n'en envoient pas, et ils ne sont pas exposés à la falsification
 * puisqu'aucun cookie ne leur est attaché automatiquement — le garde ne
 * consulte cette fonction que lorsqu'un cookie de session est présent.
 */
export function origineAutorisee(origine: unknown, autorisees: string[]): boolean {
  if (origine === undefined || origine === null) return true;
  if (typeof origine !== "string") return false;
  return autorisees.includes(origine);
}
