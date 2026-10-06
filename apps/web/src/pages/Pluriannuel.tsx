import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import {
  useEnregistrerHypotheses,
  useEnregistrerTableau,
  useEntities,
  useMesures,
  usePrevisionnel,
  useSeriesPluriannuelles,
  useTableauPluriannuel,
} from "../api/hooks";
import type { Bloc, Hypotheses, Mesure, SerieExercice, TypeBloc } from "../api/types";
import {
  BarresComparees,
  BarresEmpilees,
  CourbeTemporelle,
  type PointGraphique,
} from "../components/Graphique";
import { BlocTableau, BlocTuile } from "../components/BlocTableau";
import { EntetePage, SqueletteCarte } from "../components/etats";

/**
 * Tableau de bord pluriannuel et prévisionnel.
 *
 * Trois partis pris d'écran.
 *
 * **Une barre de contexte, pas un sélecteur enfoui.** Le dossier regardé et
 * l'étendue des exercices sont en haut, toujours visibles. C'est la façon
 * dont travaille un cabinet : on passe d'un client à l'autre et d'un exercice
 * à l'autre toute la journée, et chercher où l'on est à chaque fois use plus
 * que ça n'y paraît.
 *
 * **La configuration se range.** Le bouton « Personnaliser » ouvre l'éditeur
 * de blocs ; fermé, l'écran ne montre que les chiffres. Un tableau de bord
 * qu'on configure une fois ne doit pas montrer ses réglages en permanence.
 *
 * **Le projeté ne se déguise jamais en réalisé.** Les exercices projetés
 * portent une marque dans chaque tableau, une couleur distincte dans les
 * en-têtes, et un trait pointillé sur les courbes. C'est la seule façon
 * honnête de les tracer sur le même axe — et les tracer ailleurs ôterait
 * tout l'intérêt.
 */

const TYPES: { id: TypeBloc; label: string; aide: string }[] = [
  { id: "courbe", label: "Courbe", aide: "Trajectoire sur plusieurs exercices" },
  { id: "barres", label: "Barres", aide: "Comparaison d'exercices" },
  { id: "empile", label: "Composition", aide: "Parts d'un même ensemble" },
  { id: "tableau", label: "Tableau", aide: "Chiffres exacts, unités mêlées admises" },
  { id: "tuile", label: "Chiffre clé", aide: "Une seule valeur et sa variation" },
];

const FAMILLES: { id: Mesure["famille"]; label: string }[] = [
  { id: "resultat", label: "Compte de résultat" },
  { id: "intermediaire", label: "Soldes intermédiaires" },
  { id: "bilan", label: "Bilan" },
  { id: "ratio", label: "Ratios" },
];

export function PluriannuelPage() {
  const { data: entites } = useEntities();
  const [entityId, setEntityId] = useState<string | null>(null);
  useEffect(() => {
    if (!entityId && entites?.length) setEntityId(entites[0].id);
  }, [entites, entityId]);

  const { data: mesuresListe } = useMesures(entityId);
  const { data: reels, isLoading } = useSeriesPluriannuelles(entityId);
  const { data: tableau } = useTableauPluriannuel(entityId);

  const [blocs, setBlocs] = useState<Bloc[] | null>(null);
  const [hypotheses, setHypotheses] = useState<Hypotheses | null>(null);
  const [edition, setEdition] = useState(false);
  const [avecPrevisionnel, setAvecPrevisionnel] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /* L'état local naît de la réponse serveur et n'est pas réinitialisé
   * ensuite : écraser une configuration en cours d'édition à chaque
   * invalidation ferait disparaître sous les doigts ce qu'on arrange. */
  useEffect(() => {
    if (tableau && blocs === null) setBlocs(tableau.blocs);
    if (tableau && hypotheses === null) setHypotheses(tableau.hypotheses);
  }, [tableau, blocs, hypotheses]);

  const { data: previsionnel } = usePrevisionnel(
    avecPrevisionnel ? entityId : null,
    avecPrevisionnel ? hypotheses : null
  );

  const enregistrer = useEnregistrerTableau(entityId);
  const enregistrerHypotheses = useEnregistrerHypotheses(entityId);

  const mesures = useMemo(
    () => new Map((mesuresListe ?? []).map((mesure) => [mesure.id, mesure])),
    [mesuresListe]
  );

  const entite = entites?.find((e) => e.id === entityId);
  const devise = entite?.currency ?? "EUR";

  /*
   * Réalisé et projeté bout à bout — avec une soustraction.
   *
   * La projection part du dernier exercice **complet**, pour qu'une année
   * pleine soit projetée à partir d'une année pleine. Quand l'exercice en
   * cours est partiel, il porte donc le même millésime que le premier
   * projeté : l'axe affichait « 2026 partiel » puis « 2026 proj. », deux
   * colonnes pour la même année avec des montants différents. On retire
   * l'exercice partiel tant que la projection est affichée, et on le dit —
   * il reste visible dès qu'on la referme.
   */
  const partielMasque =
    avecPrevisionnel && (reels ?? []).some((exercice) => !exercice.complet) ? true : false;

  const exercices: SerieExercice[] = useMemo(() => {
    const realises = reels ?? [];
    if (!avecPrevisionnel) return realises;
    return [...realises.filter((exercice) => exercice.complet), ...(previsionnel?.exercices ?? [])];
  }, [reels, previsionnel, avecPrevisionnel]);

  async function tenter(action: () => Promise<unknown>) {
    setErreur(null);
    try {
      await action();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Opération impossible.");
    }
  }

  return (
    <div className="space-y-5">
      <EntetePage
        titre="Pluriannuel"
        sousTitre="Plusieurs exercices côte à côte, et ce qui vient après"
      />

      {/*
        Barre de contexte : le dossier, l'étendue, et les commandes. Une seule
        rangée au-dessus des blocs, pour que le regard trouve toujours au même
        endroit de quoi il est en train de parler.
      */}
      <div className="card flex flex-wrap items-center gap-2">
        <select
          className="input w-auto min-w-[14rem]"
          aria-label="Dossier"
          value={entityId ?? ""}
          onChange={(e) => {
            setEntityId(e.target.value);
            setBlocs(null);
            setHypotheses(null);
          }}
        >
          {entites?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-ink/45">
          {reels?.length
            ? `${reels.length} exercice${reels.length > 1 ? "s" : ""} · ${reels[0].label} → ${reels[reels.length - 1].label}`
            : "aucun exercice"}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className={avecPrevisionnel ? "btn-primary text-sm" : "btn-secondary text-sm"}
            onClick={() => setAvecPrevisionnel((valeur) => !valeur)}
          >
            Prévisionnel
          </button>
          <button
            type="button"
            className={edition ? "btn-primary text-sm" : "btn-secondary text-sm"}
            onClick={() => setEdition((valeur) => !valeur)}
          >
            Personnaliser
          </button>
        </div>
      </div>

      {partielMasque && (
        <p className="text-xs text-ink/50">
          L&apos;exercice en cours, incomplet, est retiré de l&apos;affichage pendant la projection :
          il porte le même millésime que le premier exercice projeté. Fermez le prévisionnel pour le
          revoir.
        </p>
      )}

      {erreur && <p className="text-critical text-sm">{erreur}</p>}

      {avecPrevisionnel && hypotheses && (
        <PanneauHypotheses
          hypotheses={hypotheses}
          depart={previsionnel?.depart ?? null}
          besoin={previsionnel?.exercices.find((e) => (e.besoinFinancement ?? 0) > 0) ?? null}
          devise={devise}
          surChangement={setHypotheses}
          surEnregistrement={() => tenter(() => enregistrerHypotheses.mutateAsync(hypotheses))}
          enregistrement={enregistrerHypotheses.isPending}
        />
      )}

      {edition && blocs && (
        <EditeurBlocs
          blocs={blocs}
          mesures={mesuresListe ?? []}
          surChangement={setBlocs}
          surEnregistrement={() =>
            tenter(async () => {
              await enregistrer.mutateAsync(blocs);
              setEdition(false);
            })
          }
          enregistrement={enregistrer.isPending}
        />
      )}

      {isLoading && <SqueletteCarte hauteur="18rem" />}

      {!isLoading && exercices.length === 0 && (
        <div className="card">
          <p className="text-sm text-ink/60">
            Aucun exercice calculé pour ce dossier. Importez un FEC ou saisissez une période depuis
            l&apos;écran Import, et les exercices apparaîtront ici.
          </p>
        </div>
      )}

      {exercices.length > 0 && blocs && (
        <div className="grid gap-4 lg:grid-cols-2">
          {blocs.map((bloc) => (
            <section
              key={bloc.id}
              className={`card ${bloc.largeur === "pleine" ? "lg:col-span-2" : ""}`}
            >
              <h2 className="font-display text-base font-semibold mb-3">{bloc.titre}</h2>
              <RenduBloc bloc={bloc} exercices={exercices} mesures={mesures} devise={devise} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dessine un bloc selon son type.
 *
 * Les exercices projetés sont repérés par leur drapeau `reel` : les courbes
 * les tracent en pointillé, les tableaux les annoncent. Rien ne laisse croire
 * qu'un chiffre projeté est constaté.
 */
function RenduBloc({
  bloc,
  exercices,
  mesures,
  devise,
}: {
  bloc: Bloc;
  exercices: SerieExercice[];
  mesures: Map<string, Mesure>;
  devise: string;
}) {
  const unite = mesures.get(bloc.mesures[0])?.unite ?? "devise";
  const series = bloc.mesures.map((id) => ({
    cle: id,
    label: mesures.get(id)?.label ?? id,
  }));
  /*
   * L'abscisse dit ce qu'est chaque exercice.
   *
   * Un exercice en cours, arrêté au troisième trimestre, affiche un chiffre
   * d'affaires inférieur d'un quart à l'année pleine précédente. Sur une
   * courbe, cela se lit comme un effondrement — alors qu'il ne s'est rien
   * passé. Le dire sur l'axe est le seul endroit où le lecteur le verra sans
   * avoir à y penser.
   */
  const donnees: PointGraphique[] = exercices.map((exercice) => ({
    exercice: !exercice.reel
      ? `${exercice.label} proj.`
      : exercice.complet
        ? exercice.label
        : `${exercice.label} partiel`,
    ...exercice.valeurs,
  }));

  switch (bloc.type) {
    case "tuile":
      return <BlocTuile bloc={bloc} exercices={exercices} mesures={mesures} currency={devise} />;
    case "tableau":
      return <BlocTableau bloc={bloc} exercices={exercices} mesures={mesures} currency={devise} />;
    case "barres":
      return (
        <BarresComparees
          donnees={donnees}
          series={series}
          cleAbscisse="exercice"
          currency={devise}
          unite={unite}
        />
      );
    case "empile":
      return (
        <BarresEmpilees
          donnees={donnees}
          series={series}
          cleAbscisse="exercice"
          currency={devise}
          unite={unite}
        />
      );
    default:
      return (
        <CourbeTemporelle
          donnees={donnees}
          series={series}
          cleAbscisse="exercice"
          currency={devise}
          unite={unite}
        />
      );
  }
}

/** Un champ d'hypothèse, avec son unité à droite du nombre. */
function Champ({
  libelle,
  valeur,
  unite,
  pas = 1,
  surChangement,
  aide,
}: {
  libelle: string;
  valeur: number;
  unite: string;
  pas?: number;
  surChangement: (valeur: number) => void;
  aide?: string;
}) {
  const identifiant = `hyp-${libelle.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="label" htmlFor={identifiant}>
        {libelle}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={identifiant}
          type="number"
          step={pas}
          className="input font-mono tabular-nums"
          value={valeur}
          onChange={(e) => surChangement(Number(e.target.value))}
        />
        <span className="text-xs text-ink/45 w-8 flex-none">{unite}</span>
      </div>
      {aide && <p className="text-[0.7rem] text-ink/40 mt-0.5">{aide}</p>}
    </div>
  );
}

/**
 * Les hypothèses du prévisionnel.
 *
 * Toutes à l'écran, aucune cachée derrière un réglage « avancé » : un
 * prévisionnel dont on ne voit pas les hypothèses ne se défend pas devant un
 * banquier, et c'est précisément le moment où l'on en a besoin.
 */
function PanneauHypotheses({
  hypotheses,
  depart,
  besoin,
  devise,
  surChangement,
  surEnregistrement,
  enregistrement,
}: {
  hypotheses: Hypotheses;
  depart: number | null;
  besoin: SerieExercice | null;
  devise: string;
  surChangement: (hypotheses: Hypotheses) => void;
  surEnregistrement: () => void;
  enregistrement: boolean;
}) {
  const poser = (champ: keyof Hypotheses) => (valeur: number) =>
    surChangement({ ...hypotheses, [champ]: valeur });
  const pourcent = (champ: keyof Hypotheses) => (valeur: number) =>
    surChangement({ ...hypotheses, [champ]: valeur / 100 });

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Hypothèses du prévisionnel</h2>
        <p className="text-xs text-ink/45">
          {depart
            ? `Projeté à partir de l'exercice ${depart}, le dernier complet.`
            : "Aucun exercice complet : rien à projeter."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Champ libelle="Horizon" valeur={hypotheses.horizon} unite="ans" surChangement={poser("horizon")} />
        <Champ
          libelle="Croissance du CA"
          valeur={Math.round(hypotheses.croissanceCa * 1000) / 10}
          unite="%"
          pas={0.5}
          surChangement={pourcent("croissanceCa")}
        />
        <Champ
          libelle="Achats / CA"
          valeur={Math.round(hypotheses.partAchats * 1000) / 10}
          unite="%"
          pas={0.5}
          surChangement={pourcent("partAchats")}
        />
        <Champ
          libelle="Charges externes"
          valeur={Math.round(hypotheses.croissanceChargesExternes * 1000) / 10}
          unite="%"
          pas={0.5}
          surChangement={pourcent("croissanceChargesExternes")}
          aide="Croissance annuelle"
        />
        <Champ
          libelle="Charges de personnel"
          valeur={Math.round(hypotheses.croissanceChargesPersonnel * 1000) / 10}
          unite="%"
          pas={0.5}
          surChangement={pourcent("croissanceChargesPersonnel")}
          aide="Croissance annuelle"
        />
        <Champ libelle="Délai clients" valeur={hypotheses.dso} unite="j" surChangement={poser("dso")} />
        <Champ libelle="Délai fournisseurs" valeur={hypotheses.dpo} unite="j" surChangement={poser("dpo")} />
        <Champ libelle="Rotation des stocks" valeur={hypotheses.dio} unite="j" surChangement={poser("dio")} />
        <Champ
          libelle="Investissements"
          valeur={hypotheses.investissements}
          unite={devise === "EUR" ? "€" : devise}
          pas={1000}
          surChangement={poser("investissements")}
          aide="Par exercice"
        />
        <Champ
          libelle="Amortissement"
          valeur={hypotheses.dureeAmortissement}
          unite="ans"
          surChangement={poser("dureeAmortissement")}
        />
        <Champ
          libelle="Nouveaux emprunts"
          valeur={hypotheses.nouveauxEmprunts}
          unite={devise === "EUR" ? "€" : devise}
          pas={1000}
          surChangement={poser("nouveauxEmprunts")}
        />
        <Champ
          libelle="Remboursements"
          valeur={hypotheses.remboursements}
          unite={devise === "EUR" ? "€" : devise}
          pas={1000}
          surChangement={poser("remboursements")}
        />
        <Champ
          libelle="Taux d'intérêt"
          valeur={Math.round(hypotheses.tauxInteret * 1000) / 10}
          unite="%"
          pas={0.25}
          surChangement={pourcent("tauxInteret")}
        />
        <Champ
          libelle="Impôt sur les sociétés"
          valeur={Math.round(hypotheses.tauxIS * 1000) / 10}
          unite="%"
          pas={0.5}
          surChangement={pourcent("tauxIS")}
        />
        <Champ
          libelle="Dividendes"
          valeur={hypotheses.dividendes}
          unite={devise === "EUR" ? "€" : devise}
          pas={1000}
          surChangement={poser("dividendes")}
        />
      </div>

      {besoin && (
        <p className="panneau-discret text-sm">
          <strong className="text-warning">Besoin de financement en {besoin.label}.</strong>{" "}
          La trésorerie projetée ne boucle pas : il manque{" "}
          {(besoin.besoinFinancement ?? 0).toLocaleString("fr-FR", {
            style: "currency",
            currency: devise,
            maximumFractionDigits: 0,
          })}
          . À trouver en emprunt, en apport, ou en réduisant le besoin en fonds de roulement.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-sm" onClick={surEnregistrement} disabled={enregistrement}>
          {enregistrement ? "Enregistrement…" : "Enregistrer ces hypothèses"}
        </button>
        <span className="text-xs text-ink/40">
          Les modifications s&apos;appliquent à l&apos;écran immédiatement ; elles ne sont
          conservées qu&apos;une fois enregistrées.
        </span>
      </div>
    </div>
  );
}

/** Éditeur de blocs : ajouter, retirer, choisir les mesures. */
function EditeurBlocs({
  blocs,
  mesures,
  surChangement,
  surEnregistrement,
  enregistrement,
}: {
  blocs: Bloc[];
  mesures: Mesure[];
  surChangement: (blocs: Bloc[]) => void;
  surEnregistrement: () => void;
  enregistrement: boolean;
}) {
  const modifier = (index: number, modifications: Partial<Bloc>) =>
    surChangement(blocs.map((bloc, rang) => (rang === index ? { ...bloc, ...modifications } : bloc)));

  const ajouter = () =>
    surChangement([
      ...blocs,
      {
        id: `bloc-${Date.now().toString(36)}`,
        type: "courbe",
        titre: "Nouveau bloc",
        mesures: ["agregat.chiffreAffaires"],
        largeur: "demi",
      },
    ]);

  return (
    <div className="card space-y-3">
      <h2 className="font-display text-base font-semibold">Composition du tableau de bord</h2>
      <p className="text-sm text-ink/50">
        Un bloc ne mêle pas deux unités : un montant et un pourcentage sur un même axe demandent
        deux échelles, et deux échelles font dire à deux courbes ce qu&apos;on veut. Pour les
        rapprocher quand même, choisissez un tableau.
      </p>

      <div className="space-y-2">
        {blocs.map((bloc, index) => (
          <div key={bloc.id} className="panneau-discret grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              className="input"
              aria-label={`Titre du bloc ${index + 1}`}
              value={bloc.titre}
              onChange={(e) => modifier(index, { titre: e.target.value })}
            />
            <select
              className="input w-auto"
              aria-label={`Type du bloc ${index + 1}`}
              value={bloc.type}
              onChange={(e) => modifier(index, { type: e.target.value as TypeBloc })}
            >
              {TYPES.map((type) => (
                <option key={type.id} value={type.id} title={type.aide}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              className="input w-auto"
              aria-label={`Largeur du bloc ${index + 1}`}
              value={bloc.largeur}
              onChange={(e) => modifier(index, { largeur: e.target.value as "demi" | "pleine" })}
            >
              <option value="demi">Demi-largeur</option>
              <option value="pleine">Pleine largeur</option>
            </select>
            <button
              type="button"
              className="btn-secondary text-xs px-2.5"
              onClick={() => surChangement(blocs.filter((_, rang) => rang !== index))}
            >
              Retirer
            </button>

            <div className="sm:col-span-4 flex flex-wrap gap-1.5">
              {bloc.mesures.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rounded-full border border-rule/30 px-2.5 py-1 text-xs hover:bg-ink/5"
                  onClick={() =>
                    modifier(index, { mesures: bloc.mesures.filter((autre) => autre !== id) })
                  }
                  title="Retirer cette mesure"
                >
                  {mesures.find((m) => m.id === id)?.label ?? id} ×
                </button>
              ))}
              <select
                className="input w-auto text-xs py-1"
                aria-label={`Ajouter une mesure au bloc ${index + 1}`}
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  modifier(index, { mesures: [...bloc.mesures, e.target.value] });
                }}
              >
                <option value="">+ ajouter une mesure…</option>
                {FAMILLES.map((famille) => (
                  <optgroup key={famille.id} label={famille.label}>
                    {mesures
                      .filter((mesure) => mesure.famille === famille.id)
                      .filter((mesure) => !bloc.mesures.includes(mesure.id))
                      .map((mesure) => (
                        <option key={mesure.id} value={mesure.id}>
                          {mesure.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={ajouter}>
          Ajouter un bloc
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={surEnregistrement}
          disabled={enregistrement}
        >
          {enregistrement ? "Enregistrement…" : "Enregistrer la composition"}
        </button>
      </div>
    </div>
  );
}
