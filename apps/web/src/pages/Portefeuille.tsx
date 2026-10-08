import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { usePortefeuille } from "../api/hooks";
import type { EtatDossier, LignePortefeuille } from "../api/types";
import {
  EntetePage,
  EtatVide,
  SqueletteTableau,
  Zone,
} from "../components/etats";
import { choisirDossier } from "../lib/dossierCourant";
import { formatCurrency } from "../lib/format";

/**
 * Le portefeuille du cabinet : tous les dossiers, une ligne chacun.
 *
 * C'est l'écran qu'ouvre un collaborateur le lundi matin, et il ne doit
 * répondre qu'à une question : quels dossiers m'attendent, et pourquoi. D'où
 * le tri par défaut — les dossiers critiques d'abord — et le motif écrit à
 * côté de chaque état : un badge sans raison oblige à ouvrir le dossier pour
 * comprendre, et dans un portefeuille de quarante, c'est ce qu'il faut
 * épargner.
 *
 * Les chiffres sont ceux du dernier exercice complet de chaque dossier, jamais
 * de la dernière période : une colonne qui mêlerait un trimestre et une année
 * ne se trierait plus.
 */

const ETATS: Record<
  EtatDossier,
  { libelle: string; classe: string; rang: number }
> = {
  critique: {
    libelle: "Critique",
    classe: "bg-critical-soft text-critical",
    rang: 0,
  },
  a_surveiller: {
    libelle: "À surveiller",
    classe: "bg-warning-soft text-warning",
    rang: 1,
  },
  incomplet: { libelle: "Incomplet", classe: "bg-ink/5 text-ink-3", rang: 2 },
  sain: { libelle: "Sain", classe: "bg-success-soft text-success", rang: 3 },
};

/*
 * Un état que cet écran ne connaît pas — l'API et l'interface se déploient
 * séparément, et pendant quelques minutes l'une peut précéder l'autre — est
 * affiché tel quel plutôt que de faire tomber la page entière. Un badge gris
 * marqué « inconnu » est un défaut visible ; un écran blanc, un incident.
 */
const ETAT_INCONNU = {
  libelle: "État inconnu",
  classe: "bg-ink/5 text-ink-3",
  rang: 4,
};

function decrire(etat: string) {
  return ETATS[etat as EtatDossier] ?? ETAT_INCONNU;
}

type Filtre = "tous" | EtatDossier;

const FILTRES: { id: Filtre; libelle: string }[] = [
  { id: "tous", libelle: "Tous" },
  { id: "critique", libelle: "Critiques" },
  { id: "a_surveiller", libelle: "À surveiller" },
  { id: "incomplet", libelle: "Incomplets" },
  { id: "sain", libelle: "Sains" },
];

type Colonne =
  | "etat"
  | "nom"
  | "chiffreAffaires"
  | "croissanceCa"
  | "margeEbitda"
  | "resultatNet"
  | "tresorerieNette"
  | "dso";

/*
 * Les deux colonnes de texte ont une largeur plancher : sans elle, les
 * colonnes chiffrées les écrasaient et « Atelier Nova Industrie » tenait sur
 * trois lignes. Les en-têtes chiffrés sont courts, leur intitulé complet en
 * infobulle : « Chiffre d'affaires » en toutes lettres élargissait la colonne
 * au-delà de ses valeurs et poussait les dernières hors de l'écran.
 */
const COLONNES: {
  id: Colonne;
  libelle: string;
  numerique: boolean;
  titre?: string;
  largeur?: string;
}[] = [
  { id: "nom", libelle: "Dossier", numerique: false, largeur: "min-w-[14rem]" },
  { id: "etat", libelle: "État", numerique: false, largeur: "min-w-[12rem]" },
  {
    id: "chiffreAffaires",
    libelle: "CA",
    numerique: true,
    titre: "Chiffre d'affaires du dernier exercice complet",
  },
  {
    id: "croissanceCa",
    libelle: "Évol.",
    numerique: true,
    titre: "Variation sur l'exercice précédent",
  },
  { id: "margeEbitda", libelle: "Marge EBITDA", numerique: true },
  { id: "resultatNet", libelle: "Résultat net", numerique: true },
  {
    id: "tresorerieNette",
    libelle: "Trésorerie",
    numerique: true,
    titre:
      "Trésorerie nette : fonds de roulement moins besoin en fonds de roulement",
  },
  { id: "dso", libelle: "Délai clients", numerique: true },
];

function valeurDeTri(
  ligne: LignePortefeuille,
  colonne: Colonne,
): number | string | null {
  switch (colonne) {
    case "etat":
      return decrire(ligne.etat).rang;
    case "nom":
      return ligne.nom.toLocaleLowerCase("fr");
    default:
      return ligne[colonne];
  }
}

function comparer(
  a: LignePortefeuille,
  b: LignePortefeuille,
  colonne: Colonne,
  sens: 1 | -1,
): number {
  const va = valeurDeTri(a, colonne);
  const vb = valeurDeTri(b, colonne);
  /*
   * Une valeur absente va toujours en fin de liste, quel que soit le sens du
   * tri. Sinon, trier par chiffre d'affaires décroissant ferait remonter en
   * tête les dossiers qui n'en ont pas — exactement ceux qu'on ne cherche pas.
   */
  if (va === null && vb === null) return a.nom.localeCompare(b.nom, "fr");
  if (va === null) return 1;
  if (vb === null) return -1;
  if (va < vb) return -sens;
  if (va > vb) return sens;
  return a.nom.localeCompare(b.nom, "fr");
}

function pourcentage(valeur: number | null, signe = false): string {
  if (valeur === null) return "—";
  const texte = `${(valeur * 100).toFixed(1).replace(".", ",")} %`;
  return signe && valeur > 0 ? `+${texte}` : texte;
}

function anciennete(mois: number | null): string | null {
  if (mois === null) return null;
  if (mois === 0) return "données du mois";
  return `données d'il y a ${mois} mois`;
}

function montant(valeur: number | null, devise: string): string {
  return valeur === null ? "—" : formatCurrency(valeur, devise);
}

export function PortefeuillePage() {
  const { data: lignes, isLoading, error, refetch } = usePortefeuille();
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<{ colonne: Colonne; sens: 1 | -1 }>({
    colonne: "etat",
    sens: 1,
  });

  const comptes = useMemo(() => {
    const parEtat: Record<Filtre, number> = {
      tous: 0,
      critique: 0,
      a_surveiller: 0,
      incomplet: 0,
      sain: 0,
    };
    for (const ligne of lignes ?? []) {
      parEtat.tous += 1;
      if (ligne.etat in parEtat) parEtat[ligne.etat] += 1;
    }
    return parEtat;
  }, [lignes]);

  const visibles = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase("fr");
    return (lignes ?? [])
      .filter((l) => filtre === "tous" || l.etat === filtre)
      .filter(
        (l) =>
          !motif ||
          l.nom.toLocaleLowerCase("fr").includes(motif) ||
          l.nafCode?.toLowerCase().includes(motif),
      )
      .sort((a, b) => comparer(a, b, tri.colonne, tri.sens));
  }, [lignes, filtre, recherche, tri]);

  function trierPar(colonne: Colonne) {
    setTri((actuel) =>
      actuel.colonne === colonne
        ? { colonne, sens: actuel.sens === 1 ? -1 : 1 }
        : // Les montants se lisent du plus grand au plus petit ; l'état et le
          // nom, dans l'ordre naturel.
          { colonne, sens: colonne === "nom" || colonne === "etat" ? 1 : -1 },
    );
  }

  function ouvrir(ligne: LignePortefeuille) {
    choisirDossier(ligne.id);
    // Un dossier sans aucune période n'a rien à montrer au tableau de bord :
    // ce qu'on y fait d'abord, c'est un import. Un dossier qui a des périodes
    // sans exercice complet, lui, a déjà de quoi être regardé.
    navigate(ligne.dernieresDonnees === null ? "/import" : "/tableau-de-bord");
  }

  const sousTitre =
    lignes && lignes.length > 0
      ? `${lignes.length} dossier${lignes.length > 1 ? "s" : ""} · chiffres du dernier exercice complet`
      : undefined;

  return (
    <div className="space-y-6">
      <EntetePage titre="Portefeuille" sousTitre={sousTitre} />

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="le portefeuille"
        squelette={<SqueletteTableau lignes={6} colonnes={8} />}
      >
        {!lignes || lignes.length === 0 ? (
          <EtatVide
            titre="Aucun dossier"
            action={{ to: "/import", label: "Importer un dossier" }}
          >
            Le portefeuille réunit tous les dossiers du cabinet. Importez un FEC
            ou une balance pour créer le premier.
          </EtatVide>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-rule/10">
              <div
                role="tablist"
                aria-label="Filtrer par état"
                className="flex flex-wrap gap-1"
              >
                {FILTRES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filtre === f.id}
                    disabled={f.id !== "tous" && comptes[f.id] === 0}
                    onClick={() => setFiltre(f.id)}
                    className={`rounded-md px-2.5 py-1 text-sm transition-colors disabled:opacity-35 disabled:cursor-default ${
                      filtre === f.id
                        ? "bg-ink/10 font-medium text-ink"
                        : "text-ink-3 hover:bg-ink/5"
                    }`}
                  >
                    {f.libelle}
                    <span className="ml-1.5 tabular-nums text-ink-3">
                      {comptes[f.id]}
                    </span>
                  </button>
                ))}
              </div>
              <input
                id="recherche-portefeuille"
                type="search"
                className="input w-64 text-sm"
                placeholder="Nom du dossier ou code NAF"
                aria-label="Rechercher un dossier"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                    {COLONNES.map((c) => (
                      <th
                        key={c.id}
                        scope="col"
                        title={c.titre}
                        aria-sort={
                          tri.colonne === c.id
                            ? tri.sens === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`px-3 py-2 font-medium whitespace-nowrap ${c.numerique ? "text-right" : ""} ${c.largeur ?? ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => trierPar(c.id)}
                          className="uppercase tracking-wide hover:text-ink"
                        >
                          {c.libelle}
                          {tri.colonne === c.id && (
                            <span aria-hidden>
                              {" "}
                              {tri.sens === 1 ? "↑" : "↓"}
                            </span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((ligne) => {
                    const etat = decrire(ligne.etat);
                    const [motif, ...autres] = ligne.motifs;
                    const age = anciennete(ligne.moisDepuisDernieresDonnees);
                    return (
                      <tr
                        key={ligne.id}
                        onClick={() => ouvrir(ligne)}
                        className="border-b border-rule/5 last:border-0 hover:bg-ink/[0.03] cursor-pointer align-top"
                      >
                        <td className="px-3 py-3">
                          {/* Le nom est le vrai contrôle : la ligne cliquable ne
                              s'atteint pas au clavier, le bouton si. */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              ouvrir(ligne);
                            }}
                            className="font-medium text-left hover:text-primary focus-visible:text-primary"
                          >
                            {ligne.nom}
                          </button>
                          <div
                            className="text-xs text-ink-3 mt-0.5"
                            title={
                              ligne.dernieresDonnees
                                ? `Dernière période importée : fin le ${new Date(ligne.dernieresDonnees).toLocaleDateString("fr-FR")}`
                                : undefined
                            }
                          >
                            {[
                              ligne.nafCode
                                ? `NAF ${ligne.nafCode}`
                                : "NAF non renseigné",
                              ligne.exercice,
                              age,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${etat.classe}`}
                          >
                            {etat.libelle}
                          </span>
                          {motif && (
                            <div
                              className="text-xs text-ink-3 mt-1"
                              title={ligne.motifs.join(" · ")}
                            >
                              {motif}
                              {autres.length > 0 && (
                                <span className="text-ink-3">
                                  {" "}
                                  · +{autres.length}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          {montant(ligne.chiffreAffaires, ligne.devise)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink-2 whitespace-nowrap">
                          {pourcentage(ligne.croissanceCa, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          {pourcentage(ligne.margeEbitda)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          {montant(ligne.resultatNet, ligne.devise)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          {montant(ligne.tresorerieNette, ligne.devise)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          {ligne.dso === null
                            ? "—"
                            : `${Math.round(ligne.dso)} j`}
                        </td>
                      </tr>
                    );
                  })}
                  {visibles.length === 0 && (
                    <tr>
                      <td
                        colSpan={COLONNES.length}
                        className="px-4 py-8 text-center text-sm text-ink-3"
                      >
                        {recherche.trim()
                          ? `Aucun dossier ne correspond à « ${recherche.trim()} ».`
                          : "Aucun dossier dans cette catégorie."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Zone>
    </div>
  );
}
