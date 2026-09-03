import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useConsolidatedRatios, useConsolidationGroups, useEntities, usePeriods, useRatios, useTrend } from "../api/hooks";
import { KpiTile } from "../components/KpiTile";
import { StatusBadge } from "../components/StatusBadge";
import { EntitySelector, CONSOLIDATED_VALUE } from "../components/EntitySelector";
import { formatCurrency, formatRatioValue } from "../lib/format";
import type { RatioCategory, RatioResultPayload } from "../api/types";

const CATEGORY_LABELS: Record<RatioCategory, string> = {
  RENTABILITE: "Rentabilité",
  LIQUIDITE: "Liquidité",
  SOLVABILITE: "Solvabilité",
  ACTIVITE: "Activité",
};

export function Dashboard() {
  const { data: entities, isLoading: entitiesLoading } = useEntities();
  const [scope, setScope] = useState<string>("");

  useEffect(() => {
    if (!scope && entities && entities.length > 0) setScope(entities[0].id);
  }, [entities, scope]);

  const isConsolidated = scope === CONSOLIDATED_VALUE;

  if (entitiesLoading) return <p className="text-ink/50">Chargement…</p>;

  if (!entities || entities.length === 0) {
    return (
      <div className="card max-w-lg">
        <h1 className="font-display text-xl font-semibold mb-2">Bienvenue sur Cadran</h1>
        <p className="text-sm text-ink/60 mb-4">
          Aucune entité n'a encore été créée. Commencez par importer vos premières données.
        </p>
        <Link to="/import" className="btn-primary inline-block">
          Importer des données
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-ink/50">Vue synthétique de la performance financière.</p>
        </div>
        <EntitySelector value={scope} onChange={setScope} allowConsolidated={entities.length > 1} />
      </div>

      {isConsolidated ? <ConsolidatedDashboard /> : <EntityDashboard entityId={scope} />}
    </div>
  );
}

function EntityDashboard({ entityId }: { entityId: string }) {
  const { data: periods, isLoading: periodsLoading } = usePeriods(entityId);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const { data: trend } = useTrend(entityId);

  useEffect(() => {
    if (periods && periods.length > 0) setPeriodId(periods[periods.length - 1].id);
    else setPeriodId(null);
  }, [periods]);

  const { data: ratioResult, isLoading: ratiosLoading } = useRatios(periodId);

  if (periodsLoading) return <p className="text-ink/50">Chargement…</p>;

  if (!periods || periods.length === 0) {
    return (
      <div className="card max-w-lg">
        <p className="text-sm text-ink/60 mb-4">Aucune période importée pour cette entité.</p>
        <Link to="/import" className="btn-primary inline-block">
          Importer des données
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select className="input w-48" value={periodId ?? ""} onChange={(e) => setPeriodId(e.target.value)}>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {ratiosLoading && <p className="text-ink/50">Calcul des ratios…</p>}

      {ratioResult && (
        <>
          <DashboardBody ratioResult={ratioResult} />
          {trend && trend.length > 1 && (
            <TrendChart
              currency={ratioResult.currency}
              trend={trend.map((t) => ({ label: t.label, chiffreAffaires: t.chiffreAffaires, ebitda: t.ebitda }))}
            />
          )}
        </>
      )}
    </div>
  );
}

function ConsolidatedDashboard() {
  const { data: groups, isLoading: groupsLoading } = useConsolidationGroups();
  const [groupKey, setGroupKey] = useState<string>("");

  useEffect(() => {
    if (groups && groups.length > 0) setGroupKey(groups[groups.length - 1].key);
  }, [groups]);

  const selectedGroup = groups?.find((g) => g.key === groupKey) ?? null;
  const { data: consolidated, isLoading: ratiosLoading } = useConsolidatedRatios(
    selectedGroup ? { startDate: selectedGroup.startDate, endDate: selectedGroup.endDate } : null
  );

  if (groupsLoading) return <p className="text-ink/50">Chargement…</p>;
  if (!groups || groups.length === 0) return <p className="text-ink/50">Aucune période consolidable pour le moment.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink/50">
          {selectedGroup && `${selectedGroup.entities.length} entité(s) : ${selectedGroup.entities.map((e) => e.name).join(", ")}`}
        </p>
        <select className="input w-48" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {ratiosLoading && <p className="text-ink/50">Calcul des ratios consolidés…</p>}
      {consolidated && (
        <>
          <DashboardBody ratioResult={consolidated} />
          <p className="text-xs text-ink/50">
            {consolidated.growthScope
              ? `Croissance du CA calculée à périmètre constant vs ${consolidated.growthScope.previousLabel} (${consolidated.growthScope.entities.map((e) => e.name).join(", ")}).`
              : "Croissance du CA non disponible : aucune entité commune avec la période précédente."}
          </p>
        </>
      )}
    </div>
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
    <>
      {bilanDesequilibre && (
        <div className="card border-warning/40 bg-warning-soft/40 text-sm">
          <span className="font-semibold text-warning">Bilan déséquilibré.</span>{" "}
          <span className="text-ink/70">
            Écart de {formatCurrency(Math.abs(ecartBilan!), currency)} entre l&apos;actif et le passif. Un poste est
            probablement mal classé à l&apos;import : les ratios de structure et de liquidité sont à interpréter avec
            prudence.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Chiffre d'affaires" value={formatCurrency(ratioResult.aggregates.chiffreAffaires, currency)} />
        <KpiTile
          label="EBITDA"
          value={formatCurrency(ratioResult.derived.ebitda, currency)}
          sublabel={
            formatRatioValue(ratioResult.ratios.find((r) => r.id === "marge_ebitda")?.value ?? null, "pourcentage") +
            " de marge"
          }
        />
        <KpiTile
          label="Résultat net"
          value={formatCurrency(ratioResult.derived.resultatNet, currency)}
          sublabel={
            formatRatioValue(ratioResult.ratios.find((r) => r.id === "marge_nette")?.value ?? null, "pourcentage") +
            " de marge"
          }
        />
        <KpiTile label="Trésorerie nette" value={formatCurrency(ratioResult.derived.tresorerieNette, currency)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(Object.keys(CATEGORY_LABELS) as RatioCategory[]).map((category) => {
          const ratios = ratioResult.ratios.filter((r) => r.category === category);
          return (
            <div key={category} className="card">
              <h3 className="font-display text-lg font-semibold mb-3">{CATEGORY_LABELS[category]}</h3>
              <ul className="space-y-2">
                {ratios.map((ratio) => (
                  <li key={ratio.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink/70">{ratio.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{formatRatioValue(ratio.value, ratio.unit, currency)}</span>
                      <StatusBadge status={ratio.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TrendChart({
  trend,
  currency,
}: {
  trend: Array<{ label: string; chiffreAffaires: number; ebitda: number }>;
  currency: string;
}) {
  return (
    <div className="card">
      <h3 className="font-display text-lg font-semibold mb-3">Tendance — CA &amp; EBITDA</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
          <XAxis dataKey="label" fontSize={12} stroke="#171F1980" />
          <YAxis fontSize={12} stroke="#171F1980" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
          <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), currency)} />
          <Line type="monotone" dataKey="chiffreAffaires" name="CA" stroke="#1F5C4E" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#9C5F26" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
