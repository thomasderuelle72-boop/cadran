import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarDays } from "lucide-react";
import {
  useAlertEvents,
  useConsolidatedRatios,
  useConsolidationGroups,
  useEtatAbonnement,
  useEntities,
  useOpportunitesDossier,
  usePeriods,
  useRatios,
  useTrend,
} from "../api/hooks";
import { BoutonDemonstration } from "../components/BoutonDemonstration";
import { AiresTemporelles } from "../components/Graphique";
import { Synthese } from "../components/tableau/Synthese";
import { TuileChiffre } from "../components/tableau/TuileChiffre";
import { Cascade } from "../components/tableau/Cascade";
import { EquationTresorerie } from "../components/tableau/EquationTresorerie";
import { Delais } from "../components/tableau/Delais";
import { FAMILLES, FamilleIndicateurs } from "../components/tableau/FamilleIndicateurs";
import { CarteOpportunite } from "../components/opportunites/CarteOpportunite";
import {
  EntetePage,
  EtatVide,
  SqueletteCarte,
  SqueletteTuiles,
  Zone,
} from "../components/etats";
import { formatCurrency, formatRatioValue } from "../lib/format";
import { ecart, etapesCascade, etatIndicateurs, periodesComparables } from "../lib/tableauDeBord";
import type { RatioCategory, RatioResultPayload, TrendPoint } from "../api/types";
import { useDossierCourant } from "../lib/dossierCourant";

/**
 * Page vers laquelle mène chaque ratio qui décroche.
 *
 * Un tableau de bord qui affiche « DSO : 70 jours · Critique » et s'arrête là
 * est un cul-de-sac : le lecteur voit le symptôme sans chemin vers la cause.
 * Chaque ratio sait désormais où se trouve son explication.
 */
const OU_COMPRENDRE: Record<string, { to: string; libelle: string }> = {
  dso: { to: "/receivables", libelle: "Voir qui doit quoi" },
  dpo: { to: "/receivables", libelle: "Voir les dettes fournisseurs" },
  dio: { to: "/diagnostic", libelle: "Voir le besoin de financement" },
  cycle_conversion_cash: {
    to: "/diagnostic",
    libelle: "Voir le besoin de financement",
  },
  bfr: { to: "/diagnostic", libelle: "Voir le BFR en jours" },
  tresorerie_nette: { to: "/cash", libelle: "Voir la projection" },
  marge_brute: { to: "/analysis", libelle: "Voir les soldes de gestion" },
  marge_ebitda: { to: "/analysis", libelle: "Voir les soldes de gestion" },
  marge_nette: { to: "/analysis", libelle: "Voir les soldes de gestion" },
  gearing: { to: "/diagnostic", libelle: "Voir les scores de fragilité" },
  autonomie_financiere: {
    to: "/diagnostic",
    libelle: "Voir les scores de fragilité",
  },
  capacite_remboursement: {
    to: "/diagnostic",
    libelle: "Voir les scores de fragilité",
  },
  couverture_interets: {
    to: "/diagnostic",
    libelle: "Voir les scores de fragilité",
  },
  croissance_ca: { to: "/analysis", libelle: "Voir l'évolution" },
};

export function Dashboard() {
  const { data: entities, isLoading, error, refetch } = useEntities();
  /*
   * Le dossier est celui de tous les écrans ; la vue consolidée, elle, n'est
   * pas un dossier et reste propre au tableau de bord. La mémoriser comme
   * dossier courant enverrait le diagnostic chercher une entité qui n'existe
   * pas.
   */
  const [dossier] = useDossierCourant(entities);
  const [consolide, setConsolide] = useState(false);

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Tableau de bord"
        sousTitre="Vue synthétique de la performance financière."
      >
        {/* Le dossier se choisit dans le menu ; reste ici ce qui n'en est
            pas un, la vue du groupe. */}
        {entities && entities.length > 1 && (
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]" role="radiogroup" aria-label="Périmètre">
            {[
              { valeur: false, libelle: "Ce dossier" },
              { valeur: true, libelle: "Groupe consolidé" },
            ].map((option) => (
              <button
                key={option.libelle}
                type="button"
                role="radio"
                aria-checked={consolide === option.valeur}
                onClick={() => setConsolide(option.valeur)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  consolide === option.valeur ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                }`}
              >
                {option.libelle}
              </button>
            ))}
          </div>
        )}
      </EntetePage>

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="les entités"
        squelette={<SqueletteTuiles />}
      >
        {!entities || entities.length === 0 ? (
          <EtatVide
            titre="Bienvenue sur Cadran"
            action={{ to: "/import", label: "Importer des données" }}
            secondaire={<BoutonDemonstration />}
          >
            Aucun dossier n&apos;a encore été créé. Importez un Fichier des
            Écritures Comptables ou une balance pour commencer — ou chargez le
            dossier de démonstration pour essayer Cadran sur des chiffres
            complets.
          </EtatVide>
        ) : consolide && entities.length > 1 ? (
          <ConsolidatedDashboard />
        ) : (
          <EntityDashboard entityId={dossier} />
        )}
      </Zone>
    </div>
  );
}

function EntityDashboard({ entityId }: { entityId: string }) {
  const { data: periods, isLoading, error, refetch } = usePeriods(entityId);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const { data: trend } = useTrend(entityId);

  useEffect(() => {
    if (periods && periods.length > 0)
      setPeriodId(periods[periods.length - 1].id);
    else setPeriodId(null);
  }, [periods]);

  const {
    data: ratioResult,
    isLoading: ratiosLoading,
    error: ratiosError,
    refetch: refetchRatios,
  } = useRatios(periodId);

  /* Les périodes de même durée, pour l'écart et la tendance : un trimestre
   * ne se compare qu'à des trimestres. */
  const comparables = periodesComparables(periods ?? [], periodId)
    .map((p) => trend?.find((t) => t.periodId === p.id))
    .filter((t): t is TrendPoint => Boolean(t));
  const contexte: ContexteTemporel = {
    comparables,
    precedent: comparables.length > 1 ? comparables[comparables.length - 2] : null,
  };

  return (
    <Zone
      chargement={isLoading}
      erreur={error}
      onReessayer={() => void refetch()}
      quoi="les périodes"
      squelette={<SqueletteTuiles />}
    >
      {!periods || periods.length === 0 ? (
        <EtatVide
          titre="Aucune période importée"
          action={{ to: "/import", label: "Importer des données" }}
          secondaire={<BoutonDemonstration />}
        >
          Ce dossier n&apos;a encore aucune donnée comptable. Importez son FEC
          ou sa balance — ou chargez le dossier de démonstration pour essayer
          Cadran sur des chiffres complets.
        </EtatVide>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-ink-3" aria-hidden="true" />
              <label htmlFor="periode-tableau" className="text-sm font-medium text-ink-2">
                Période
              </label>
              <select
                id="periode-tableau"
                className="input w-auto py-1.5 font-semibold"
                value={periodId ?? ""}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {contexte.precedent && (
              <span className="text-sm text-ink-3">
                Évolutions calculées par rapport à {contexte.precedent.label}
              </span>
            )}
          </div>

          <Zone
            chargement={ratiosLoading}
            erreur={ratiosError}
            onReessayer={() => void refetchRatios()}
            quoi="les ratios"
            squelette={
              <div className="space-y-6">
                <SqueletteTuiles />
                <SqueletteCarte />
              </div>
            }
          >
            {ratioResult && (
              <DashboardBody
                ratioResult={ratioResult}
                contexte={contexte}
                missions={<MissionsDossier entityId={entityId} />}
              />
            )}
          </Zone>
        </div>
      )}
    </Zone>
  );
}

function ConsolidatedDashboard() {
  /*
   * La formule décide, et l'écran le dit.
   *
   * Le serveur refuse désormais les deux routes de consolidation quand la
   * formule ne l'inclut pas. Sans ce test, l'utilisateur tomberait sur « une
   * erreur est survenue » là où la vraie réponse est « cette fonction
   * commence à la formule Cabinet » — un message qui s'explique et se résout.
   *
   * On garde l'entrée visible dans le sélecteur plutôt que de la masquer :
   * une fonction qu'on ne voit pas ne s'achète pas, et surtout on ne peut pas
   * se demander pourquoi elle a disparu.
   */
  const { data: abonnement } = useEtatAbonnement();
  const incluse = abonnement?.plan.quotas.consolidation ?? true;

  const {
    data: groups,
    isLoading,
    error,
    refetch,
  } = useConsolidationGroups({ actif: incluse });
  const [groupKey, setGroupKey] = useState<string>("");

  useEffect(() => {
    if (groups && groups.length > 0) setGroupKey(groups[groups.length - 1].key);
  }, [groups]);

  const selectedGroup = groups?.find((g) => g.key === groupKey) ?? null;
  const {
    data: consolidated,
    isLoading: ratiosLoading,
    error: ratiosError,
    refetch: refetchRatios,
  } = useConsolidatedRatios(
    selectedGroup
      ? { startDate: selectedGroup.startDate, endDate: selectedGroup.endDate }
      : null,
  );

  if (!incluse) {
    return (
      <div className="card">
        <h2 className="font-display text-lg font-semibold">
          Consolidation de groupe
        </h2>
        <p className="text-sm text-ink-2 mt-2 max-w-prose">
          Elle additionne les comptes de plusieurs entités sur une même période
          et recalcule les ratios sur l&apos;ensemble — pas la moyenne des
          ratios de chacune, qui ne voudrait rien dire. La formule «{" "}
          {abonnement?.plan.label} » ne l&apos;inclut pas ; elle commence à la
          formule Cabinet.
        </p>
        <Link to="/abonnement" className="btn-secondary mt-4 inline-flex">
          Voir les formules
        </Link>
      </div>
    );
  }

  return (
    <Zone
      chargement={isLoading}
      erreur={error}
      onReessayer={() => void refetch()}
      quoi="les périodes consolidables"
      squelette={<SqueletteTuiles />}
    >
      {!groups || groups.length === 0 ? (
        <EtatVide titre="Aucune période consolidable">
          La consolidation regroupe les périodes de même plage de dates entre
          entités. Il n&apos;y en a pas encore deux qui se recouvrent.
        </EtatVide>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-ink-3">
              {selectedGroup &&
                `${selectedGroup.entities.length} entité${selectedGroup.entities.length > 1 ? "s" : ""} : ${selectedGroup.entities.map((e) => e.name).join(", ")}`}
            </p>
            <select
              className="input w-48"
              value={groupKey}
              aria-label="Période consolidée"
              onChange={(e) => setGroupKey(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <Zone
            chargement={ratiosLoading}
            erreur={ratiosError}
            onReessayer={() => void refetchRatios()}
            quoi="les ratios consolidés"
            squelette={
              <div className="space-y-6">
                <SqueletteTuiles />
                <SqueletteCarte />
              </div>
            }
          >
            {consolidated && (
              <div className="space-y-6">
                <DashboardBody ratioResult={consolidated} />
                <p className="text-xs text-ink-3">
                  {consolidated.growthScope
                    ? `Croissance du CA calculée à périmètre constant vs ${consolidated.growthScope.previousLabel} (${consolidated.growthScope.entities.map((e) => e.name).join(", ")}).`
                    : "Croissance du CA non disponible : aucune entité commune avec la période précédente."}
                </p>
              </div>
            )}
          </Zone>
        </div>
      )}
    </Zone>
  );
}

interface ContexteTemporel {
  /** Points de tendance des périodes comparables, jusqu'à la période affichée. */
  comparables: TrendPoint[];
  precedent: TrendPoint | null;
}

/** Bandeau des alertes non acquittées, avec le chemin pour les traiter. */
function BandeauAlertes() {
  const { data: evenements } = useAlertEvents();
  const actives = evenements?.filter((e) => !e.acknowledged) ?? [];
  if (actives.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 px-4 py-3">
      <p className="flex items-start gap-2.5 text-sm min-w-0">
        <AlertTriangle size={18} className="flex-none text-warning mt-px" aria-hidden="true" />
        <span>
          <span className="font-semibold">
            {actives.length} alerte{actives.length > 1 ? "s" : ""} à traiter
          </span>{" "}
          <span className="text-ink-2">
            —{" "}
            {actives
              .slice(0, 2)
              .map((e) => e.rule.label)
              .join(" · ")}
            {actives.length > 2 && ` · et ${actives.length - 2} autre${actives.length > 3 ? "s" : ""}`}
          </span>
        </span>
      </p>
      <Link to="/alerts" className="btn-secondary py-1.5 flex-none">
        Traiter les alertes
      </Link>
    </div>
  );
}

/** Un bloc titré du tableau de bord, qui apparaît à son tour. */
function Bloc({
  titre,
  sousTitre,
  children,
  className = "",
  rang = 0,
  id,
}: {
  titre: string;
  sousTitre?: string;
  children: ReactNode;
  className?: string;
  rang?: number;
  id?: string;
}) {
  return (
    <section id={id} className={`card apparition ${className}`} style={{ animationDelay: `${rang * 70}ms` } as CSSProperties}>
      <h2 className="text-lg font-bold">{titre}</h2>
      {sousTitre && <p className="text-sm text-ink-3 mt-0.5 mb-4 max-w-prose">{sousTitre}</p>}
      {!sousTitre && <div className="mb-4" />}
      {children}
    </section>
  );
}

/**
 * Le tableau de bord, du plus synthétique au plus détaillé.
 *
 * 1. Où en est l'entreprise, en une phrase et un décompte.
 * 2. Les quatre chiffres qu'on demande d'abord, avec leur évolution.
 * 3. Pourquoi : la cascade du chiffre d'affaires au résultat, et l'équation
 *    de la trésorerie.
 * 4. Comment ça évolue, et combien de jours l'argent reste dehors.
 * 5. Le détail, famille par famille.
 *
 * Chaque graphique répond à une question écrite au-dessus de lui : un
 * graphique sans question laisse le lecteur deviner ce qu'il doit y voir.
 */
/**
 * Les missions que ce dossier appelle, juste sous ses chiffres clés : c'est
 * là que le constat devient une proposition. Rien ne s'affiche quand il n'y
 * en a pas — un bloc vide « aucune mission » n'apprendrait rien.
 */
function MissionsDossier({ entityId }: { entityId: string }) {
  const { data } = useOpportunitesDossier(entityId);
  if (!data || data.opportunites.length === 0) return null;
  const affichees = data.opportunites.slice(0, 3);
  return (
    <section className="apparition" style={{ animationDelay: "320ms" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-lg font-bold">Missions à proposer</h2>
        <Link to="/opportunites" className="text-sm font-medium text-primary hover:underline">
          Tout le portefeuille →
        </Link>
      </div>
      <p className="text-sm text-ink-3 mb-4">
        Ce que les chiffres de l&apos;exercice {data.exercice}
        {data.exerciceCompare ? `, comparés à ${data.exerciceCompare},` : ""} appellent — chiffré en ordre de grandeur.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {affichees.map((o) => (
          <CarteOpportunite key={o.type} opportunite={o} entityId={entityId} devise={data.devise} />
        ))}
      </div>
    </section>
  );
}

function DashboardBody({
  ratioResult,
  contexte,
  missions,
}: {
  ratioResult: Pick<RatioResultPayload, "currency" | "aggregates" | "derived" | "ratios">;
  contexte?: ContexteTemporel;
  /** Le bloc des missions du dossier ; absent de la vue consolidée. */
  missions?: ReactNode;
}) {
  const { currency, aggregates, derived, ratios } = ratioResult;
  const ecartBilan = derived.ecartBilan;
  const bilanDesequilibre = ecartBilan !== undefined && Math.abs(ecartBilan) > 1;
  const etat = etatIndicateurs(ratios);
  const precedent = contexte?.precedent ?? null;
  const serie = (cle: "chiffreAffaires" | "ebitda" | "resultatNet" | "tresorerieNette") =>
    contexte && contexte.comparables.length > 1 ? contexte.comparables.slice(-8).map((t) => t[cle]) : undefined;
  const euros = (n: number) => formatCurrency(Math.round(n), currency);
  const marge = (id: string) => formatRatioValue(ratios.find((r) => r.id === id)?.value ?? null, "pourcentage");

  return (
    <div className="space-y-6">
      {bilanDesequilibre && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Bilan déséquilibré.</span>{" "}
            <span className="text-ink-2">
              Écart de {formatCurrency(Math.abs(ecartBilan!), currency)} entre l&apos;actif et le passif. Un poste est
              probablement mal classé à l&apos;import : les ratios de structure et de liquidité sont à interpréter
              avec prudence.
            </span>
          </p>
          <Link to="/import" className="btn-secondary py-1.5 flex-none">
            Reprendre l&apos;import
          </Link>
        </div>
      )}

      <BandeauAlertes />

      <div className="apparition">
        <Synthese etat={etat} currency={currency} ouComprendre={OU_COMPRENDRE} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            libelle: "Chiffre d'affaires",
            aide: "Les ventes de la période, hors taxes.",
            valeur: aggregates.chiffreAffaires,
            avant: precedent?.chiffreAffaires,
            serie: serie("chiffreAffaires"),
          },
          {
            libelle: "EBITDA",
            aide: "Ce que l'activité dégage avant amortissements, intérêts et impôt : la rentabilité du métier lui-même.",
            valeur: derived.ebitda,
            avant: precedent?.ebitda,
            sousTitre: `${marge("marge_ebitda")} du chiffre d'affaires`,
            serie: serie("ebitda"),
          },
          {
            libelle: "Résultat net",
            aide: "Ce qui reste une fois tout payé, impôt compris : le bénéfice, ou la perte.",
            valeur: derived.resultatNet,
            avant: precedent?.resultatNet,
            sousTitre: `${marge("marge_nette")} du chiffre d'affaires`,
            serie: serie("resultatNet"),
          },
          {
            libelle: "Trésorerie nette",
            aide: "Fonds de roulement moins besoin en fonds de roulement : l'argent réellement disponible.",
            valeur: derived.tresorerieNette,
            avant: precedent?.tresorerieNette,
            serie: serie("tresorerieNette"),
          },
        ].map((t, rang) => (
          <div key={t.libelle} className="apparition h-full" style={{ animationDelay: `${(rang + 1) * 60}ms` }}>
            <TuileChiffre
              libelle={t.libelle}
              aide={t.aide}
              valeur={t.valeur}
              formater={euros}
              ecart={ecart(t.valeur, t.avant)}
              comparaison={precedent?.label}
              sousTitre={t.sousTitre}
              serie={t.serie}
            />
          </div>
        ))}
      </div>

      {missions}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Bloc
          titre="Du chiffre d'affaires au résultat"
          sousTitre="Ce que deviennent les ventes : chaque barre grise est ce qui s'en va, chaque barre verte ce qui reste à cette étape."
          className="lg:col-span-7"
          rang={5}
        >
          <Cascade etapes={etapesCascade(aggregates, derived)} currency={currency} />
        </Bloc>
        <Bloc
          titre="D'où vient la trésorerie"
          sousTitre="Ce qui la finance, ce qui la consomme, et ce qui reste."
          className="lg:col-span-5"
          rang={6}
        >
          <EquationTresorerie
            fondsDeRoulement={derived.fondsDeRoulement}
            bfr={derived.bfr}
            tresorerie={derived.tresorerieNette}
            currency={currency}
          />
        </Bloc>

        {contexte && (
          <Bloc
            titre="Évolution"
            sousTitre={
              contexte.comparables.length > 1
                ? `Chiffre d'affaires et EBITDA sur les ${contexte.comparables.length} dernières périodes de même durée.`
                : undefined
            }
            className="lg:col-span-7"
            rang={7}
          >
            {contexte.comparables.length > 1 ? (
              <AiresTemporelles
                donnees={contexte.comparables.slice(-8).map((t) => ({
                  label: t.label,
                  chiffreAffaires: t.chiffreAffaires,
                  ebitda: t.ebitda,
                }))}
                series={[
                  { cle: "chiffreAffaires", label: "Chiffre d'affaires" },
                  { cle: "ebitda", label: "EBITDA" },
                ]}
                cleAbscisse="label"
                currency={currency}
                hauteur={250}
              />
            ) : (
              <p className="text-sm text-ink-3">
                L&apos;évolution s&apos;affichera dès qu&apos;une deuxième période de même durée sera importée.
              </p>
            )}
          </Bloc>
        )}
        <Bloc
          titre="Combien de temps l'argent reste dehors"
          sousTitre="Les délais du cycle d'exploitation, en jours."
          className={contexte ? "lg:col-span-5" : "lg:col-span-12"}
          rang={8}
        >
          <Delais ratios={ratios} />
        </Bloc>
      </div>

      <section id="indicateurs" className="apparition" style={{ animationDelay: "560ms" }}>
        <h2 className="text-lg font-bold">Le détail des indicateurs</h2>
        <p className="text-sm text-ink-3 mt-0.5 mb-4">
          Les {ratios.length} ratios calculés à chaque import, rangés par question. La définition de chacun est au
          survol de l&apos;icône ⓘ.
        </p>
        <div className="grid lg:grid-cols-2 gap-4">
          {(Object.keys(FAMILLES) as RatioCategory[]).map((categorie) => (
            <FamilleIndicateurs
              key={categorie}
              categorie={categorie}
              ratios={ratios.filter((r) => r.category === categorie)}
              currency={currency}
              ouComprendre={OU_COMPRENDRE}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
