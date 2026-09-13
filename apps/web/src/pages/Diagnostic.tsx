import { useEffect, useState } from "react";
import { useDiagnostic, useEntities, usePeriods } from "../api/hooks";
import { EntitySelector } from "../components/EntitySelector";
import { EntetePage, EtatVide, SqueletteCarte, SqueletteTuiles, Zone } from "../components/etats";
import { formatCurrency } from "../lib/format";
import type { ScoreRisque, ZoneScore } from "../api/types";

const LIBELLE_ZONE: Record<ZoneScore, string> = {
  sain: "Zone saine",
  incertain: "Zone grise",
  danger: "Zone de danger",
  indisponible: "Indisponible",
};

const COULEUR_ZONE: Record<ZoneScore, string> = {
  sain: "text-success bg-success/10",
  incertain: "text-warning bg-warning/10",
  danger: "text-critical bg-critical/10",
  indisponible: "text-ink/50 bg-ink/5",
};

const LIBELLE_POSTE: Record<string, string> = {
  ACHATS_CONSOMMES: "Achats consommés",
  CHARGES_EXTERNES: "Charges externes",
  CHARGES_PERSONNEL: "Charges de personnel",
  IMPOTS_TAXES: "Impôts et taxes",
  DOTATIONS_AMORTISSEMENTS: "Dotations aux amortissements",
  CHARGES_FINANCIERES: "Charges financières",
};

function formatPart(part: number | null): string {
  return part === null ? "—" : `${(part * 100).toFixed(1)} %`;
}

/**
 * Un score se lit sur une échelle, pas dans l'absolu. La règle place la
 * valeur entre les deux seuils publiés, avec une marge de part et d'autre
 * pour que les cas extrêmes restent visibles aux bords.
 */
function Regle({ score }: { score: ScoreRisque }) {
  if (score.valeur === null) return null;

  const etendue = score.seuilSain - score.seuilDanger;
  const min = score.seuilDanger - etendue;
  const max = score.seuilSain + etendue;
  const position = Math.min(100, Math.max(0, ((score.valeur - min) / (max - min)) * 100));
  const bornerDanger = ((score.seuilDanger - min) / (max - min)) * 100;
  const bornerSain = ((score.seuilSain - min) / (max - min)) * 100;

  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full overflow-hidden bg-success/25">
        <div
          className="absolute inset-y-0 left-0 bg-critical/25"
          style={{ width: `${bornerDanger}%` }}
        />
        <div
          className="absolute inset-y-0 bg-warning/25"
          style={{ left: `${bornerDanger}%`, width: `${bornerSain - bornerDanger}%` }}
        />
      </div>
      <div className="relative h-4">
        <div
          className="absolute -top-3 w-0.5 h-4 bg-ink"
          style={{ left: `calc(${position}% - 1px)` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-xs text-ink/40 font-mono">
        <span>danger &lt; {score.seuilDanger}</span>
        <span>{score.seuilSain} &lt; sain</span>
      </div>
    </div>
  );
}

function CarteScore({ score }: { score: ScoreRisque }) {
  const [detail, setDetail] = useState(false);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{score.label}</h3>
          <p className="text-xs text-ink/40 mt-0.5">{score.source}</p>
        </div>
        <span
          className={`text-xs font-mono uppercase tracking-wide px-2 py-1 rounded flex-none ${COULEUR_ZONE[score.zone]}`}
        >
          {LIBELLE_ZONE[score.zone]}
        </span>
      </div>

      <div className="mt-3 font-mono text-3xl font-semibold">
        {score.valeur === null ? <span className="text-ink/30 text-xl">n/d</span> : score.valeur}
      </div>

      <Regle score={score} />

      {score.motifIndisponibilite && (
        <p className="mt-3 text-sm text-ink/60">{score.motifIndisponibilite}</p>
      )}

      {score.avertissementCalibration && (
        <p className="mt-3 text-xs text-warning bg-warning/5 rounded-lg px-3 py-2">
          {score.avertissementCalibration}
        </p>
      )}

      <p className="mt-3 text-xs text-ink/50">{score.limites}</p>

      <button
        type="button"
        className="mt-3 text-xs text-primary hover:underline"
        onClick={() => setDetail(!detail)}
      >
        {detail ? "Masquer le détail du calcul" : "Voir le détail du calcul"}
      </button>

      {detail && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs min-w-[440px]">
            <thead>
              <tr className="text-left uppercase tracking-wide text-ink/40 border-b border-rule/10">
                <th className="py-1.5">Composante</th>
                <th className="py-1.5 text-right">Valeur</th>
                <th className="py-1.5 text-right">Coefficient</th>
                <th className="py-1.5 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {score.composantes.map((composante) => (
                <tr key={composante.id} className="border-b border-rule/5 last:border-0">
                  <td className="py-1.5">
                    {composante.label}
                    <span className="block text-ink/40 font-mono">{composante.formule}</span>
                  </td>
                  <td className="py-1.5 text-right font-mono">{composante.valeur ?? "n/d"}</td>
                  <td className="py-1.5 text-right font-mono text-ink/50">
                    {composante.coefficient}
                  </td>
                  <td className="py-1.5 text-right font-mono font-medium">
                    {composante.contribution ?? "n/d"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DiagnosticPage() {
  const { data: entities } = useEntities();
  const [entityId, setEntityId] = useState("");
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId && entities && entities.length > 0) setEntityId(entities[0].id);
  }, [entities, entityId]);

  const { data: periods } = usePeriods(entityId || undefined);

  useEffect(() => {
    if (!periods || periods.length === 0) {
      setPeriodId(null);
      return;
    }
    if (!periods.some((p) => p.id === periodId)) setPeriodId(periods[periods.length - 1].id);
  }, [periods, periodId]);

  const { data, isLoading, error, refetch } = useDiagnostic(periodId);
  const currency = data?.currency ?? "EUR";
  const seuil = data?.seuilRentabilite;
  const bfr = data?.bfrNormatif;

  return (
    <div className="space-y-6">
      <EntetePage titre="Diagnostic" sousTitre="Fragilité, point mort et besoin de financement du cycle.">
        <EntitySelector value={entityId} onChange={setEntityId} />
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

      {!periodId && (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Cette entité n&apos;a aucune période. Importez un FEC ou une balance pour la remplir.
        </EtatVide>
      )}

      {periodId && (
        <Zone
          chargement={isLoading}
          erreur={error}
          onReessayer={() => void refetch()}
          quoi="le diagnostic"
          squelette={
            <div className="space-y-6">
              <SqueletteCarte hauteur="4rem" />
              <div className="grid lg:grid-cols-2 gap-4">
                <SqueletteCarte hauteur="7rem" />
                <SqueletteCarte hauteur="7rem" />
              </div>
              <SqueletteTuiles />
            </div>
          }
        >
      {data && (
        <div className="space-y-6">
          <div className="card bg-ink/[0.02]">
            <h2 className="font-display text-lg font-semibold mb-1">Scores de fragilité</h2>
            <p className="text-sm text-ink/50">
              Deux modèles statistiques publiés, appliqués à {data.periodLabel} ({data.joursPeriode}{" "}
              jours). Ce sont des indices, pas des prédictions : chaque composante est affichée avec
              son coefficient pour que le calcul reste vérifiable, et les flux sont annualisés avant
              d&apos;être rapportés au bilan.
            </p>
            <p className="mt-3 text-sm">
              <span className="font-semibold">
                Lecture{" "}
                {data.diagnostic.convergence === "convergente"
                  ? "convergente"
                  : data.diagnostic.convergence === "divergente"
                    ? "divergente"
                    : "partielle"}
                .
              </span>{" "}
              {data.diagnostic.commentaire}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {data.diagnostic.scores.map((score) => (
              <CarteScore key={score.id} score={score} />
            ))}
          </div>

          {seuil && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold mb-1">Seuil de rentabilité</h2>
              <p className="text-sm text-ink/50 mb-4">
                À partir de quel chiffre d&apos;affaires l&apos;entreprise couvre ses charges — et
                surtout de combien elle peut baisser avant de perdre de l&apos;argent.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Seuil</div>
                  <div className="font-mono text-xl font-semibold">
                    {seuil.seuilRentabilite === null
                      ? "n/d"
                      : formatCurrency(seuil.seuilRentabilite, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">
                    Marge de sécurité
                  </div>
                  <div
                    className={`font-mono text-xl font-semibold ${
                      (seuil.indiceSecurite ?? 0) < 0 ? "text-critical" : ""
                    }`}
                  >
                    {formatPart(seuil.indiceSecurite)}
                  </div>
                  <div className="text-xs text-ink/40">
                    {seuil.margeSecurite === null
                      ? ""
                      : formatCurrency(seuil.margeSecurite, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Point mort</div>
                  <div className="font-mono text-xl font-semibold">
                    {seuil.pointMortJours === null
                      ? "n/d"
                      : `J+${Math.round(seuil.pointMortJours)}`}
                  </div>
                  <div className="text-xs text-ink/40">sur {seuil.joursPeriode} jours</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">
                    Levier opérationnel
                  </div>
                  <div className="font-mono text-xl font-semibold">
                    {seuil.levierOperationnel === null
                      ? "n/d"
                      : seuil.levierOperationnel.toFixed(2)}
                  </div>
                  <div className="text-xs text-ink/40">
                    {seuil.levierOperationnel === null
                      ? ""
                      : `−10 % de CA → −${Math.abs(seuil.levierOperationnel * 10).toFixed(0)} % de résultat`}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-rule/10">
                      <th className="py-2">Poste de charge</th>
                      <th className="py-2 text-right">Montant</th>
                      <th className="py-2 text-right">Part variable</th>
                      <th className="py-2 text-right">Variable</th>
                      <th className="py-2 text-right">Fixe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seuil.ventilation.map((ligne) => (
                      <tr key={ligne.poste} className="border-b border-rule/5">
                        <td className="py-2">{LIBELLE_POSTE[ligne.poste] ?? ligne.poste}</td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(ligne.montant, currency)}
                        </td>
                        <td className="py-2 text-right font-mono text-ink/50">
                          {formatPart(ligne.partVariable)}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(ligne.variable, currency)}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(ligne.fixe, currency)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-ink/20 font-semibold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(seuil.chargesVariables + seuil.chargesFixes, currency)}
                      </td>
                      <td />
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(seuil.chargesVariables, currency)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(seuil.chargesFixes, currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-ink/40">
                La comptabilité générale ne distingue pas le fixe du variable : la ventilation
                ci-dessus repose sur des hypothèses d&apos;activité de transformation, affichées
                colonne par colonne. Marge sur coût variable :{" "}
                <span className="font-mono">{formatPart(seuil.tauxMargeSurCoutVariable)}</span>.
              </p>
            </div>
          )}

          {bfr && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold mb-1">
                Besoin en fonds de roulement
              </h2>
              <p className="text-sm text-ink/50 mb-4">
                En euros, le besoin en fonds de roulement est un constat. En jours de chiffre
                d&apos;affaires, c&apos;est une constante d&apos;exploitation — donc projetable.
              </p>

              <div className="flex gap-8 flex-wrap mb-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">BFR</div>
                  <div className="font-mono text-2xl font-semibold">
                    {formatCurrency(bfr.bfr, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">
                    En jours de CA
                  </div>
                  <div className="font-mono text-2xl font-semibold">
                    {bfr.bfrEnJours === null ? "n/d" : `${Math.round(bfr.bfrEnJours)} j`}
                  </div>
                </div>
              </div>

              <table className="w-full text-sm mb-5">
                <tbody>
                  {bfr.composantes.map((composante) => (
                    <tr key={composante.id} className="border-b border-rule/5">
                      <td className="py-2">{composante.label}</td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(composante.montant, currency)}
                      </td>
                      <td className="py-2 text-right font-mono text-ink/50 w-24">
                        {composante.jours === null ? "—" : `${Math.round(composante.jours)} j`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {bfr.besoinCroissance.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold mb-1">Ce que coûterait la croissance</h3>
                  <p className="text-xs text-ink/40 mb-3">
                    À structure d&apos;exploitation inchangée, le besoin suit le chiffre
                    d&apos;affaires. C&apos;est la trésorerie à immobiliser <em>avant</em>{" "}
                    d&apos;encaisser le premier euro de marge supplémentaire — le calcul que ne font
                    pas les entreprises qui meurent de croître.
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {bfr.besoinCroissance.map((hypothese) => (
                      <div key={hypothese.croissance} className="rounded-lg bg-ink/[0.03] px-3 py-2">
                        <div className="text-xs text-ink/50">
                          +{(hypothese.croissance * 100).toFixed(0)} % de CA
                        </div>
                        <div className="font-mono font-semibold">
                          {formatCurrency(hypothese.besoin, currency)}
                        </div>
                        <div className="text-xs text-ink/40 font-mono">
                          soit {formatCurrency(hypothese.caSupplementaire, currency)} de plus
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
        </Zone>
      )}
    </div>
  );
}
