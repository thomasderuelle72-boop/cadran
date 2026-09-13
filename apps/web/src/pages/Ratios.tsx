import { useEffect, useState } from "react";
import { useEntities, usePeriods, useRatios } from "../api/hooks";
import { EntitySelector } from "../components/EntitySelector";
import { RatioTable } from "../components/RatioTable";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
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

  const { data: ratioResult, isLoading, error, refetch } = useRatios(periodId);

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Catalogue des ratios"
        sousTitre="Les 19 ratios calculés automatiquement à chaque import."
      >
        <EntitySelector value={entityId} onChange={setEntityId} />
        {periods && periods.length > 0 && (
          <select
            className="input w-40"
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
        )}
      </EntetePage>

      {periods && periods.length === 0 ? (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Cette entité n&apos;a aucune période à analyser.
        </EtatVide>
      ) : (
        <Zone
          chargement={isLoading}
          erreur={error}
          onReessayer={() => void refetch()}
          quoi="les ratios"
          squelette={
            <div className="space-y-6">
              <SqueletteTableau lignes={5} colonnes={4} />
              <SqueletteTableau lignes={5} colonnes={4} />
            </div>
          }
        >
          <div className="space-y-6">
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
        </Zone>
      )}
    </div>
  );
}
