import { useEffect, useState } from "react";
import { usePeriods, useRatios } from "../api/hooks";
import { RatioTable } from "../components/RatioTable";
import type { RatioCategory } from "../api/types";

const CATEGORY_LABELS: Record<RatioCategory, string> = {
  RENTABILITE: "Rentabilité",
  LIQUIDITE: "Liquidité",
  SOLVABILITE: "Solvabilité",
  ACTIVITE: "Activité",
};

export function RatiosPage() {
  const { data: periods } = usePeriods();
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (!periodId && periods && periods.length > 0) setPeriodId(periods[periods.length - 1].id);
  }, [periods, periodId]);

  const { data: ratioResult, isLoading } = useRatios(periodId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Catalogue des ratios</h1>
          <p className="text-sm text-ink/50">Les 19 ratios calculés automatiquement à chaque import.</p>
        </div>
        {periods && periods.length > 0 && (
          <select className="input w-48" value={periodId ?? ""} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <p className="text-ink/50">Chargement…</p>}

      {ratioResult &&
        (Object.keys(CATEGORY_LABELS) as RatioCategory[]).map((category) => (
          <RatioTable
            key={category}
            title={CATEGORY_LABELS[category]}
            ratios={ratioResult.ratios.filter((r) => r.category === category)}
          />
        ))}
    </div>
  );
}
