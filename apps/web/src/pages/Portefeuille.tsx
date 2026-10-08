import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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
  { id: "nom", libelle: "Dossier", numerique: false, largeur: "min-w-[13rem]" },
  { id: "etat", libelle: "État", numerique: false },
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
  {
    id: "margeEbitda",
    libelle: "Marge",
    numerique: true,
    titre: "Marge d'EBITDA : EBITDA rapporté au chiffre d'affaires",
  },
  { id: "resultatNet", libelle: "Résultat", numerique: true, titre: "Résultat net" },
  {
    id: "tresorerieNette",
    libelle: "Trésorerie",
    numerique: true,
    titre:
      "Trésorerie nette : fonds de roulement moins besoin en fonds de roulement",
  },
  {
    id: "dso",
    libelle: "Délai cl.",
    numerique: true,
    titre: "Délai moyen de règlement des clients, en jours",
  },
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

/** Tailles de page proposées : assez pour un coup d'œil, pas au point de
 *  faire défiler trois cents lignes pour atteindre la pagination. */
const TAILLES_PAGE = [25, 50, 100] as const;

/**
 * Les numéros de page à afficher : la première, la dernière, et deux de part
 * et d'autre de la page courante. Huit pages pour 361 dossiers tiennent
 * toutes ; au-delà, des points de suspension remplacent les trous.
 */
function pagesAffichees(courante: number, total: number): Array<number | "…"> {
  if (total <= 9) return Array.from({ length: total }, (_, k) => k + 1);
  const garder = new Set([1, total, courante - 1, courante, courante + 1]);
  if (courante <= 4) [2, 3, 4, 5].forEach((n) => garder.add(n));
  if (courante >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach((n) => garder.add(n));
  const triees = [...garder].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultat: Array<number | "…"> = [];
  triees.forEach((n, k) => {
    if (k > 0 && n - triees[k - 1] > 1) resultat.push("…");
    resultat.push(n);
  });
  return resultat;
}

/** La division NAF (deux premiers chiffres) : le secteur au sens des
 *  statistiques, assez fin pour regrouper des métiers voisins. */
function divisionNaf(code: string | null): string | null {
  const chiffres = code?.replace(/[\s.]/g, "").match(/^(\d{2})/);
  return chiffres ? chiffres[1] : null;
}

export function PortefeuillePage() {
  const { data: lignes, isLoading, error, refetch } = usePortefeuille();
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");
  const [exercice, setExercice] = useState("");
  const [secteur, setSecteur] = useState("");
  const [parPage, setParPage] = useState<number>(50);
  const [page, setPage] = useState(1);
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

  /* Les valeurs proposées par les filtres viennent du portefeuille lui-même :
   * un filtre sur un exercice qu'aucun dossier n'a ne servirait à rien. */
  const exercices = useMemo(
    () =>
      [...new Set((lignes ?? []).map((l) => l.exercice).filter((e): e is string => Boolean(e)))].sort((a, b) =>
        b.localeCompare(a, "fr"),
      ),
    [lignes],
  );
  const secteurs = useMemo(() => {
    const compte = new Map<string, number>();
    for (const l of lignes ?? []) {
      const division = divisionNaf(l.nafCode);
      if (division) compte.set(division, (compte.get(division) ?? 0) + 1);
    }
    return [...compte.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [lignes]);

  const visibles = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase("fr");
    return (lignes ?? [])
      .filter((l) => filtre === "tous" || l.etat === filtre)
      .filter((l) => !exercice || l.exercice === exercice)
      .filter((l) => !secteur || divisionNaf(l.nafCode) === secteur)
      .filter(
        (l) =>
          !motif ||
          l.nom.toLocaleLowerCase("fr").includes(motif) ||
          l.nafCode?.toLowerCase().includes(motif),
      )
      .sort((a, b) => comparer(a, b, tri.colonne, tri.sens));
  }, [lignes, filtre, exercice, secteur, recherche, tri]);

  // Un nouveau filtre, une nouvelle recherche ou un nouveau tri repartent de
  // la première page : rester en page 6 d'une liste qui n'en compte plus que
  // deux afficherait un tableau vide.
  useEffect(() => setPage(1), [filtre, exercice, secteur, recherche, tri, parPage]);

  const nombrePages = Math.max(1, Math.ceil(visibles.length / parPage));
  const pageCourante = Math.min(page, nombrePages);
  const debut = (pageCourante - 1) * parPage;
  const affichees = visibles.slice(debut, debut + parPage);
  const filtresActifs = filtre !== "tous" || exercice !== "" || secteur !== "" || recherche.trim() !== "";

  function reinitialiser() {
    setFiltre("tous");
    setExercice("");
    setSecteur("");
    setRecherche("");
  }

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
            {/*
              Barre d'outils en deux rangées : la recherche, qu'on utilise le
              plus, d'abord ; puis les filtres, chacun avec ses effectifs.
            */}
            <div className="px-4 pt-4 pb-3 space-y-3 border-b border-rule/10">
              <div className="relative max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="recherche-portefeuille"
                  type="search"
                  className="input pl-9"
                  placeholder="Rechercher un dossier ou un code NAF"
                  aria-label="Rechercher un dossier"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="tablist"
                  aria-label="Filtrer par état"
                  className="flex flex-wrap gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]"
                >
                  {FILTRES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={filtre === f.id}
                      disabled={f.id !== "tous" && comptes[f.id] === 0}
                      onClick={() => setFiltre(f.id)}
                      className={`rounded-md px-2.5 py-1 text-sm font-medium transition disabled:opacity-40 disabled:cursor-default ${
                        filtre === f.id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      {f.libelle}
                      <span className="ml-1.5 tabular-nums text-ink-3">{comptes[f.id]}</span>
                    </button>
                  ))}
                </div>

                {exercices.length > 1 && (
                  <select
                    className="input w-auto py-1.5"
                    aria-label="Filtrer par exercice"
                    value={exercice}
                    onChange={(e) => setExercice(e.target.value)}
                  >
                    <option value="">Tous les exercices</option>
                    {exercices.map((e) => (
                      <option key={e} value={e}>
                        Exercice {e}
                      </option>
                    ))}
                  </select>
                )}

                {secteurs.length > 1 && (
                  <select
                    className="input w-auto py-1.5"
                    aria-label="Filtrer par secteur"
                    value={secteur}
                    onChange={(e) => setSecteur(e.target.value)}
                  >
                    <option value="">Tous les secteurs</option>
                    {secteurs.map(([division, nombre]) => (
                      <option key={division} value={division}>
                        NAF {division} · {nombre} dossier{nombre > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                )}

                {filtresActifs && (
                  <button
                    type="button"
                    onClick={reinitialiser}
                    className="rounded-md px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary-soft"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10 bg-surface-2">
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
                        className={`px-3 py-2.5 font-semibold whitespace-nowrap ${c.numerique ? "text-right" : ""} ${c.largeur ?? ""} ${
                          c.id === "nom" ? "sticky left-0 z-10 bg-surface-2 border-r border-rule/10" : ""
                        }`}
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
                  {affichees.map((ligne) => {
                    const etat = decrire(ligne.etat);
                    const [motif, ...autres] = ligne.motifs;
                    const age = anciennete(ligne.moisDepuisDernieresDonnees);
                    return (
                      <tr
                        key={ligne.id}
                        onClick={() => ouvrir(ligne)}
                        className="border-b border-rule/5 last:border-0 bg-surface hover:bg-surface-2 cursor-pointer"
                      >
                        {/*
                          Une hauteur de ligne fixe : chaque cellule tient sur
                          une ou deux lignes sans retour, le reste en infobulle.
                          Des lignes de hauteurs inégales empêchent l'œil de
                          suivre une rangée d'un bout à l'autre du tableau.
                        */}
                        {/* Figée au défilement horizontal, comme dans un
                            tableur : on sait toujours de quel dossier on lit
                            la ligne. Son fond hérite de celui de la rangée,
                            pour rester opaque au survol. */}
                        <td className="px-3 py-2 max-w-[17rem] sticky left-0 z-[1] bg-inherit border-r border-rule/10">
                          {/* Le nom est le vrai contrôle : la ligne cliquable ne
                              s'atteint pas au clavier, le bouton si. */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              ouvrir(ligne);
                            }}
                            title={ligne.nom}
                            className="block max-w-full truncate font-semibold text-left hover:text-primary focus-visible:text-primary"
                          >
                            {ligne.nom}
                          </button>
                          <div
                            className="text-xs text-ink-3 mt-0.5 truncate"
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
                        <td className="px-3 py-2 max-w-[15rem]">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${etat.classe}`}
                          >
                            {etat.libelle}
                          </span>
                          {motif && (
                            <div
                              className="text-xs text-ink-3 mt-0.5 truncate"
                              title={ligne.motifs.join(" · ")}
                            >
                              {motif}
                              {autres.length > 0 && ` · +${autres.length}`}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {montant(ligne.chiffreAffaires, ligne.devise)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-2 whitespace-nowrap">
                          {pourcentage(ligne.croissanceCa, true)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {pourcentage(ligne.margeEbitda)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {montant(ligne.resultatNet, ligne.devise)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {montant(ligne.tresorerieNette, ligne.devise)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
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
                          : "Aucun dossier ne correspond à ces filtres."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pied : taille de page à gauche, position et pages à droite. */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-rule/10 text-sm">
              <div className="flex items-center gap-1" role="group" aria-label="Dossiers par page">
                {TAILLES_PAGE.map((taille) => (
                  <button
                    key={taille}
                    type="button"
                    aria-pressed={parPage === taille}
                    onClick={() => setParPage(taille)}
                    className={`rounded-md px-2 py-1 tabular-nums font-medium transition ${
                      parPage === taille ? "bg-primary-soft text-primary" : "text-ink-3 hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    {taille}
                  </button>
                ))}
                <span className="ml-1 text-ink-3">par page</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-ink-3 tabular-nums" aria-live="polite">
                  {visibles.length === 0
                    ? "0 dossier"
                    : `${debut + 1}–${debut + affichees.length} sur ${visibles.length}`}
                </span>
                {nombrePages > 1 && (
                  <nav className="flex items-center gap-0.5" aria-label="Pages du portefeuille">
                    <button
                      type="button"
                      onClick={() => setPage(pageCourante - 1)}
                      disabled={pageCourante === 1}
                      className="p-1.5 rounded-md text-ink-2 hover:bg-ink/5 disabled:opacity-30 disabled:cursor-default"
                      aria-label="Page précédente"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    {pagesAffichees(pageCourante, nombrePages).map((n, k) =>
                      n === "…" ? (
                        <span key={`trou-${k}`} className="px-1 text-ink-3" aria-hidden="true">
                          …
                        </span>
                      ) : (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          aria-current={n === pageCourante ? "page" : undefined}
                          className={`min-w-[2rem] rounded-md px-2 py-1 tabular-nums font-medium transition ${
                            n === pageCourante ? "bg-primary text-paper" : "text-ink-2 hover:bg-ink/5"
                          }`}
                        >
                          {n}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(pageCourante + 1)}
                      disabled={pageCourante === nombrePages}
                      className="p-1.5 rounded-md text-ink-2 hover:bg-ink/5 disabled:opacity-30 disabled:cursor-default"
                      aria-label="Page suivante"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </div>
            </div>
          </div>
        )}
      </Zone>
    </div>
  );
}
