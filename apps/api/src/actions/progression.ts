/**
 * Avancement d'une action vers sa cible.
 *
 * Module pur, isolé du service pour être testable : c'est le calcul sur
 * lequel repose tout l'intérêt du plan d'action, et il n'est pas
 * intuitif. Le piège est de rapporter la valeur actuelle à la cible ; ça
 * ne marche que pour les indicateurs qu'on veut voir monter.
 *
 * On mesure donc le chemin parcouru sur le chemin à parcourir. Un DSO
 * qu'on veut ramener de 83 à 65 jours et qui est à 74 a fait la moitié du
 * trajet — alors que 74/65 dirait « 114 % », ce qui ne veut rien dire.
 */

export interface Progression {
  /** 0 au départ, 1 à la cible. Peut sortir de [0, 1], et c'est voulu. */
  valeur: number | null;
  cibleAtteinte: boolean | null;
  /** Sens de l'objectif : monter ou descendre. */
  sens: "hausse" | "baisse" | null;
}

export function calculerProgression(
  valeurInitiale: number | null,
  valeurCible: number | null,
  valeurActuelle: number | null
): Progression {
  if (valeurInitiale === null || valeurCible === null || valeurActuelle === null) {
    return { valeur: null, cibleAtteinte: null, sens: null };
  }

  const chemin = valeurCible - valeurInitiale;
  if (chemin === 0) {
    // Une cible égale au point de départ ne définit aucun chemin. Renvoyer
    // zéro laisserait croire que rien n'a été fait ; renvoyer un ratio serait
    // une division par zéro déguisée.
    return { valeur: null, cibleAtteinte: valeurActuelle === valeurCible, sens: null };
  }

  const sens = chemin > 0 ? "hausse" : "baisse";
  const parcours = (valeurActuelle - valeurInitiale) / chemin;

  return {
    // Volontairement non écrêté : au-delà de 1 la cible est dépassée, en
    // dessous de 0 on s'est éloigné — deux informations utiles qu'un
    // Math.min/max effacerait. Le zéro négatif, lui, est normalisé : il
    // apparaît dès qu'on part de la valeur initiale d'un objectif de baisse,
    // et se sérialiserait « −0 » en JSON.
    valeur: parcours === 0 ? 0 : parcours,
    cibleAtteinte: sens === "hausse" ? valeurActuelle >= valeurCible : valeurActuelle <= valeurCible,
    sens,
  };
}
