/**
 * Identité légale de l'éditeur du site.
 *
 * Un seul endroit à remplir le jour de l'immatriculation. Les trois pages
 * légales lisent d'ici, et nulle part ailleurs : une adresse recopiée dans
 * deux fichiers finit par diverger, et c'est la version fausse qui restera
 * en ligne.
 *
 * **Les champs inconnus valent `null`, jamais une valeur plausible.** C'est
 * la règle importante de ce fichier. Des mentions légales qui paraissent
 * complètes avec un SIREN inventé sont pires que des mentions absentes :
 * l'absence est une infraction qu'on corrige, une fausse déclaration
 * d'identité est autre chose. Tant qu'un champ est `null`, la page affiche
 * visiblement qu'il manque — personne ne peut croire le site en règle.
 *
 * Rappel de ce qu'exige l'article 6 III de la LCEN pour un site
 * professionnel : dénomination, forme juridique, capital social, adresse du
 * siège, moyen de contact, numéro RCS, numéro de TVA intracommunautaire,
 * directeur de la publication, et l'identité de l'hébergeur.
 */

export interface IdentiteEditeur {
  /** Dénomination sociale. */
  denomination: string | null;
  /** Forme juridique : SAS, SARL, EI… */
  formeJuridique: string | null;
  /** Capital social en euros. Sans objet pour une entreprise individuelle. */
  capitalSocial: number | null;
  /** Adresse du siège, en une seule chaîne. */
  siege: string | null;
  /** Numéro SIREN à neuf chiffres. */
  siren: string | null;
  /** Ville du greffe d'immatriculation au RCS. */
  villeRcs: string | null;
  /** Numéro de TVA intracommunautaire. */
  tvaIntracommunautaire: string | null;
  /** Nom du directeur de la publication (le représentant légal, en général). */
  directeurPublication: string | null;
  /** Adresse de contact. Obligatoire, et la seule qu'on puisse déjà donner. */
  courriel: string;
  /** Téléphone. Facultatif si un autre moyen de contact direct existe. */
  telephone: string | null;
}

export const EDITEUR: IdentiteEditeur = {
  denomination: null,
  formeJuridique: null,
  capitalSocial: null,
  siege: null,
  siren: null,
  villeRcs: null,
  tvaIntracommunautaire: null,
  directeurPublication: null,
  courriel: "contact@cadran.fr",
  telephone: null,
};

/**
 * Hébergeurs, à déclarer nommément.
 *
 * Deux, parce que le site et l'API ne sont pas chez le même prestataire —
 * et les deux hébergent des données. Ce sont par ailleurs des
 * sous-traitants au sens du RGPD, qui doivent figurer dans la politique de
 * confidentialité : la liste ci-dessous sert aux deux pages.
 */
export interface Hebergeur {
  role: string;
  nom: string;
  adresse: string;
  pays: string;
  /** Vrai quand le prestataire ne traite les données que si la
   *  fonctionnalité correspondante est activée sur l'instance. */
  conditionnel?: boolean;
}

export const HEBERGEURS: Hebergeur[] = [
  {
    role: "Conseiller (si activé)",
    nom: "Anthropic PBC",
    adresse: "548 Market St, PMB 90375, San Francisco, CA 94104",
    pays: "États-Unis",
    conditionnel: true,
  },
  {
    role: "Site et interface",
    nom: "Vercel Inc.",
    adresse: "340 S Lemon Ave #4133, Walnut, CA 91789",
    pays: "États-Unis",
  },
  {
    role: "Application et base de données",
    nom: "Railway Corp.",
    adresse: "80 Bowery, New York, NY 10013",
    pays: "États-Unis (hébergement des serveurs : Amsterdam, Pays-Bas)",
  },
];

/** Ce qui s'affiche à la place d'un champ non renseigné. */
export const MARQUEUR_MANQUANT = "[à compléter]";

/**
 * Rend un champ, ou le marqueur s'il manque.
 *
 * Volontairement visible et laid : si cette chaîne apparaît en production,
 * elle doit sauter aux yeux plutôt que de passer pour une mention valide.
 */
export function mention(valeur: string | number | null): string {
  if (valeur === null || valeur === "") return MARQUEUR_MANQUANT;
  return String(valeur);
}

/** L'identité est-elle complète ? Sert à afficher un avertissement en tête
 *  de page tant qu'elle ne l'est pas. */
export function identiteComplete(editeur: IdentiteEditeur = EDITEUR): boolean {
  return (
    editeur.denomination !== null &&
    editeur.formeJuridique !== null &&
    editeur.siege !== null &&
    editeur.siren !== null &&
    editeur.villeRcs !== null &&
    editeur.directeurPublication !== null
  );
}

/** Les champs encore vides, pour les énumérer dans l'avertissement. */
export function champsManquants(editeur: IdentiteEditeur = EDITEUR): string[] {
  const libelles: [keyof IdentiteEditeur, string][] = [
    ["denomination", "dénomination sociale"],
    ["formeJuridique", "forme juridique"],
    ["siege", "adresse du siège"],
    ["siren", "numéro SIREN"],
    ["villeRcs", "ville du RCS"],
    ["directeurPublication", "directeur de la publication"],
    ["tvaIntracommunautaire", "TVA intracommunautaire"],
  ];
  return libelles.filter(([cle]) => editeur[cle] === null).map(([, libelle]) => libelle);
}

/** Date de dernière mise à jour des textes légaux, affichée en pied de page.
 *  Une politique de confidentialité sans date ne dit pas si elle est à jour. */
export const DERNIERE_MISE_A_JOUR = "2 octobre 2026";
