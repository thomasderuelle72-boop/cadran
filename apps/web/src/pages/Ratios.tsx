import { useEffect, useState } from "react";
import { useEntities, usePeriods, useRatios } from "../api/hooks";
import { RatioTable } from "../components/RatioTable";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
import type { RatioCategory } from "../api/types";
import { useDossierCourant } from "../lib/dossierCourant";

const CATEGORIES: RatioCategory[] = ["RENTABILITE", "LIQUIDITE", "SOLVABILITE", "ACTIVITE"];

export function RatiosPage() {
  const { data: entities } = useEntities();
  const [entityId] = useDossierCourant(entities);


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
        titre="Ratios"
        sousTitre="Les 19 ratios calculés automatiquement à chaque import."
      >
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
              CATEGORIES.map((category) => (
                <RatioTable
                  key={category}
                  categorie={category}
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
