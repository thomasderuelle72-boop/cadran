import { IDS_ACCEPTES } from "./ratios-sectoriels";
import { quartilesValides } from "./position";

/**
 * Le format d'import d'un référentiel sectoriel, et sa validation.
 *
 * Le référentiel est importé d'un bloc, par source et par millésime, depuis
 * la console d'administration. Rien n'est livré avec Cadran : les quartiles de
 * la Banque de France ne seront chargés qu'une fois sa réutilisation
 * autorisée par écrit (voir docs/referentiel-sectoriel.md).
 *
 * {
 *   "source": "BANQUE_DE_FRANCE",
 *   "millesime": 2024,
 *   "miseAJour": "2025-11-27",
 *   "secteurs": [
 *     { "code": "25", "libelle": "Fabrication de produits métalliques",
 *       "ratios": { "taux_marge": { "q1": 10, "q2": 20, "q3": 30, "n": 1000 } } }
 *   ]
 * }
 *
 * (Valeurs de l'exemple inventées.)
 *
 * La validation refuse le fichier entier à la première anomalie et dit
 * laquelle. Un import partiel laisserait un référentiel où certains secteurs
 * sont à jour et d'autres non, sans que rien ne permette de le voir.
 */

export interface LigneReference {
  source: string;
  millesime: number;
  miseAJour: Date;
  codeSecteur: string;
  libelleSecteur: string;
  ratioId: string;
  q1: number;
  q2: number;
  q3: number;
  nombreEntreprises: number | null;
}

export type VerdictImport =
  | { valide: true; lignes: LigneReference[]; secteurs: number }
  | { valide: false; motif: string };

const SOURCES = new Set(["BANQUE_DE_FRANCE"]);

/** Une division (« 25 ») ou une section (« C »). */
const CODE_SECTEUR = /^(\d{2}|[A-U])$/;

function refuser(motif: string): VerdictImport {
  return { valide: false, motif };
}

export function validerImport(brut: unknown): VerdictImport {
  if (!brut || typeof brut !== "object") return refuser("Le fichier n'est pas un objet JSON.");
  const r = brut as Record<string, unknown>;

  if (typeof r.source !== "string" || !SOURCES.has(r.source)) {
    return refuser(`Source inconnue : « ${String(r.source)} ». Valeur admise : BANQUE_DE_FRANCE.`);
  }
  if (typeof r.millesime !== "number" || !Number.isInteger(r.millesime) || r.millesime < 2000 || r.millesime > 2100) {
    return refuser("Le millésime doit être une année, par exemple 2024.");
  }
  const miseAJour = typeof r.miseAJour === "string" ? new Date(r.miseAJour) : null;
  if (!miseAJour || Number.isNaN(miseAJour.getTime())) {
    /*
     * Exigée : la Banque de France conditionne la réutilisation à
     * l'affichage de la date de dernière mise à jour. Sans elle, on ne
     * pourrait pas respecter ses conditions à l'écran.
     */
    return refuser("La date de mise à jour (miseAJour, AAAA-MM-JJ) est obligatoire : elle doit être affichée avec la source.");
  }
  if (!Array.isArray(r.secteurs) || r.secteurs.length === 0) {
    return refuser("Aucun secteur dans le fichier.");
  }

  const lignes: LigneReference[] = [];
  const vus = new Set<string>();

  for (const [index, s] of r.secteurs.entries()) {
    const ou = `Secteur n° ${index + 1}`;
    if (!s || typeof s !== "object") return refuser(`${ou} : ce n'est pas un objet.`);
    const secteur = s as Record<string, unknown>;

    if (typeof secteur.code !== "string" || !CODE_SECTEUR.test(secteur.code)) {
      return refuser(`${ou} : code « ${String(secteur.code)} » — attendu une division (« 25 ») ou une section (« C »).`);
    }
    if (vus.has(secteur.code)) return refuser(`${ou} : le code ${secteur.code} figure deux fois.`);
    vus.add(secteur.code);

    if (typeof secteur.libelle !== "string" || !secteur.libelle.trim()) {
      return refuser(`${ou} (${secteur.code}) : libellé manquant.`);
    }
    if (!secteur.ratios || typeof secteur.ratios !== "object") {
      return refuser(`${ou} (${secteur.code}) : aucun ratio.`);
    }

    for (const [ratioId, valeurs] of Object.entries(secteur.ratios as Record<string, unknown>)) {
      if (!IDS_ACCEPTES.has(ratioId)) {
        return refuser(`${ou} (${secteur.code}) : ratio inconnu « ${ratioId} ».`);
      }
      const v = (valeurs ?? {}) as Record<string, unknown>;
      const q = { q1: v.q1 as number, q2: v.q2 as number, q3: v.q3 as number };
      if (!quartilesValides(q)) {
        return refuser(
          `${ou} (${secteur.code}), ${ratioId} : quartiles invalides — trois nombres attendus, avec Q1 ≤ Q2 ≤ Q3.`,
        );
      }
      const n = v.n;
      if (n !== undefined && n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 0)) {
        return refuser(`${ou} (${secteur.code}), ${ratioId} : nombre d'entreprises invalide.`);
      }
      lignes.push({
        source: r.source,
        millesime: r.millesime,
        miseAJour,
        codeSecteur: secteur.code,
        libelleSecteur: secteur.libelle.trim(),
        ratioId,
        ...q,
        nombreEntreprises: typeof n === "number" ? n : null,
      });
    }
  }

  return { valide: true, lignes, secteurs: vus.size };
}
