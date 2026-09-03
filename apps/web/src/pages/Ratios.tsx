import { useEffect, useState } from "react";
import { useEntities, usePeriods, useRatios } from "../api/hooks";
import { EntitySelector } from "../components/EntitySelector";
import { RatioTable } from "../components/RatioTable";
import type { RatioCategory } from "../api/types";

const CATEGORY_LABELS: Record<RatioCategory, string> = {
  RENTABILITE: "Rentabilité",
  LIQUIDITE: "Liquidité",
  SOLVABILITE: "Solvabilité",
  ACTIVITE: "Activité",
};

export function RatiosPage() {
  const { data: entities } = useEntities();
  const [entityId, setEntityId] = useState<string>("");

  useEffect(() => {
    if (!entityId && entities && entities.length > 0) setEntityId(entities[0].id);
  }, [entities, entityId]);

  const { data: periods } = usePeriods(entityId || undefined);
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (periods && periods.length > 0) setPeriodId(periods[periods.length - 1].id);
    else setPeriodId(null);
  }, [periods]);

  const { data: ratioResult, isLoading } = useRatios(periodId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Catalogue des ratios</h1>
          <p className="text-sm text-ink/50">Les 19 ratios calculés automatiquement à chaque import.</p>
        </div>
        <div className="flex gap-2">
          <EntitySelector value={entityId} onChange={setEntityId} />
          {periods && periods.length > 0 && (
            <select className="input w-40" value={periodId ?? ""} onChange={(e) => setPeriodId(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isLoading && <p className="text-ink/50">Chargement…</p>}
      {periods && periods.length === 0 && <p className="text-ink/50">Aucune période pour cette entité.</p>}

      {ratioResult &&
        (Object.keys(CATEGORY_LABELS) as RatioCategory[]).map((category) => (
          <RatioTable
            key={category}
            title={CATEGORY_LABELS[category]}
            ratios={ratioResult.ratios.filter((r) => r.category === category)}
            currency={ratioResult.currency}
          />
        ))}
    </div>
  );
}
