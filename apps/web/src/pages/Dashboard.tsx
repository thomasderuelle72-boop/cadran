import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePeriods, useRatios, useTrend } from "../api/hooks";
import { KpiTile } from "../components/KpiTile";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency, formatRatioValue } from "../lib/format";
import type { RatioCategory } from "../api/types";

const CATEGORY_LABELS: Record<RatioCategory, string> = {
  RENTABILITE: "Rentabilité",
  LIQUIDITE: "Liquidité",
  SOLVABILITE: "Solvabilité",
  ACTIVITE: "Activité",
};

export function Dashboard() {
  const { data: periods, isLoading: periodsLoading } = usePeriods();
  const [periodId, setPeriodId] = useState<string | null>(null);
  const { data: trend } = useTrend();

  useEffect(() => {
    if (!periodId && periods && periods.length > 0) {
      setPeriodId(periods[periods.length - 1].id);
    }
  }, [periods, periodId]);

  const { data: ratioResult, isLoading: ratiosLoading } = useRatios(periodId);

  if (periodsLoading) return <p className="text-ink/50">Chargement…</p>;

  if (!periods || periods.length === 0) {
    return (
      <div className="card max-w-lg">
        <h1 className="font-display text-xl font-semibold mb-2">Bienvenue sur Cadran</h1>
        <p className="text-sm text-ink/60 mb-4">
          Aucune période comptable n'a encore été créée. Importez vos premières données pour voir apparaître votre
          tableau de bord.
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
        <select
          className="input w-48"
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

      {ratiosLoading && <p className="text-ink/50">Calcul des ratios…</p>}

      {ratioResult && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile label="Chiffre d'affaires" value={formatCurrency(ratioResult.aggregates.chiffreAffaires)} />
            <KpiTile
              label="EBITDA"
              value={formatCurrency(ratioResult.derived.ebitda)}
              sublabel={formatRatioValue(
                ratioResult.ratios.find((r) => r.id === "marge_ebitda")?.value ?? null,
                "pourcentage"
              ) + " de marge"}
            />
            <KpiTile
              label="Résultat net"
              value={formatCurrency(ratioResult.derived.resultatNet)}
              sublabel={formatRatioValue(
                ratioResult.ratios.find((r) => r.id === "marge_nette")?.value ?? null,
                "pourcentage"
              ) + " de marge"}
            />
            <KpiTile label="Trésorerie nette" value={formatCurrency(ratioResult.derived.tresorerieNette)} />
          </div>

          {trend && trend.length > 1 && (
            <div className="card">
              <h3 className="font-display text-lg font-semibold mb-3">Tendance — CA &amp; EBITDA</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
                  <XAxis dataKey="label" fontSize={12} stroke="#171F1980" />
                  <YAxis
                    fontSize={12}
                    stroke="#171F1980"
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k€`}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Line type="monotone" dataKey="chiffreAffaires" name="CA" stroke="#1F5C4E" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#9C5F26" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

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
                          <span className="font-mono font-semibold">{formatRatioValue(ratio.value, ratio.unit)}</span>
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
      )}
    </div>
  );
}
