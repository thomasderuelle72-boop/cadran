import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CircleCheck, Clock3, OctagonAlert, SlidersHorizontal } from "lucide-react";
import {
  useEnregistrerPreferenceCabinet,
  useEntities,
  usePreferenceCabinet,
  useSeriesPluriannuelles,
} from "../api/hooks";
import type { SerieExercice } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { EntetePage, EtatVide, SqueletteCarte, Zone } from "../components/etats";
import { BarresComparees, CourbeTemporelle, type PointGraphique } from "../components/Graphique";
import { Colonnes } from "../components/evolution/Colonnes";
import { TableauPluriannuel } from "../components/evolution/TableauPluriannuel";
import { useDossierCourant } from "../lib/dossierCourant";
import {
  base100,
  chargesExploitation,
  exercicesComplets,
  lireEvolution,
  montantCourt,
  pourcentSigne,
  rythmeEnCours,
  valeur,
  variation,
  type EtatLecture,
  type Lecture,
  type Theme,
} from "../lib/evolution";
import { GROUPES, LIGNES, LIGNES_PAR_DEFAUT, lignesRetenues } from "../lib/tableauPluriannuel";

/**
 * Évolution : comment l'entreprise a évolué sur ses derniers exercices.
 *
 * L'écran suit l'ordre du diagnostic financier — activité, rentabilité,
 * structure, trésorerie — et répond à une question par carte, avec un
 * graphique qui y répond et des phrases qui disent quoi retenir. Puis vient
 * le tableau pluriannuel, celui d'une plaquette, dont le cabinet choisit les
 * lignes une fois pour tous ses dossiers.
 *
 * Seuls les exercices complets se comparent. L'exercice en cours a son
 * propre bandeau, ramené à un rythme mensuel : neuf mois face à douze
 * donnaient une « baisse » qui n'existait pas.
 */

const ETATS: Record<EtatLecture, { libelle: string; Icone: typeof CircleCheck; classe: string }> = {
  sain: { libelle: "Sain", Icone: CircleCheck, classe: "bg-success-soft text-success" },
  a_surveiller: { libelle: "À surveiller", Icone: AlertTriangle, classe: "bg-warning-soft text-warning" },
  fragile: { libelle: "Fragile", Icone: OctagonAlert, classe: "bg-critical-soft text-critical" },
};

const THEMES: Record<Theme, string> = {
  activite: "Activité",
  rentabilite: "Rentabilité",
  structure: "Structure financière",
  tresorerie: "Trésorerie",
};

interface ModeleEvolution {
  lignes: string[];
}

export function EvolutionPage() {
  const { user } = useAuth();
  const { data: entites } = useEntities();
  const [entityId] = useDossierCourant(entites);
  const { data: series, isLoading, error, refetch } = useSeriesPluriannuelles(entityId || null);
  const { data: modele } = usePreferenceCabinet<ModeleEvolution>("evolution");
  const [nombre, setNombre] = useState<number | null>(3);
  const [personnaliser, setPersonnaliser] = useState(false);

  const devise = entites?.find((e) => e.id === entityId)?.currency ?? "EUR";
  const tous = useMemo(() => exercicesComplets(series ?? []), [series]);
  const exercices = useMemo(() => (nombre ? tous.slice(-nombre) : tous), [tous, nombre]);
  const lectures = useMemo(() => lireEvolution(exercices), [exercices]);
  const enCours = useMemo(() => rythmeEnCours(series ?? []), [series]);
  const lignes = lignesRetenues(modele?.valeur?.lignes);
  const peutModifier = user?.role === "ADMIN" || user?.role === "DAF";

  const choix = [3, 5].filter((n) => n < tous.length);
  const actif = (n: number | null) => (n === null ? nombre === null || nombre >= tous.length : nombre === n);

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Évolution"
        sousTitre="Comment l'entreprise a évolué sur ses derniers exercices complets : activité, rentabilité, structure, trésorerie."
      >
        {tous.length > 3 && (
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]" role="radiogroup" aria-label="Exercices comparés">
            {[...choix, null].map((n) => (
              <button
                key={n ?? "tous"}
                type="button"
                role="radio"
                aria-checked={actif(n)}
                onClick={() => setNombre(n)}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
                  actif(n)
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {n === null ? `Tous (${tous.length})` : `${n} exercices`}
              </button>
            ))}
          </div>
        )}
      </EntetePage>

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="l'évolution"
        squelette={<SqueletteCarte hauteur="24rem" />}
      >
        {enCours && <BandeauEnCours rythme={enCours} />}

        {tous.length < 2 ? (
          <EtatVide titre="Il faut deux exercices complets" action={{ to: "/import", label: "Importer des données" }}>
            {tous.length === 0
              ? "Aucun exercice complet n'est importé pour ce dossier. Importez un FEC ou une balance par exercice."
              : `Un seul exercice complet est importé (${tous[0].label}). Importez le précédent pour voir l'évolution.`}
          </EtatVide>
        ) : (
          <div className="space-y-6">
            <Synthese lectures={lectures} exercices={exercices} />

            <div className="grid gap-4 lg:grid-cols-2">
              {lectures.map((lecture, rang) => (
                <CarteQuestion key={lecture.theme} lecture={lecture} rang={rang}>
                  <Graphique theme={lecture.theme} exercices={exercices} devise={devise} />
                </CarteQuestion>
              ))}
            </div>

            <section className="space-y-3" aria-labelledby="titre-tableau">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="titre-tableau" className="text-lg font-bold">
                    Le détail, exercice par exercice
                  </h2>
                  <p className="text-sm text-ink-3">
                    {modele?.valeur ? "Lignes choisies par le cabinet." : "Modèle proposé par défaut."} Écart du dernier
                    exercice sur le précédent : en vert quand c&apos;est une bonne nouvelle, en rouge sinon.
                  </p>
                </div>
                {peutModifier && (
                  <button type="button" className="btn-secondary py-1.5" onClick={() => setPersonnaliser((v) => !v)} aria-expanded={personnaliser}>
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    Choisir les lignes
                  </button>
                )}
              </div>
              {personnaliser && peutModifier && (
                <ChoixLignes initiales={lignes.map((l) => l.id)} surFermer={() => setPersonnaliser(false)} />
              )}
              <TableauPluriannuel exercices={exercices} lignes={lignes} devise={devise} />
            </section>

            <p className="text-xs text-ink-3 max-w-prose">
              Méthode : le diagnostic financier en quatre temps — activité, rentabilité, structure financière,
              trésorerie —, sur les seuls exercices complets. Les variations en pourcentage ne sont calculées que sur une
              base positive : on ne dit pas « +120 % » d&apos;un résultat qui part d&apos;une perte.
            </p>
          </div>
        )}
      </Zone>
    </div>
  );
}

function Pastille({ etat, texte }: { etat: EtatLecture; texte?: string }) {
  const { libelle, Icone, classe } = ETATS[etat];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${classe}`}>
      <Icone size={12} aria-hidden="true" />
      {texte ?? libelle}
    </span>
  );
}

/** Les quatre réponses en une ligne : ce qu'on lit avant tout le reste. */
function Synthese({ lectures, exercices }: { lectures: Lecture[]; exercices: SerieExercice[] }) {
  const premier = exercices[0];
  const dernier = exercices[exercices.length - 1];
  return (
    <section aria-labelledby="titre-synthese" className="space-y-3">
      <h2 id="titre-synthese" className="text-sm font-semibold text-ink-3">
        Ce qu&apos;il faut retenir, de {premier.label} à {dernier.label}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {lectures.map((l) => (
          <a
            key={l.theme}
            href={`#${l.theme}`}
            className="card survol-leve apparition py-4 block"
          >
            <div className="text-sm font-semibold text-ink-2">{THEMES[l.theme]}</div>
            <div className="mt-2">
              <Pastille etat={l.etat} texte={l.resume.charAt(0).toUpperCase() + l.resume.slice(1)} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function CarteQuestion({ lecture, rang, children }: { lecture: Lecture; rang: number; children: ReactNode }) {
  return (
    <section
      id={lecture.theme}
      className="card apparition scroll-mt-28 flex flex-col"
      style={{ animationDelay: `${rang * 70}ms` }}
      aria-labelledby={`titre-${lecture.theme}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`titre-${lecture.theme}`} className="text-lg font-bold">
          {lecture.question}
        </h2>
        <Pastille etat={lecture.etat} />
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
        {lecture.phrases.map((phrase) => (
          <li key={phrase}>{phrase}</li>
        ))}
      </ul>
      <div className="mt-auto pt-4">
        <div className="pt-4 border-t border-rule/[0.07]">{children}</div>
      </div>
    </section>
  );
}

/** Le graphique qui répond à chaque question — un seul, et une seule échelle. */
function Graphique({ theme, exercices, devise }: { theme: Theme; exercices: SerieExercice[]; devise: string }) {
  const points = (valeurs: Record<string, (e: SerieExercice, i: number) => number | null>): PointGraphique[] =>
    exercices.map((e, i) => {
      const point: PointGraphique = { exercice: e.label };
      for (const [cle, lire] of Object.entries(valeurs)) point[cle] = lire(e, i);
      return point;
    });

  switch (theme) {
    case "activite":
      return (
        <Colonnes
          colonnes={exercices.map((e, i) => {
            const ca = valeur(e, "agregat.chiffreAffaires");
            const avant = i > 0 ? valeur(exercices[i - 1], "agregat.chiffreAffaires") : null;
            return {
              libelle: e.label,
              valeur: ca,
              variation: ca !== null && avant !== null ? variation(avant, ca).taux : null,
            };
          })}
        />
      );
    case "rentabilite": {
      const ventes = base100(exercices, (e) => valeur(e, "agregat.chiffreAffaires"));
      const charges = base100(exercices, chargesExploitation);
      return (
        <figure>
          <CourbeTemporelle
            donnees={points({ ventes: (_, i) => ventes[i], charges: (_, i) => charges[i] })}
            series={[
              { cle: "ventes", label: "Ventes" },
              { cle: "charges", label: "Charges d'exploitation" },
            ]}
            cleAbscisse="exercice"
            unite="indice"
            domaine="resserre"
            hauteur={220}
          />
          <figcaption className="text-xs text-ink-3 mt-1">
            Base 100 en {exercices[0].label}. Quand la courbe des charges passe au-dessus de celle des ventes, la marge
            se réduit : c&apos;est l&apos;effet ciseaux.
          </figcaption>
        </figure>
      );
    }
    case "structure":
      return (
        <BarresComparees
          donnees={points({
            cp: (e) => valeur(e, "agregat.capitauxPropres"),
            dettes: (e) => valeur(e, "agregat.dettesFinancieres"),
          })}
          series={[
            { cle: "cp", label: "Capitaux propres" },
            { cle: "dettes", label: "Dettes financières" },
          ]}
          cleAbscisse="exercice"
          currency={devise}
        />
      );
    case "tresorerie":
      return (
        <div className="space-y-4">
          <CourbeTemporelle
            donnees={points({
              fr: (e) => valeur(e, "derive.fondsDeRoulement"),
              bfr: (e) => valeur(e, "derive.bfr"),
              tn: (e) => valeur(e, "derive.tresorerieNette"),
            })}
            series={[
              { cle: "fr", label: "Fonds de roulement" },
              { cle: "bfr", label: "Besoin en fonds de roulement" },
              { cle: "tn", label: "Trésorerie nette" },
            ]}
            cleAbscisse="exercice"
            currency={devise}
            hauteur={220}
          />
          <Delais exercices={exercices} />
        </div>
      );
  }
}

/** Les trois délais, du premier au dernier exercice : en jours, avec leur nom en français. */
function Delais({ exercices }: { exercices: SerieExercice[] }) {
  const premier = exercices[0];
  const dernier = exercices[exercices.length - 1];
  const lignes = [
    { id: "ratio.dso", libelle: "Délai de paiement des clients", bon: -1 },
    { id: "ratio.dpo", libelle: "Délai de paiement des fournisseurs", bon: 0 },
    { id: "ratio.dio", libelle: "Durée de stockage", bon: -1 },
  ];
  return (
    <dl className="grid gap-1 text-sm">
      {lignes.map((l) => {
        const avant = valeur(premier, l.id);
        const apres = valeur(dernier, l.id);
        if (avant === null || apres === null) return null;
        const diff = Math.round(apres - avant);
        const classe = diff === 0 || l.bon === 0 ? "text-ink-3" : diff * l.bon > 0 ? "text-success" : "text-critical";
        return (
          <div key={l.id} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">{l.libelle}</dt>
            <dd className="tabular-nums whitespace-nowrap">
              {Math.round(avant)} j → <span className="font-semibold">{Math.round(apres)} j</span>
              <span className={`ml-2 text-xs ${classe}`}>{diff === 0 ? "=" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} j`}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** « 1er janvier », « 30 septembre » : le premier du mois s'écrit en ordinal. */
function jourMois(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const mois = date.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  const jour = date.getUTCDate();
  return `${jour === 1 ? "1er" : jour} ${mois}`;
}

function BandeauEnCours({ rythme }: { rythme: NonNullable<ReturnType<typeof rythmeEnCours>> }) {
  const { exercice, mois, caMensuel, caMensuelPrecedent, ecart, resultat } = rythme;
  const periode = exercice.debut && exercice.fin ? ` (du ${jourMois(exercice.debut)} au ${jourMois(exercice.fin)})` : "";
  return (
    <section className="card flex flex-wrap items-start gap-4 mb-6 border border-dashed border-rule/25 shadow-none" aria-label="Exercice en cours">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-2 text-ink-2">
        <Clock3 size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-bold">
          Exercice {exercice.label} en cours · {mois} mois{periode}
        </h2>
        <p className="text-sm text-ink-2">
          {caMensuel !== null && (
            <>
              Chiffre d&apos;affaires : {montantCourt(caMensuel)} par mois en moyenne
              {caMensuelPrecedent !== null && (
                <>
                  , contre {montantCourt(caMensuelPrecedent)} sur le dernier exercice complet
                  {ecart !== null && ` (${pourcentSigne(ecart)})`}
                </>
              )}
              .{" "}
            </>
          )}
          {resultat !== null && <>Résultat cumulé : {montantCourt(resultat)}.</>}
        </p>
        <p className="text-xs text-ink-3">
          Rythme mensuel moyen, sans tenir compte des saisons. L&apos;exercice en cours n&apos;est pas comparé aux années
          pleines ci-dessous.
        </p>
      </div>
    </section>
  );
}

/** Le choix des lignes du tableau, pour tout le cabinet. */
function ChoixLignes({ initiales, surFermer }: { initiales: string[]; surFermer: () => void }) {
  const [choisies, setChoisies] = useState(() => new Set(initiales));
  const enregistrer = useEnregistrerPreferenceCabinet<ModeleEvolution>("evolution");

  const basculer = (id: string) =>
    setChoisies((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });

  return (
    <div className="card space-y-4">
      <p className="text-sm text-ink-2 max-w-prose">
        Le modèle s&apos;applique à tous les dossiers du cabinet et à tous les collaborateurs. Les montants restent
        calculés par Cadran ; vous choisissez seulement ce qu&apos;on montre.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GROUPES.map((groupe) => (
          <fieldset key={groupe} className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wide text-primary mb-1">{groupe}</legend>
            {LIGNES.filter((l) => l.groupe === groupe).map((l) => (
              <label key={l.id} className="flex items-start gap-2 text-sm text-ink-2">
                <input type="checkbox" className="mt-0.5" checked={choisies.has(l.id)} onChange={() => basculer(l.id)} />
                {l.libelle}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {enregistrer.error && <p className="text-sm text-critical">{(enregistrer.error as Error).message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={choisies.size === 0 || enregistrer.isPending}
          onClick={() => enregistrer.mutate({ lignes: [...choisies] }, { onSuccess: surFermer })}
        >
          {enregistrer.isPending ? "Enregistrement…" : "Enregistrer pour le cabinet"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={enregistrer.isPending}
          onClick={() => {
            setChoisies(new Set(LIGNES_PAR_DEFAUT));
            enregistrer.mutate(null, { onSuccess: surFermer });
          }}
        >
          Revenir au modèle par défaut
        </button>
        <button type="button" className="text-sm text-ink-3 hover:text-ink px-2" onClick={surFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}
