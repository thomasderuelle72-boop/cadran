import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAlertEvents,
  useConsolidatedRatios,
  useConsolidationGroups,
  useEntities,
  usePeriods,
  useRatios,
  useTrend,
} from "../api/hooks";
import { KpiTile } from "../components/KpiTile";
import { StatusBadge } from "../components/StatusBadge";
import { EntitySelector, CONSOLIDATED_VALUE } from "../components/EntitySelector";
import { CourbeTemporelle } from "../components/Graphique";
import { EntetePage, EtatVide, SqueletteCarte, SqueletteTuiles, Zone } from "../components/etats";
import { formatCurrency, formatRatioValue } from "../lib/format";
import type { RatioCategory, RatioResultPayload, RatioValue } from "../api/types";

const CATEGORY_LABELS: Record<RatioCategory, string> = {
  RENTABILITE: "Rentabilité",
  LIQUIDITE: "Liquidité",
  SOLVABILITE: "Solvabilité",
  ACTIVITE: "Activité",
};

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
  cycle_conversion_cash: { to: "/diagnostic", libelle: "Voir le besoin de financement" },
  bfr: { to: "/diagnostic", libelle: "Voir le BFR en jours" },
  tresorerie_nette: { to: "/cash", libelle: "Voir la projection" },
  marge_brute: { to: "/analysis", libelle: "Voir les soldes de gestion" },
  marge_ebitda: { to: "/analysis", libelle: "Voir les soldes de gestion" },
  marge_nette: { to: "/analysis", libelle: "Voir les soldes de gestion" },
  gearing: { to: "/diagnostic", libelle: "Voir les scores de fragilité" },
  autonomie_financiere: { to: "/diagnostic", libelle: "Voir les scores de fragilité" },
  capacite_remboursement: { to: "/diagnostic", libelle: "Voir les scores de fragilité" },
  couverture_interets: { to: "/diagnostic", libelle: "Voir les scores de fragilité" },
  croissance_ca: { to: "/analysis", libelle: "Voir l'évolution" },
};

export function Dashboard() {
  const { data: entities, isLoading, error, refetch } = useEntities();
  const [scope, setScope] = useState<string>("");

  useEffect(() => {
    if (!scope && entities && entities.length > 0) setScope(entities[0].id);
  }, [entities, scope]);

  const isConsolidated = scope === CONSOLIDATED_VALUE;

  return (
    <div className="space-y-6">
      <EntetePage titre="Tableau de bord" sousTitre="Vue synthétique de la performance financière.">
        {entities && entities.length > 0 && (
          <EntitySelector value={scope} onChange={setScope} allowConsolidated={entities.length > 1} />
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
          <EtatVide titre="Bienvenue sur Cadran" action={{ to: "/import", label: "Importer des données" }}>
            Aucune entité n&apos;a encore été créée. Importez un Fichier des Écritures Comptables ou
            une balance pour commencer : tout le reste en découle.
          </EtatVide>
        ) : isConsolidated ? (
          <ConsolidatedDashboard />
        ) : (
          <EntityDashboard entityId={scope} />
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
    if (periods && periods.length > 0) setPeriodId(periods[periods.length - 1].id);
    else setPeriodId(null);
  }, [periods]);

  const {
    data: ratioResult,
    isLoading: ratiosLoading,
    error: ratiosError,
    refetch: refetchRatios,
  } = useRatios(periodId);

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
        >
          Cette entité n&apos;a encore aucune donnée comptable.
        </EtatVide>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <span className="oeil">Période analysée</span>
            <select
              className="input w-48"
              value={periodId ?? ""}
              aria-label="Période"
              onChange={(e) => setPeriodId(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
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
              <div className="space-y-6">
                <DashboardBody ratioResult={ratioResult} />
                {trend && trend.length > 1 && (
                  <div className="card">
                    <h2 className="font-display text-lg font-semibold mb-1">
                      Chiffre d&apos;affaires et EBITDA
                    </h2>
                    <p className="text-sm text-ink/50 mb-3">Par période importée.</p>
                    <CourbeTemporelle
                      donnees={trend.map((t) => ({
                        label: t.label,
                        chiffreAffaires: t.chiffreAffaires,
                        ebitda: t.ebitda,
                      }))}
                      series={[
                        { cle: "chiffreAffaires", label: "CA" },
                        { cle: "ebitda", label: "EBITDA" },
                      ]}
                      cleAbscisse="label"
                      currency={ratioResult.currency}
                    />
                  </div>
                )}
              </div>
            )}
          </Zone>
        </div>
      )}
    </Zone>
  );
}

function ConsolidatedDashboard() {
  const { data: groups, isLoading, error, refetch } = useConsolidationGroups();
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
    selectedGroup ? { startDate: selectedGroup.startDate, endDate: selectedGroup.endDate } : null
  );

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
          La consolidation regroupe les périodes de même plage de dates entre entités. Il n&apos;y en
          a pas encore deux qui se recouvrent.
        </EtatVide>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-ink/50">
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
                <p className="text-xs text-ink/50">
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

/** Bandeau des alertes non acquittées, avec le chemin pour les traiter. */
function BandeauAlertes() {
  const { data: evenements } = useAlertEvents();
  const actives = evenements?.filter((e) => !e.acknowledged) ?? [];
  if (actives.length === 0) return null;

  return (
    <div className="card border-warning/40 bg-warning-soft/30 flex items-start justify-between gap-4 flex-wrap">
      <p className="text-sm">
        <span className="font-semibold text-warning">
          {actives.length} alerte{actives.length > 1 ? "s" : ""} non acquittée
          {actives.length > 1 ? "s" : ""}.
        </span>{" "}
        <span className="text-ink/70">
          {actives
            .slice(0, 2)
            .map((e) => e.rule.label)
            .join(" · ")}
          {actives.length > 2 && ` · et ${actives.length - 2} autre${actives.length > 3 ? "s" : ""}`}
        </span>
      </p>
      <Link to="/alerts" className="btn-secondary flex-none">
        Traiter les alertes
      </Link>
    </div>
  );
}

function LigneRatio({ ratio, currency }: { ratio: RatioValue; currency: string }) {
  const lien = ratio.status === "critique" || ratio.status === "attention" ? OU_COMPRENDRE[ratio.id] : undefined;

  return (
    <li className="flex items-start justify-between gap-3 text-sm py-1">
      <span className="min-w-0">
        <span className="text-ink/70">{ratio.label}</span>
        {lien && (
          <Link
            to={lien.to}
            className="block text-xs text-primary hover:underline mt-0.5"
            title={ratio.interpretation}
          >
            {lien.libelle} →
          </Link>
        )}
      </span>
      <span className="flex items-center gap-2 flex-none">
        <span className="font-mono font-semibold">
          {formatRatioValue(ratio.value, ratio.unit, currency)}
        </span>
        <StatusBadge status={ratio.status} />
      </span>
    </li>
  );
}

function DashboardBody({
  ratioResult,
}: {
  ratioResult: Pick<RatioResultPayload, "currency" | "aggregates" | "derived" | "ratios">;
}) {
  const { currency } = ratioResult;
  const ecartBilan = ratioResult.derived.ecartBilan;
  const bilanDesequilibre = ecartBilan !== undefined && Math.abs(ecartBilan) > 1;

  return (
    <div className="space-y-6">
      {bilanDesequilibre && (
        <div className="card border-warning/40 bg-warning-soft/40 flex items-start justify-between gap-4 flex-wrap">
          <p className="text-sm">
            <span className="font-semibold text-warning">Bilan déséquilibré.</span>{" "}
            <span className="text-ink/70">
              Écart de {formatCurrency(Math.abs(ecartBilan!), currency)} entre l&apos;actif et le
              passif. Un poste est probablement mal classé à l&apos;import : les ratios de structure
              et de liquidité sont à interpréter avec prudence.
            </span>
          </p>
          <Link to="/import" className="btn-secondary flex-none">
            Reprendre l&apos;import
          </Link>
        </div>
      )}

      <BandeauAlertes />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Chiffre d'affaires"
          value={formatCurrency(ratioResult.aggregates.chiffreAffaires, currency)}
        />
        <KpiTile
          label="EBITDA"
          value={formatCurrency(ratioResult.derived.ebitda, currency)}
          sublabel={`${formatRatioValue(
            ratioResult.ratios.find((r) => r.id === "marge_ebitda")?.value ?? null,
            "pourcentage"
          )} de marge`}
        />
        <KpiTile
          label="Résultat net"
          value={formatCurrency(ratioResult.derived.resultatNet, currency)}
          sublabel={`${formatRatioValue(
            ratioResult.ratios.find((r) => r.id === "marge_nette")?.value ?? null,
            "pourcentage"
          )} de marge`}
        />
        <KpiTile
          label="Trésorerie nette"
          value={formatCurrency(ratioResult.derived.tresorerieNette, currency)}
          sublabel="FR − BFR"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {(Object.keys(CATEGORY_LABELS) as RatioCategory[]).map((category) => {
          const ratios = ratioResult.ratios.filter((r) => r.category === category);
          return (
            <div key={category} className="card">
              <h2 className="font-display text-lg font-semibold mb-2">{CATEGORY_LABELS[category]}</h2>
              <ul className="divide-y divide-rule/5">
                {ratios.map((ratio) => (
                  <LigneRatio key={ratio.id} ratio={ratio} currency={currency} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
