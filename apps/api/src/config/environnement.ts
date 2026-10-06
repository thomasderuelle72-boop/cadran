/**
 * Lecture de la configuration d'exécution.
 *
 * Remplace `@nestjs/config`, qui n'apportait ici qu'une indirection : aucun
 * schéma de validation, aucun espace de noms, aucune configuration par
 * module — rien que `config.get("X")` là où `process.env.X` suffit. Le
 * fichier `.env` est de toute façon chargé par `dotenv` en tête de `main.ts`,
 * avant que le module de configuration n'ait eu la main ; il ne chargeait
 * donc rien non plus.
 *
 * La retirer supprime du même coup `lodash` de l'arbre de production, dont
 * deux vulnérabilités restaient signalées — sans correctif disponible pour la
 * version 4, et alors que les fonctions visées (`template`, `unset`, `omit`)
 * n'étaient même pas celles que le module employait.
 *
 * Trois lectures gardent une fonction nommée, parce qu'elles décident de
 * quelque chose : un repli mal choisi sur l'une d'elles ne provoque pas
 * d'erreur, il change silencieusement le comportement.
 */

/** Une variable absente ou vide vaut absente : `FOO=` dans un .env est un oubli. */
export function lireEnv(cle: string): string | undefined {
  const valeur = process.env[cle];
  return valeur === undefined || valeur.trim() === "" ? undefined : valeur;
}

export function lireEnvOuDefaut(cle: string, defaut: string): string {
  return lireEnv(cle) ?? defaut;
}

/**
 * Sommes-nous en production ?
 *
 * Décide de `Secure` et de `SameSite=None` sur le cookie de session. Se
 * tromper du bon côté est sans conséquence en développement ; se tromper de
 * l'autre côté envoie la session en clair.
 */
export function estProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Adresse publique du frontend, utilisée dans les liens envoyés par courriel
 * et dans les retours de paiement.
 */
export function urlApplication(): string {
  return lireEnvOuDefaut("APP_URL", "http://localhost:5173");
}

/**
 * Origines autorisées à appeler l'API depuis un navigateur.
 *
 * Le repli sur le frontend local est délibéré : une instance mal configurée
 * doit refuser les appels, pas les accepter tous.
 */
export function originesAutorisees(): string[] {
  return lireEnvOuDefaut("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((origine) => origine.trim())
    .filter(Boolean);
}
