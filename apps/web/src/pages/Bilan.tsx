import { useEffect, useState } from "react";
import { useDiagnostic, useEntities, usePeriods, useRatios } from "../api/hooks";
import { EntetePage, EtatVide, SqueletteCarte, Zone } from "../components/etats";
import { BilanMasses } from "../components/bilan/BilanMasses";
import { BesoinFondsRoulement } from "../components/bilan/BesoinFondsRoulement";
import { TableauFlux } from "../components/bilan/TableauFlux";
import { EquationTresorerie } from "../components/tableau/EquationTresorerie";
import { useDossierCourant } from "../lib/dossierCourant";

/**
 * Bilan et trésorerie : ce que l'entreprise possède, comment elle le finance,
 * et pourquoi sa trésorerie est ce qu'elle est.
 *
 * Ces blocs étaient éparpillés — le flux de trésorerie sous les soldes de
 * gestion, le besoin en fonds de roulement dans le diagnostic. Ils répondent
 * pourtant à la même question, et dans cet ordre : le bilan en grandes
 * masses, l'équation qui en sort (fonds de roulement − besoin en fonds de
 * roulement = trésorerie), le détail du besoin, puis les flux de l'exercice.
 */

const SOMMAIRE = [
  { id: "bilan", libelle: "Le bilan" },
  { id: "tresorerie", libelle: "D'où vient la trésorerie" },
  { id: "bfr", libelle: "Besoin en fonds de roulement" },
  { id: "flux", libelle: "Flux de trésorerie" },
];

export function BilanPage() {
  const { data: entities } = useEntities();
  const [entityId] = useDossierCourant(entities);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const { data: periods } = usePeriods(entityId || undefined);

  useEffect(() => {
    if (!periods || periods.length === 0) {
      setPeriodId(null);
      return;
    }
    if (!periods.some((p) => p.id === periodId)) setPeriodId(periods[periods.length - 1].id);
  }, [periods, periodId]);

  const { data: ratios, isLoading, error, refetch } = useRatios(periodId);
  const { data: diagnostic } = useDiagnostic(periodId);
  const currency = ratios?.currency ?? "EUR";

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Bilan et trésorerie"
        sousTitre="Ce que l'entreprise possède, comment elle le finance, et pourquoi sa trésorerie est ce qu'elle est."
      >
        <select
          className="input w-48"
          value={periodId ?? ""}
          aria-label="Période"
          onChange={(e) => setPeriodId(e.target.value || null)}
        >
          {periods?.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </EntetePage>

      {!periodId ? (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Cette entité n&apos;a aucune période. Importez un FEC ou une balance pour la remplir.
        </EtatVide>
      ) : (
        <>
          <nav aria-label="Sommaire" className="flex flex-wrap gap-2">
            {SOMMAIRE.map((entree) => (
              <a
                key={entree.id}
                href={`#${entree.id}`}
                className="rounded-full border border-rule/15 bg-surface px-3 py-1 text-sm text-ink-2 hover:text-ink hover:bg-surface-2 transition"
              >
                {entree.libelle}
              </a>
            ))}
          </nav>

          <Zone
            chargement={isLoading}
            erreur={error}
            onReessayer={() => void refetch()}
            quoi="le bilan"
            squelette={<SqueletteCarte hauteur="16rem" />}
          >
            {ratios && (
              <div className="space-y-6">
                <section id="bilan" className="card apparition scroll-mt-28" aria-labelledby="titre-bilan">
                  <h2 id="titre-bilan" className="text-lg font-bold">
                    Le bilan en grandes masses
                  </h2>
                  <p className="text-sm text-ink-3 mt-0.5 mb-5 max-w-prose">
                    Lu comme un bilan fonctionnel : le long terme finance les immobilisations, et ce qu&apos;il
                    finance en plus — le fonds de roulement — sert à porter le cycle d&apos;exploitation.
                  </p>
                  <BilanMasses a={ratios.aggregates} currency={currency} />
                </section>

                <section id="tresorerie" className="card apparition scroll-mt-28" aria-labelledby="titre-equation">
                  <h2 id="titre-equation" className="text-lg font-bold">
                    D&apos;où vient la trésorerie
                  </h2>
                  <p className="text-sm text-ink-3 mt-0.5 mb-4 max-w-prose">
                    La trésorerie n&apos;est pas un résultat : c&apos;est ce qui reste du fonds de roulement une fois le
                    cycle d&apos;exploitation financé.
                  </p>
                  <EquationTresorerie
                    fondsDeRoulement={ratios.derived.fondsDeRoulement}
                    bfr={ratios.derived.bfr}
                    tresorerie={ratios.derived.tresorerieNette}
                    currency={currency}
                  />
                </section>

                {diagnostic?.bfrNormatif && <BesoinFondsRoulement bfr={diagnostic.bfrNormatif} currency={currency} />}

                <TableauFlux periodId={periodId} currency={currency} />
              </div>
            )}
          </Zone>
        </>
      )}
    </div>
  );
}
