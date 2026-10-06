import { memeAxe, mesure } from "./mesures";

/**
 * Les blocs d'un tableau de bord, et ce qu'on refuse d'en faire.
 *
 * Un tableau de bord configurable laisse composer des graphiques faux aussi
 * facilement que des justes. Les règles ci-dessous sont celles qui, enfreintes,
 * produisent une image qui ment — et comme elles tiennent au sens des
 * grandeurs et non à l'esthétique, elles sont vérifiées par le serveur : une
 * configuration invalide est refusée, qu'elle vienne de notre écran ou d'un
 * appel direct.
 */

export type TypeBloc = "courbe" | "barres" | "empile" | "tableau" | "tuile";

export interface Bloc {
  id: string;
  type: TypeBloc;
  titre: string;
  /** Identifiants de mesures, dans l'ordre d'affichage. */
  mesures: string[];
  largeur: "demi" | "pleine";
}

/**
 * Nombre maximal de séries par type de bloc.
 *
 * Quatre pour les formes colorées : au-delà, deux séries deviennent
 * indiscernables pour un lecteur daltonien, et la palette validée ne compte
 * que quatre teintes. Six pour une composition, qui se lit sur un dégradé
 * d'une seule teinte et non sur des couleurs catégorielles. Un tableau n'a pas
 * cette limite — il nomme chaque ligne.
 */
export const SERIES_MAX: Record<TypeBloc, number> = {
  courbe: 4,
  barres: 4,
  empile: 6,
  tableau: 12,
  tuile: 1,
};

export const TYPES: TypeBloc[] = ["courbe", "barres", "empile", "tableau", "tuile"];

export type Refus =
  | { valide: false; motif: string };

export type Verdict = { valide: true; bloc: Bloc } | Refus;

function texteCourt(valeur: unknown, defaut: string, maximum = 80): string {
  if (typeof valeur !== "string") return defaut;
  const propre = valeur.trim();
  return propre === "" ? defaut : propre.slice(0, maximum);
}

export function validerBloc(brut: unknown): Verdict {
  if (typeof brut !== "object" || brut === null) {
    return { valide: false, motif: "Bloc illisible." };
  }
  const objet = brut as Record<string, unknown>;

  const type = objet.type;
  if (typeof type !== "string" || !TYPES.includes(type as TypeBloc)) {
    return { valide: false, motif: `Type de bloc inconnu. Valeurs admises : ${TYPES.join(", ")}.` };
  }
  const typeBloc = type as TypeBloc;

  const mesures = Array.isArray(objet.mesures) ? objet.mesures.filter((m) => typeof m === "string") : [];
  if (mesures.length === 0) {
    return { valide: false, motif: "Un bloc doit porter au moins une mesure." };
  }

  const inconnue = mesures.find((id) => !mesure(id as string));
  if (inconnue) {
    return { valide: false, motif: `Mesure inconnue : ${inconnue}.` };
  }

  const maximum = SERIES_MAX[typeBloc];
  if (mesures.length > maximum) {
    return {
      valide: false,
      motif:
        typeBloc === "tuile"
          ? "Une tuile ne porte qu'une seule mesure."
          : `Un bloc « ${typeBloc} » accepte ${maximum} mesures au plus ; au-delà, elles ne se distinguent plus.`,
    };
  }

  /*
   * Interdiction du double axe. Superposer un chiffre d'affaires en millions
   * et une marge en pourcentage force à deux échelles, et deux échelles
   * permettent de faire dire à deux courbes ce qu'on veut selon la façon dont
   * on les cadre. Deux grandeurs d'unités différentes demandent deux blocs.
   */
  if (typeBloc !== "tableau" && !memeAxe(mesures as string[])) {
    return {
      valide: false,
      motif:
        "Ces mesures n'ont pas la même unité et ne peuvent pas partager un axe. " +
        "Séparez-les en deux blocs, ou choisissez un tableau.",
    };
  }

  /*
   * Une composition empilée additionne ses segments : le total doit vouloir
   * dire quelque chose. Empiler l'EBITDA et le résultat net — l'un contenant
   * l'autre — donne une hauteur qui ne correspond à rien.
   */
  if (typeBloc === "empile") {
    const nonCumulable = (mesures as string[]).find((id) => !mesure(id)?.cumulable);
    if (nonCumulable) {
      return {
        valide: false,
        motif:
          `« ${mesure(nonCumulable)?.label ?? nonCumulable} » ne s'additionne pas aux autres : ` +
          "un empilement n'a de sens qu'entre postes qui se complètent.",
      };
    }
  }

  return {
    valide: true,
    bloc: {
      id: texteCourt(objet.id, `bloc-${Math.random().toString(36).slice(2, 10)}`, 40),
      type: typeBloc,
      titre: texteCourt(objet.titre, mesure(mesures[0] as string)?.label ?? "Sans titre"),
      mesures: mesures as string[],
      largeur: objet.largeur === "pleine" ? "pleine" : "demi",
    },
  };
}

/** Nombre de blocs admis dans un tableau de bord. */
export const BLOCS_MAX = 24;

export function validerBlocs(brut: unknown): { valide: true; blocs: Bloc[] } | Refus {
  if (!Array.isArray(brut)) return { valide: false, motif: "La configuration doit être une liste de blocs." };
  if (brut.length > BLOCS_MAX) {
    return { valide: false, motif: `Un tableau de bord compte ${BLOCS_MAX} blocs au plus.` };
  }

  const blocs: Bloc[] = [];
  for (const [rang, candidat] of brut.entries()) {
    const verdict = validerBloc(candidat);
    // Le rang est donné parce qu'une liste de douze blocs refusée sans dire
    // lequel oblige à les essayer un par un.
    if (!verdict.valide) return { valide: false, motif: `Bloc ${rang + 1} : ${verdict.motif}` };
    blocs.push(verdict.bloc);
  }
  return { valide: true, blocs };
}

/**
 * Tableau de bord proposé à une entité qui n'en a pas encore.
 *
 * Un écran vide avec un bouton « ajouter un bloc » laisse l'utilisateur
 * inventer ce qu'il devrait regarder. Ces six blocs sont ce qu'un analyste
 * ouvre en premier sur un dossier qu'il ne connaît pas.
 */
export const TABLEAU_PAR_DEFAUT: Bloc[] = [
  {
    id: "ca",
    type: "tuile",
    titre: "Chiffre d'affaires",
    mesures: ["agregat.chiffreAffaires"],
    largeur: "demi",
  },
  {
    id: "resultat",
    type: "tuile",
    titre: "Résultat net",
    mesures: ["derive.resultatNet"],
    largeur: "demi",
  },
  {
    id: "activite",
    type: "courbe",
    titre: "Activité et rentabilité",
    mesures: ["agregat.chiffreAffaires", "derive.ebitda", "derive.resultatNet"],
    largeur: "pleine",
  },
  {
    id: "charges",
    type: "empile",
    titre: "Structure des charges",
    mesures: ["agregat.achatsConsommes", "agregat.chargesExternes", "agregat.chargesPersonnel"],
    largeur: "demi",
  },
  {
    id: "equilibre",
    type: "courbe",
    titre: "Fonds de roulement, BFR et trésorerie",
    mesures: ["derive.fondsDeRoulement", "derive.bfr", "derive.tresorerieNette"],
    largeur: "demi",
  },
  {
    id: "delais",
    type: "barres",
    titre: "Délais d'exploitation",
    mesures: ["ratio.dso", "ratio.dpo", "ratio.dio"],
    largeur: "pleine",
  },
];
