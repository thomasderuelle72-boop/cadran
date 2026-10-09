import type { RatioUnit, SerieExercice } from "../api/types";
import { montantCourt, valeur } from "./evolution";

/**
 * Les lignes du tableau pluriannuel, dans l'ordre d'une plaquette.
 *
 * C'est le document que les experts-comptables et leurs clients connaissent :
 * les soldes intermédiaires de gestion, puis le bilan, puis l'équilibre
 * financier, puis les indicateurs — un exercice par colonne. Chaque ligne dit
 * comment elle se calcule, dans quel sens elle est bonne, et si elle figure
 * dans le modèle proposé par défaut. Le cabinet choisit les siennes.
 */

export type GroupeLigne = "Activité et résultat" | "Bilan" | "Équilibre financier" | "Indicateurs";

export interface LigneTableau {
  id: string;
  libelle: string;
  groupe: GroupeLigne;
  unite: RatioUnit;
  /** Un flux du compte de résultat : on peut le rapporter au chiffre d'affaires. */
  flux?: boolean;
  /** Un solde ou un total : en gras. */
  total?: boolean;
  /** +1 quand une hausse est une bonne nouvelle, −1 quand c'est une mauvaise, 0 quand ça dépend. */
  sens: 1 | -1 | 0;
  parDefaut: boolean;
  calcul: (exercice: SerieExercice) => number | null;
}

const lire = (id: string) => (e: SerieExercice) => valeur(e, id);

/** Somme de postes ; nulle seulement si tous manquent. */
function somme(e: SerieExercice, termes: Array<[string, 1 | -1]>): number | null {
  const valeurs = termes.map(([id, signe]) => {
    const v = valeur(e, id);
    return v === null ? null : v * signe;
  });
  if (valeurs.every((v) => v === null)) return null;
  return valeurs.reduce<number>((s, v) => s + (v ?? 0), 0);
}

export const LIGNES: LigneTableau[] = [
  // --- Activité et résultat ---
  { id: "ca", libelle: "Chiffre d'affaires", groupe: "Activité et résultat", unite: "devise", flux: true, total: true, sens: 1, parDefaut: true, calcul: lire("agregat.chiffreAffaires") },
  { id: "achats", libelle: "Achats consommés", groupe: "Activité et résultat", unite: "devise", flux: true, sens: -1, parDefaut: true, calcul: lire("agregat.achatsConsommes") },
  { id: "externes", libelle: "Charges externes", groupe: "Activité et résultat", unite: "devise", flux: true, sens: -1, parDefaut: true, calcul: lire("agregat.chargesExternes") },
  {
    id: "va",
    libelle: "Valeur ajoutée",
    groupe: "Activité et résultat",
    unite: "devise",
    flux: true,
    total: true,
    sens: 1,
    parDefaut: true,
    calcul: (e) =>
      somme(e, [
        ["agregat.chiffreAffaires", 1],
        ["agregat.achatsConsommes", -1],
        ["agregat.chargesExternes", -1],
      ]),
  },
  { id: "personnel", libelle: "Charges de personnel", groupe: "Activité et résultat", unite: "devise", flux: true, sens: -1, parDefaut: true, calcul: lire("agregat.chargesPersonnel") },
  { id: "impots", libelle: "Impôts et taxes", groupe: "Activité et résultat", unite: "devise", flux: true, sens: -1, parDefaut: false, calcul: lire("agregat.impotsTaxes") },
  { id: "ebitda", libelle: "EBITDA (excédent brut d'exploitation)", groupe: "Activité et résultat", unite: "devise", flux: true, total: true, sens: 1, parDefaut: true, calcul: lire("derive.ebitda") },
  { id: "dotations", libelle: "Dotations aux amortissements", groupe: "Activité et résultat", unite: "devise", flux: true, sens: 0, parDefaut: true, calcul: lire("agregat.dotationsAmortissements") },
  { id: "rex", libelle: "Résultat d'exploitation", groupe: "Activité et résultat", unite: "devise", flux: true, total: true, sens: 1, parDefaut: true, calcul: lire("derive.ebit") },
  { id: "rfin", libelle: "Résultat financier", groupe: "Activité et résultat", unite: "devise", flux: true, sens: 1, parDefaut: false, calcul: lire("derive.resultatFinancier") },
  { id: "rexc", libelle: "Résultat exceptionnel", groupe: "Activité et résultat", unite: "devise", flux: true, sens: 1, parDefaut: false, calcul: lire("agregat.resultatExceptionnel") },
  { id: "is", libelle: "Impôt sur les sociétés", groupe: "Activité et résultat", unite: "devise", flux: true, sens: 0, parDefaut: false, calcul: lire("agregat.impotSocietes") },
  { id: "rn", libelle: "Résultat net", groupe: "Activité et résultat", unite: "devise", flux: true, total: true, sens: 1, parDefaut: true, calcul: lire("derive.resultatNet") },
  {
    id: "caf",
    libelle: "Capacité d'autofinancement",
    groupe: "Activité et résultat",
    unite: "devise",
    flux: true,
    total: true,
    sens: 1,
    parDefaut: true,
    calcul: (e) =>
      somme(e, [
        ["derive.resultatNet", 1],
        ["agregat.dotationsAmortissements", 1],
        ["agregat.resultatCessions", -1],
      ]),
  },

  // --- Bilan ---
  { id: "immo", libelle: "Immobilisations", groupe: "Bilan", unite: "devise", sens: 0, parDefaut: true, calcul: lire("agregat.immobilisations") },
  { id: "stocks", libelle: "Stocks", groupe: "Bilan", unite: "devise", sens: 0, parDefaut: true, calcul: lire("agregat.stocks") },
  { id: "creances", libelle: "Créances clients", groupe: "Bilan", unite: "devise", sens: 0, parDefaut: true, calcul: lire("agregat.creancesClients") },
  { id: "dispo", libelle: "Disponibilités", groupe: "Bilan", unite: "devise", sens: 1, parDefaut: true, calcul: lire("agregat.disponibilites") },
  { id: "cp", libelle: "Capitaux propres", groupe: "Bilan", unite: "devise", total: true, sens: 1, parDefaut: true, calcul: lire("agregat.capitauxPropres") },
  { id: "dettesFin", libelle: "Dettes financières", groupe: "Bilan", unite: "devise", sens: -1, parDefaut: true, calcul: lire("agregat.dettesFinancieres") },
  { id: "fournisseurs", libelle: "Dettes fournisseurs", groupe: "Bilan", unite: "devise", sens: 0, parDefaut: true, calcul: lire("agregat.dettesFournisseurs") },

  // --- Équilibre financier ---
  { id: "fr", libelle: "Fonds de roulement", groupe: "Équilibre financier", unite: "devise", sens: 1, parDefaut: true, calcul: lire("derive.fondsDeRoulement") },
  { id: "bfr", libelle: "Besoin en fonds de roulement", groupe: "Équilibre financier", unite: "devise", sens: -1, parDefaut: true, calcul: lire("derive.bfr") },
  { id: "tn", libelle: "Trésorerie nette", groupe: "Équilibre financier", unite: "devise", total: true, sens: 1, parDefaut: true, calcul: lire("derive.tresorerieNette") },

  // --- Indicateurs ---
  { id: "margeBrute", libelle: "Marge brute", groupe: "Indicateurs", unite: "pourcentage", sens: 1, parDefaut: true, calcul: lire("ratio.marge_brute") },
  { id: "margeEbitda", libelle: "Marge d'EBITDA", groupe: "Indicateurs", unite: "pourcentage", sens: 1, parDefaut: true, calcul: lire("ratio.marge_ebitda") },
  { id: "margeNette", libelle: "Marge nette", groupe: "Indicateurs", unite: "pourcentage", sens: 1, parDefaut: true, calcul: lire("ratio.marge_nette") },
  { id: "dso", libelle: "Délai de paiement des clients", groupe: "Indicateurs", unite: "jours", sens: -1, parDefaut: true, calcul: lire("ratio.dso") },
  { id: "dpo", libelle: "Délai de paiement des fournisseurs", groupe: "Indicateurs", unite: "jours", sens: 0, parDefaut: true, calcul: lire("ratio.dpo") },
  { id: "dio", libelle: "Durée de stockage", groupe: "Indicateurs", unite: "jours", sens: -1, parDefaut: true, calcul: lire("ratio.dio") },
  { id: "detteEbitda", libelle: "Dette financière en années d'EBITDA", groupe: "Indicateurs", unite: "annees", sens: -1, parDefaut: true, calcul: (e) => {
    // Sans EBITDA positif, « −12 ans » ne veut rien dire : la ligne reste vide.
    const ebitda = valeur(e, "derive.ebitda");
    return ebitda !== null && ebitda > 0 ? valeur(e, "ratio.capacite_remboursement") : null;
  } },
  { id: "autonomie", libelle: "Autonomie financière", groupe: "Indicateurs", unite: "pourcentage", sens: 1, parDefaut: true, calcul: lire("ratio.autonomie_financiere") },
  { id: "roe", libelle: "Rentabilité des capitaux propres", groupe: "Indicateurs", unite: "pourcentage", sens: 1, parDefaut: false, calcul: lire("ratio.roe") },
  { id: "liquidite", libelle: "Liquidité générale", groupe: "Indicateurs", unite: "ratio", sens: 1, parDefaut: false, calcul: lire("ratio.liquidite_generale") },
  { id: "gearing", libelle: "Dettes financières / capitaux propres", groupe: "Indicateurs", unite: "ratio", sens: -1, parDefaut: false, calcul: lire("ratio.gearing") },
];

export const GROUPES: GroupeLigne[] = ["Activité et résultat", "Bilan", "Équilibre financier", "Indicateurs"];

export const LIGNES_PAR_DEFAUT = LIGNES.filter((l) => l.parDefaut).map((l) => l.id);

/** Les lignes retenues, dans l'ordre du tableau ; les identifiants inconnus sont ignorés. */
export function lignesRetenues(ids: readonly string[] | null | undefined): LigneTableau[] {
  const choisis = new Set(ids && ids.length > 0 ? ids : LIGNES_PAR_DEFAUT);
  return LIGNES.filter((l) => choisis.has(l.id));
}

function nombre(v: number, chiffres = 0): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres });
}

export interface Ecart {
  texte: string;
  /** Bonne nouvelle, mauvaise, ou ni l'une ni l'autre. */
  lecture: "favorable" | "defavorable" | "neutre";
}

/**
 * L'écart du dernier exercice sur le précédent, dans l'unité de la ligne : en
 * euros et en pourcentage pour un montant (le pourcentage seulement sur une
 * base positive), en points pour un taux, en jours pour un délai.
 */
export function ecartLigne(ligne: LigneTableau, avant: number | null, apres: number | null): Ecart | null {
  if (avant === null || apres === null) return null;
  const diff = apres - avant;
  const signe = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
  let texte: string;
  let nul: boolean;
  switch (ligne.unite) {
    case "devise": {
      nul = Math.round(diff) === 0;
      const taux = avant > 0 ? ` · ${signe(diff)}${nombre(Math.abs((diff / avant) * 100), 1)} %` : "";
      texte = nul ? "=" : `${signe(diff)}${montantCourt(Math.abs(diff))}${taux}`;
      break;
    }
    case "pourcentage": {
      const pts = Number(Math.abs(diff * 100).toFixed(1));
      nul = pts === 0;
      texte = nul ? "=" : `${signe(diff)}${nombre(pts, 1)} pt${pts >= 2 ? "s" : ""}`;
      break;
    }
    case "jours": {
      const j = Math.round(Math.abs(diff));
      nul = j === 0;
      texte = nul ? "=" : `${signe(diff)}${j} j`;
      break;
    }
    default: {
      const d = Number(Math.abs(diff).toFixed(1));
      nul = d === 0;
      texte = nul ? "=" : `${signe(diff)}${nombre(d, 1)}`;
    }
  }
  const lecture = nul || ligne.sens === 0 ? "neutre" : diff * ligne.sens > 0 ? "favorable" : "defavorable";
  return { texte, lecture };
}
