import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Printer, RotateCcw, Save } from "lucide-react";
import {
  useActions,
  useEnregistrerPreferenceCabinet,
  useEntities,
  useMarque,
  useOpportunitesDossier,
  usePeriods,
  usePreferenceCabinet,
  usePrevisionnel,
  useRatios,
  useSeriesPluriannuelles,
  useSig,
  useValeurCreee,
} from "../api/hooks";
import { urlImage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EntetePage, EtatVide } from "../components/etats";
import { DocumentRapport, type ContenuRapport } from "../components/rapport/Document";
import { useDossierCourant } from "../lib/dossierCourant";
import { periodesComparables } from "../lib/tableauDeBord";
import { exercicesComplets, lireEvolution } from "../lib/evolution";
import {
  IDS_SECTIONS,
  MODELE_PAR_DEFAUT,
  SECTIONS,
  basculer,
  conclusionAuto,
  deplacer,
  modeleValide,
  type ModeleRapport,
} from "../lib/rapport";

/**
 * Le rapport client : ce que le cabinet remet à son client, composé à partir
 * des chiffres de Cadran.
 *
 * À gauche, la composition : les sections et leur ordre, les textes du
 * cabinet, les recommandations à retenir. À droite, la feuille telle qu'elle
 * sera imprimée — ce qu'on voit est ce qui part. Le modèle (sections, ordre,
 * textes) s'enregistre pour tout le cabinet ; les chiffres changent avec le
 * dossier choisi en haut.
 *
 * L'impression passe par le navigateur (« Enregistrer au format PDF ») : le
 * document est rendu une seconde fois hors de l'application, seul sur le
 * papier, sans menu ni barre.
 */

const STATUTS_VALEUR = ["FAITE", "EN_COURS"] as const;

/** Une image de la marque, chargée depuis l'API et libérée au démontage. */
function useImage(chemin: string, presente: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!presente) {
      setUrl(null);
      return;
    }
    let abandonne = false;
    let aLiberer: string | null = null;
    urlImage(chemin)
      .then((u) => {
        if (abandonne) URL.revokeObjectURL(u);
        else {
          aLiberer = u;
          setUrl(u);
        }
      })
      .catch(() => setUrl(null));
    return () => {
      abandonne = true;
      if (aLiberer) URL.revokeObjectURL(aLiberer);
    };
  }, [chemin, presente]);
  return url;
}

export function RapportClientPage() {
  const { user } = useAuth();
  const { data: entites } = useEntities();
  const [entityId] = useDossierCourant(entites);
  const dossier = entites?.find((e) => e.id === entityId);
  const devise = dossier?.currency ?? "EUR";

  // La période : la dernière par défaut, et la précédente de même durée pour comparer.
  const { data: periodes } = usePeriods(entityId || undefined);
  const [periodId, setPeriodId] = useState<string | null>(null);
  useEffect(() => {
    if (!periodes || periodes.length === 0) {
      setPeriodId(null);
      return;
    }
    if (!periodes.some((p) => p.id === periodId)) setPeriodId(periodes[periodes.length - 1].id);
  }, [periodes, periodId]);
  const periode = periodes?.find((p) => p.id === periodId);
  const precedente = useMemo(() => {
    const comparables = periodesComparables(periodes ?? [], periodId);
    return comparables.length > 1 ? comparables[comparables.length - 2] : null;
  }, [periodes, periodId]);

  const { data: ratios } = useRatios(periodId);
  const { data: ratiosPrecedents } = useRatios(precedente?.id ?? null);
  const { data: sig } = useSig(periodId);
  const { data: series } = useSeriesPluriannuelles(entityId || null);
  const { data: opportunites } = useOpportunitesDossier(entityId || null);
  const { data: actions } = useActions(entityId || undefined);
  const { data: valeur } = useValeurCreee({ statuts: [...STATUTS_VALEUR], entityId: entityId || undefined });
  const { data: previsionnel } = usePrevisionnel(entityId || null, null);
  const { data: marque } = useMarque();
  const logo = useImage("/marque/logo", Boolean(marque?.logo));
  const signature = useImage("/marque/signature", Boolean(marque?.signature));

  // Le modèle du cabinet, puis les retouches de l'écran.
  const { data: enBase } = usePreferenceCabinet<ModeleRapport>("rapport");
  const enregistrer = useEnregistrerPreferenceCabinet<ModeleRapport>("rapport");
  const [modele, setModele] = useState<ModeleRapport | null>(null);
  useEffect(() => {
    if (enBase !== undefined && modele === null) setModele(modeleValide(enBase.valeur));
  }, [enBase, modele]);
  const [missionsExclues, setMissionsExclues] = useState<Set<string>>(new Set());
  const peutEnregistrer = user?.role === "ADMIN" || user?.role === "DAF";
  const modifie = modele !== null && JSON.stringify(modele) !== JSON.stringify(modeleValide(enBase?.valeur));

  const exercices = useMemo(() => exercicesComplets(series ?? [], 3), [series]);
  const lectures = useMemo(() => lireEvolution(exercices), [exercices]);
  const missions = (opportunites?.opportunites ?? []).filter((m) => !missionsExclues.has(m.type));
  const cabinet = marque?.nomAffiche || user?.organizationName || "Le cabinet";

  const contenu: ContenuRapport | null =
    modele && dossier
      ? {
          modele,
          variables: {
            dossier: dossier.name,
            exercice: periode?.label ?? "",
            cabinet,
            date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
            conclusion_auto: conclusionAuto(lectures, missions),
          },
          devise,
          accent: marque?.couleurAccent || "#156552",
          logo,
          signature,
          signataire: { nom: marque?.signataireNom ?? null, fonction: marque?.signataireFonction ?? null },
          mentions: marque?.mentionsPied ?? null,
          ratios: ratios ?? null,
          ratiosPrecedents: ratiosPrecedents ?? null,
          libellePrecedent: precedente?.label ?? null,
          sig: sig ?? null,
          exercices,
          lectures,
          missions,
          actions: actions ?? [],
          valeur: valeur ?? null,
          previsionnel: previsionnel ?? null,
        }
      : null;

  const changer = (modification: Partial<ModeleRapport>) => setModele((m) => (m ? { ...m, ...modification } : m));

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Rapport client"
        sousTitre="Le rapport à remettre au client : vos sections, vos textes, les chiffres de Cadran. Imprimez-le ou enregistrez-le en PDF."
      >
        {periodes && periodes.length > 0 && (
          <select className="input w-44" value={periodId ?? ""} aria-label="Période" onChange={(e) => setPeriodId(e.target.value)}>
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!contenu}>
          <Printer size={16} aria-hidden="true" />
          Imprimer ou PDF
        </button>
      </EntetePage>

      {periodes && periodes.length === 0 ? (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Le rapport se compose à partir des chiffres du dossier : importez d&apos;abord une période.
        </EtatVide>
      ) : (
        modele && (
          <div className="grid gap-6 xl:grid-cols-[22rem_1fr] items-start">
            <div className="space-y-5">
              <section className="card space-y-3" aria-labelledby="titre-sections">
                <h2 id="titre-sections" className="font-bold">
                  Sections
                </h2>
                <ul className="space-y-1">
                  {IDS_SECTIONS.map((id) => {
                    const retenue = modele.sections.includes(id);
                    const rang = modele.sections.indexOf(id);
                    return (
                      <li key={id} className="flex items-center gap-2">
                        <label className="flex flex-1 min-w-0 items-start gap-2 text-sm" title={SECTIONS[id].aide}>
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={retenue}
                            onChange={() => changer({ sections: basculer(modele.sections, id) })}
                          />
                          <span className={retenue ? "" : "text-ink-3"}>
                            {retenue && <span className="tabular-nums text-ink-3 mr-1">{rang + 1}.</span>}
                            {SECTIONS[id].libelle}
                          </span>
                        </label>
                        {retenue && (
                          <span className="flex">
                            <button
                              type="button"
                              className="p-1 rounded text-ink-3 hover:text-ink hover:bg-ink/5 disabled:opacity-30"
                              aria-label={`Monter « ${SECTIONS[id].libelle} »`}
                              disabled={rang === 0}
                              onClick={() => changer({ sections: deplacer(modele.sections, id, -1) })}
                            >
                              <ArrowUp size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded text-ink-3 hover:text-ink hover:bg-ink/5 disabled:opacity-30"
                              aria-label={`Descendre « ${SECTIONS[id].libelle} »`}
                              disabled={rang === modele.sections.length - 1}
                              onClick={() => changer({ sections: deplacer(modele.sections, id, 1) })}
                            >
                              <ArrowDown size={14} aria-hidden="true" />
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="card space-y-3" aria-labelledby="titre-textes">
                <h2 id="titre-textes" className="font-bold">
                  Vos textes
                </h2>
                <p className="text-xs text-ink-3">
                  Remplacés à l&apos;impression : {"{dossier}"}, {"{exercice}"}, {"{cabinet}"}, {"{date}"}, et{" "}
                  {"{conclusion_auto}"} — la conclusion rédigée par Cadran à partir des chiffres.
                </p>
                <div>
                  <label className="label" htmlFor="rapport-titre">
                    Titre
                  </label>
                  <input
                    id="rapport-titre"
                    className="input"
                    value={modele.titre}
                    maxLength={200}
                    onChange={(e) => changer({ titre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="rapport-mot">
                    Le mot du cabinet
                  </label>
                  <textarea
                    id="rapport-mot"
                    className="input min-h-[8rem]"
                    value={modele.mot}
                    maxLength={5000}
                    onChange={(e) => changer({ mot: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="rapport-conclusion">
                    Conclusion
                  </label>
                  <textarea
                    id="rapport-conclusion"
                    className="input min-h-[6rem]"
                    value={modele.conclusion}
                    maxLength={5000}
                    onChange={(e) => changer({ conclusion: e.target.value })}
                  />
                </div>
              </section>

              {(opportunites?.opportunites.length ?? 0) > 0 && modele.sections.includes("missions") && (
                <section className="card space-y-2" aria-labelledby="titre-missions">
                  <h2 id="titre-missions" className="font-bold">
                    Recommandations retenues
                  </h2>
                  <p className="text-xs text-ink-3">Pour ce rapport seulement.</p>
                  {opportunites!.opportunites.map((m) => (
                    <label key={m.type} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={!missionsExclues.has(m.type)}
                        onChange={() =>
                          setMissionsExclues((avant) => {
                            const apres = new Set(avant);
                            if (apres.has(m.type)) apres.delete(m.type);
                            else apres.add(m.type);
                            return apres;
                          })
                        }
                      />
                      {m.mission}
                    </label>
                  ))}
                </section>
              )}

              <section className="card space-y-2">
                {enregistrer.error && <p className="text-sm text-critical">{(enregistrer.error as Error).message}</p>}
                {peutEnregistrer ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!modifie || enregistrer.isPending}
                      onClick={() => enregistrer.mutate(modele)}
                    >
                      <Save size={15} aria-hidden="true" />
                      {enregistrer.isPending ? "Enregistrement…" : "Enregistrer comme modèle du cabinet"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={enregistrer.isPending}
                      onClick={() => {
                        setModele(MODELE_PAR_DEFAUT);
                        enregistrer.mutate(null);
                      }}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      Modèle par défaut
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-3">
                    Vos modifications valent pour ce rapport ; seul un administrateur peut changer le modèle du cabinet.
                  </p>
                )}
                <p className="text-xs text-ink-3">
                  Le modèle — sections, ordre et textes — vaut pour tous les dossiers et tous les collaborateurs. Le logo, la
                  signature et les mentions se règlent dans Paramètres.
                </p>
              </section>
            </div>

            {/* L'aperçu : la feuille, telle qu'elle sera imprimée. */}
            <div className="min-w-0 overflow-x-auto rounded-xl bg-ink/[0.06] p-3 sm:p-6">
              <div className="mx-auto w-full max-w-[210mm] min-w-[34rem] rounded-sm bg-white p-[14mm] shadow-lg">
                {contenu ? <DocumentRapport contenu={contenu} /> : <p className="text-ink-3">Chargement…</p>}
              </div>
            </div>
          </div>
        )
      )}

      {/* Le même document, seul sur le papier à l'impression. */}
      {contenu &&
        createPortal(
          <div className="racine-impression">
            <DocumentRapport contenu={contenu} />
          </div>,
          document.body,
        )}
    </div>
  );
}
