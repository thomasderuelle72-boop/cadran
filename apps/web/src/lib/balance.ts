import type { LinePoste } from "../api/types";

// Même partition que le moteur côté serveur (apps/api/src/ratios/engine.ts) :
// elle sert ici à prévenir l'utilisateur avant l'import, pendant qu'il peut
// encore corriger sa classification.
const POSTES_ACTIF: LinePoste[] = [
  "IMMOBILISATIONS",
  "STOCKS",
  "CREANCES_CLIENTS",
  "AUTRES_CREANCES",
  "DISPONIBILITES",
];

const POSTES_PASSIF: LinePoste[] = [
  "CAPITAUX_PROPRES",
  "DETTES_FINANCIERES",
  "DETTES_FOURNISSEURS",
  "AUTRES_DETTES",
];

export const TOLERANCE_EQUILIBRE_BILAN = 1;

export interface ControleEquilibre {
  totalActif: number;
  totalPassif: number;
  ecart: number;
  equilibre: boolean;
  /** Faux quand aucun poste de bilan n'est présent : rien à contrôler. */
  applicable: boolean;
}

export function controlerEquilibre(lignes: Array<{ poste: LinePoste; total: number }>): ControleEquilibre {
  const somme = (postes: LinePoste[]) =>
    lignes.filter((l) => postes.includes(l.poste)).reduce((total, l) => total + l.total, 0);

  const totalActif = somme(POSTES_ACTIF);
  const totalPassif = somme(POSTES_PASSIF);
  const ecart = totalActif - totalPassif;

  return {
    totalActif,
    totalPassif,
    ecart,
    equilibre: Math.abs(ecart) <= TOLERANCE_EQUILIBRE_BILAN,
    applicable: totalActif !== 0 || totalPassif !== 0,
  };
}
