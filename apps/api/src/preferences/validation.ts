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

export const VALIDATEURS: Record<string, (brut: unknown) => Verdict<unknown>> = {
  evolution: validerEvolution,
};

export function cleConnue(cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(VALIDATEURS, cle);
}
