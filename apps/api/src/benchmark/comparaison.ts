import { RATIOS_SECTORIELS, type Comparabilite, type Contexte, type Sens, type Unite } from "./ratios-sectoriels";
import { situer, type Position, type Quartiles } from "./position";

/**
 * Comparer un dossier aux quartiles de son secteur.
 *
 * Fonction pure : elle reçoit le référentiel du secteur et les chiffres du
 * dossier, et ne sait rien de la base. Tout ce qui pourrait produire une
 * comparaison fausse se vérifie donc sans elle.
 */

export interface ReferenceSecteur {
  source: string;
  millesime: number;
  miseAJour: Date;
  codeSecteur: string;
  libelleSecteur: string;
  /** Division si elle était publiée, section à défaut. */
  niveau: "division" | "section";
  valeurs: Map<string, Quartiles & { nombreEntreprises: number | null }>;
}

export interface RatioCompare {
  id: string;
  libelle: string;
  unite: Unite;
  sens: Sens;
  comparabilite: Comparabilite;
  definition: string;
  ecart: string | null;
  valeur: number | null;
  quartiles: Quartiles | null;
  nombreEntreprises: number | null;
  position: Position | null;
}

export interface ComparaisonSectorielle {
  secteur: { code: string; libelle: string; niveau: "division" | "section" };
  source: {
    nom: string;
    publication: string;
    millesime: number;
    miseAJour: string;
    /**
     * La mention exigée par la Banque de France pour toute réutilisation :
     * la source, la date de dernière mise à jour, et — l'usage étant
     * commercial — la provenance du site institutionnel. Écrite ici plutôt
     * qu'à l'écran pour qu'aucun affichage ne puisse l'oublier.
     */
    mention: string;
  };
  /** Pourquoi la comparaison peut être trompeuse pour ce dossier, s'il y a lieu. */
  avertissements: string[];
  ratios: RatioCompare[];
}

const SOURCES: Record<string, { nom: string; publication: string }> = {
  BANQUE_DE_FRANCE: {
    nom: "Banque de France",
    publication: "fascicules d'indicateurs sectoriels (FIBEN)",
  },
};

function dateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function milliersFr(valeur: number): string {
  return Math.round(valeur).toLocaleString("fr-FR");
}

export function comparer(reference: ReferenceSecteur, contexte: Contexte): ComparaisonSectorielle {
  const source = SOURCES[reference.source] ?? { nom: reference.source, publication: "référentiel sectoriel" };
  const avertissements: string[] = [];

  if (reference.niveau === "section") {
    avertissements.push(
      `Aucun fascicule n'est publié pour la division de ce dossier : la comparaison porte sur toute la section ${reference.codeSecteur}, plus hétérogène.`,
    );
  }

  /*
   * La représentativité se juge sur l'échantillon lui-même, pas sur un seuil
   * écrit ici : chaque fascicule publie les quartiles de chiffre d'affaires de
   * ses entreprises. Une TPE comparée à un échantillon dont le premier quart
   * pèse deux millions n'est pas comparée à ses pairs.
   */
  const tailleCa = reference.valeurs.get("taille_ca");
  const caMilliers = contexte.aggregates.chiffreAffaires / 1000;
  if (tailleCa && caMilliers < tailleCa.q1) {
    avertissements.push(
      `Le chiffre d'affaires de ce dossier (${milliersFr(caMilliers)} k€) est inférieur à celui des trois quarts des entreprises de l'échantillon (premier quartile : ${milliersFr(tailleCa.q1)} k€). La comparaison est indicative.`,
    );
  }

  if (!contexte.effectif || contexte.effectif <= 0) {
    avertissements.push("Effectif non renseigné sur le dossier : les ratios par salarié ne sont pas calculés.");
  }

  const ratios: RatioCompare[] = RATIOS_SECTORIELS.map((definition) => {
    const valeur = definition.calculer(contexte);
    const ref = reference.valeurs.get(definition.id) ?? null;
    const quartiles = ref ? { q1: ref.q1, q2: ref.q2, q3: ref.q3 } : null;
    return {
      id: definition.id,
      libelle: definition.libelle,
      unite: definition.unite,
      sens: definition.sens,
      comparabilite: definition.comparabilite,
      definition: definition.definition,
      ecart: definition.ecart ?? null,
      valeur,
      quartiles,
      nombreEntreprises: ref?.nombreEntreprises ?? null,
      position: valeur !== null && quartiles ? situer(valeur, quartiles, definition.sens) : null,
    };
  });

  return {
    secteur: { code: reference.codeSecteur, libelle: reference.libelleSecteur, niveau: reference.niveau },
    source: {
      nom: source.nom,
      publication: source.publication,
      millesime: reference.millesime,
      miseAJour: reference.miseAJour.toISOString(),
      mention:
        `Source : ${source.nom}, ${source.publication}, données ${reference.millesime}, ` +
        `mise à jour du ${dateFr(reference.miseAJour)}. Informations issues du site institutionnel de la ${source.nom}.`,
    },
    avertissements,
    ratios,
  };
}
