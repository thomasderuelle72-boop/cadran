/**
 * Durée de validité d'un jeton, lue dans l'environnement.
 *
 * jsonwebtoken n'accepte plus une chaîne quelconque : son type exige soit un
 * nombre de secondes, soit une durée de la forme « 12h », « 7d », « 30m ».
 * Une valeur qu'il ne comprend pas ne lève pas d'erreur à la signature — elle
 * produit un jeton dont l'échéance est absurde, et l'on ne s'en aperçoit que
 * le jour où les sessions durent une seconde, ou cent ans.
 *
 * On valide donc à la lecture, et on retombe sur une valeur sûre en
 * prévenant, plutôt que de faire confiance à une variable d'environnement
 * qu'un copier-coller a pu abîmer.
 *
 * Le type et l'expression régulière décrivent volontairement le même
 * ensemble : si l'un acceptait ce que l'autre refuse, la validation ne
 * garantirait plus ce que la signature du module promet.
 */

/** Sous-ensemble des unités de `ms`, suffisant et sans ambiguïté. */
type Unite = "ms" | "s" | "m" | "h" | "d" | "w" | "y";

export type DureeJeton = number | `${number}${Unite}`;

const DUREE = /^(\d+)(ms|s|m|h|d|w|y)?$/;

export const DUREE_PAR_DEFAUT: DureeJeton = "12h";

export function lireDuree(
  valeur: string | undefined,
  avertir: (message: string) => void = console.warn
): DureeJeton {
  if (valeur === undefined || valeur.trim() === "") return DUREE_PAR_DEFAUT;

  const propre = valeur.trim();
  const trouve = DUREE.exec(propre);
  if (!trouve) {
    avertir(
      `JWT_EXPIRES_IN vaut « ${valeur} », que jsonwebtoken ne sait pas lire. ` +
        `Repli sur ${DUREE_PAR_DEFAUT}. Formes admises : 3600, 30m, 12h, 7d.`
    );
    return DUREE_PAR_DEFAUT;
  }

  /* Un nombre nu s'exprime en secondes : le renvoyer en nombre évite que
   * jsonwebtoken ne l'interprète comme des millisecondes. */
  const [, nombre, unite] = trouve;
  if (!unite) return Number(nombre);
  return `${Number(nombre)}${unite as Unite}`;
}
