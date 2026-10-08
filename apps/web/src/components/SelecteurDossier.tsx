import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { Check, ChevronDown, Plus, Search, BriefcaseBusiness } from "lucide-react";
import { useEntities } from "../api/hooks";
import type { Entity } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useDossierCourant } from "../lib/dossierCourant";

/**
 * Le dossier courant, en tête d'écran, avec une recherche.
 *
 * Un menu déroulant natif tient à quatre dossiers ; un cabinet en suit
 * plusieurs centaines, et les faire défiler un par un pour trouver
 * « Atelier Maze » n'est pas un geste qu'on répète vingt fois par jour. Le
 * sélecteur s'ouvre sur un champ de recherche déjà actif : on tape trois
 * lettres, Entrée, et on y est. La liste est rangée par initiale, comme
 * un classeur, pour qui préfère la parcourir.
 *
 * Il s'utilise entièrement au clavier (flèches, Entrée, Échap), selon le
 * modèle « combobox » des recommandations d'accessibilité.
 */

/** Pour chercher « societe » et trouver « Société » : sans casse ni accents. */
function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
}

/** Les noms qui ne commencent pas par une lettre sont rangés sous « # ». */
function initiale(nom: string): string {
  const premiere = normaliser(nom.trim()).charAt(0).toLocaleUpperCase("fr");
  return /[A-Z]/.test(premiere) ? premiere : "#";
}

export function SelecteurDossier({ compact = false }: { compact?: boolean }) {
  const { data: entites } = useEntities();
  const [dossier, choisir] = useDossierCourant(entites);
  const { user } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [actif, setActif] = useState(0);
  const cadre = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const id = useId();

  const courant = entites?.find((e) => e.id === dossier);
  const peutAjouter = user?.role === "ADMIN" || user?.role === "DAF";

  const trouves = useMemo(() => {
    const motif = normaliser(recherche.trim());
    return [...(entites ?? [])]
      .filter((e) => !motif || normaliser(e.name).includes(motif) || normaliser(e.nafCode ?? "").includes(motif))
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [entites, recherche]);

  // À l'ouverture, la recherche repart de zéro et la sélection se place sur
  // le dossier courant : c'est de lui qu'on part.
  useEffect(() => {
    if (!ouvert) return;
    setRecherche("");
    champ.current?.focus();
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const index = trouves.findIndex((e) => e.id === dossier);
    setActif(recherche ? 0 : Math.max(index, 0));
    // Volontairement limité au changement de recherche : suivre `dossier`
    // ramènerait la sélection en arrière pendant qu'on navigue aux flèches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, recherche]);

  // L'option active reste visible quand on la déplace au clavier.
  useEffect(() => {
    if (!ouvert) return;
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif, ouvert]);

  // Un clic ailleurs referme.
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (cadre.current && !cadre.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [ouvert]);

  if (!entites) return null;

  if (entites.length === 0) {
    return (
      <Link to="/import" className="text-sm font-medium text-primary hover:underline">
        Créer un premier dossier
      </Link>
    );
  }

  function selectionner(entite: Entity | undefined) {
    if (!entite) return;
    choisir(entite.id);
    setOuvert(false);
  }

  function auClavier(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, trouves.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectionner(trouves[actif]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
    }
  }

  const idListe = `${id}-liste`;
  const idOption = (index: number) => `${id}-option-${index}`;

  return (
    <div className="relative min-w-0" ref={cadre}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className={`flex items-center gap-2 min-w-0 max-w-full rounded-lg border border-rule/15 bg-surface hover:bg-surface-2 transition text-left ${
          compact ? "px-2.5 py-1.5" : "px-3 py-1.5"
        }`}
      >
        <BriefcaseBusiness size={16} className="flex-none text-ink-3" aria-hidden="true" />
        <span className="sr-only">Dossier :</span>
        <span className="truncate text-sm font-semibold">{courant?.name ?? "Choisir un dossier"}</span>
        {!compact && entites.length > 1 && (
          <span className="flex-none text-xs text-ink-3 tabular-nums">{entites.length} dossiers</span>
        )}
        <ChevronDown size={16} className="flex-none text-ink-3" aria-hidden="true" />
      </button>

      {ouvert && (
        /* Sur téléphone, le bouton est au bord droit de l'écran : le panneau
           s'aligne à droite pour ne pas déborder. */
        <div
          className={`absolute top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-rule/15 bg-surface shadow-xl z-50 overflow-hidden ${
            compact ? "right-0" : "left-0"
          }`}
        >
          <div className="p-2 border-b border-rule/10">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={champ}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={idListe}
                aria-autocomplete="list"
                aria-activedescendant={trouves.length > 0 ? idOption(actif) : undefined}
                aria-label="Rechercher un dossier par nom ou code NAF"
                placeholder="Rechercher un dossier…"
                className="input pl-9"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={auClavier}
              />
            </div>
          </div>

          <ul ref={liste} id={idListe} role="listbox" aria-label="Dossiers" className="max-h-[min(60vh,26rem)] overflow-y-auto py-1">
            {trouves.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-3">Aucun dossier ne correspond à « {recherche} ».</li>
            )}
            {trouves.map((entite, index) => {
              const lettre = initiale(entite.name);
              const nouvelleLettre = index === 0 || initiale(trouves[index - 1].name) !== lettre;
              const estCourant = entite.id === dossier;
              return (
                <li key={entite.id} role="presentation">
                  {nouvelleLettre && (
                    <div className="px-4 pt-2.5 pb-1 text-xs font-semibold text-ink-3" aria-hidden="true">
                      {lettre}
                    </div>
                  )}
                  <div
                    id={idOption(index)}
                    data-index={index}
                    role="option"
                    aria-selected={estCourant}
                    onMouseEnter={() => setActif(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectionner(entite)}
                    className={`mx-1 flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer ${
                      index === actif ? "bg-ink/[0.06]" : ""
                    }`}
                  >
                    <span className={`flex-1 truncate text-sm ${estCourant ? "font-semibold text-primary" : ""}`}>
                      {entite.name}
                    </span>
                    {entite.nafCode && <span className="flex-none text-xs text-ink-3">{entite.nafCode}</span>}
                    <Check
                      size={16}
                      className={`flex-none text-primary ${estCourant ? "" : "invisible"}`}
                      aria-hidden="true"
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-2 p-2 border-t border-rule/10">
            {entites.length > 1 ? (
              <Link
                to="/portefeuille"
                onClick={() => setOuvert(false)}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-ink/[0.05]"
              >
                Tout le portefeuille
              </Link>
            ) : (
              <span />
            )}
            {peutAjouter && (
              <Link
                to="/settings"
                onClick={() => setOuvert(false)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-soft"
              >
                <Plus size={16} aria-hidden="true" />
                Nouveau dossier
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
