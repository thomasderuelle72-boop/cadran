/**
 * Les réglages partagés par un cabinet, clé par clé.
 *
 * Chaque clé a son validateur : la valeur est stockée en JSON, et un JSON
 * qu'on n'a pas vérifié finit toujours par être lu par un écran qui ne s'y
 * attend pas. Le validateur sert à l'écriture (refus motivé) et à la lecture
 * (une valeur devenue invalide est ignorée, l'écran retombe sur son défaut).
 */

export type Verdict<T> = { valide: true; valeur: T } | { valide: false; motif: string };

export interface ModeleEvolution {
  /** Identifiants des lignes du tableau pluriannuel, dans n'importe quel ordre. */
  lignes: string[];
}

const IDENTIFIANT = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

function validerEvolution(brut: unknown): Verdict<ModeleEvolution> {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { valide: false, motif: "Le modèle attendu est un objet { lignes: [...] }." };
  }
  const lignes = (brut as { lignes?: unknown }).lignes;
  if (!Array.isArray(lignes) || lignes.length === 0 || lignes.length > 100) {
    return { valide: false, motif: "Le modèle doit retenir entre 1 et 100 lignes." };
  }
  if (!lignes.every((l) => typeof l === "string" && IDENTIFIANT.test(l))) {
    return { valide: false, motif: "Identifiant de ligne invalide." };
  }
  return { valide: true, valeur: { lignes: [...new Set(lignes as string[])] } };
}

export interface ModeleRapport {
  sections: string[];
  titre: string;
  mot: string;
  conclusion: string;
}

/** Les sections que l'écran sait composer ; une autre serait ignorée sans bruit, on la refuse. */
const SECTIONS_RAPPORT = new Set([
  "garde",
  "mot",
  "synthese",
  "evolution",
  "resultat",
  "bilan",
  "indicateurs",
  "missions",
  "plan",
  "valeur",
  "previsionnel",
  "conclusion",
]);

function texte(brut: unknown, max: number): string | null {
  return typeof brut === "string" && brut.length <= max ? brut : null;
}

function validerRapport(brut: unknown): Verdict<ModeleRapport> {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { valide: false, motif: "Le modèle de rapport attendu est un objet." };
  }
  const objet = brut as Record<string, unknown>;
  const sections = objet.sections;
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > SECTIONS_RAPPORT.size) {
    return { valide: false, motif: "Le rapport doit compter au moins une section." };
  }
  if (!sections.every((s) => typeof s === "string" && SECTIONS_RAPPORT.has(s))) {
    return { valide: false, motif: "Section de rapport inconnue." };
  }
  const titre = texte(objet.titre, 200);
  const mot = texte(objet.mot, 5000);
  const conclusion = texte(objet.conclusion, 5000);
  if (titre === null || mot === null || conclusion === null) {
    return { valide: false, motif: "Titre (200 caractères) ou textes (5 000 caractères) trop longs ou absents." };
  }
  return { valide: true, valeur: { sections: [...new Set(sections as string[])], titre, mot, conclusion } };
}

export const VALIDATEURS: Record<string, (brut: unknown) => Verdict<unknown>> = {
  evolution: validerEvolution,
  rapport: validerRapport,
};

export function cleConnue(cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(VALIDATEURS, cle);
}
