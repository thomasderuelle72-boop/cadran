import { useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { useBudgetVariance, useEntities, useImportReference, usePeriods, useRatios, useSubmitBudget } from "../api/hooks";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
import { formatCurrency } from "../lib/format";
import type { Aggregates, LinePoste } from "../api/types";
import { ApiError } from "../api/client";
import { useDossierCourant } from "../lib/dossierCourant";
import { periodesComparables } from "../lib/tableauDeBord";

/**
 * Le budget et l'écart au réalisé.
 *
 * L'ancien écran alignait vingt et une cases à zéro et affichait « +948 000 €
 * vs budget » avant toute saisie : un écart à un budget qui n'existe pas.
 * Désormais :
 * - le compte de résultat d'abord ; les postes de bilan, rarement budgétés
 *   dans une PME, sont repliés ;
 * - le réalisé de la période précédente est en face de chaque case, et le
 *   budget peut en partir en un clic ;
 * - un écart ne s'affiche que pour un poste effectivement budgété.
 */

const COMPTE_DE_RESULTAT = new Set<LinePoste>([
  "CHIFFRE_AFFAIRES",
  "ACHATS_CONSOMMES",
  "CHARGES_EXTERNES",
  "CHARGES_PERSONNEL",
  "IMPOTS_TAXES",
  "DOTATIONS_AMORTISSEMENTS",
  "AUTRES_PRODUITS_CHARGES_EXPLOITATION",
  "CHARGES_FINANCIERES",
  "PRODUITS_FINANCIERS",
  "RESULTAT_EXCEPTIONNEL",
  "RESULTAT_CESSIONS",
  "IMPOT_SOCIETES",
]);

// Dépasser le budget est défavorable pour une charge, favorable pour un
// produit ; sur un poste de bilan, un écart n'est ni bon ni mauvais en soi.
const CHARGES = new Set<LinePoste>([
  "ACHATS_CONSOMMES",
  "CHARGES_EXTERNES",
  "CHARGES_PERSONNEL",
  "IMPOTS_TAXES",
  "DOTATIONS_AMORTISSEMENTS",
  "CHARGES_FINANCIERES",
  "IMPOT_SOCIETES",
]);
const PRODUITS = new Set<LinePoste>(["CHIFFRE_AFFAIRES", "PRODUITS_FINANCIERS"]);

/** Les postes qui suivent l'activité : au pré-remplissage, ils prennent la croissance. */
const VARIABLES = new Set<LinePoste>(["CHIFFRE_AFFAIRES", "ACHATS_CONSOMMES"]);

const AGREGAT: Record<LinePoste, keyof Aggregates> = {
  CHIFFRE_AFFAIRES: "chiffreAffaires",
  ACHATS_CONSOMMES: "achatsConsommes",
  CHARGES_EXTERNES: "chargesExternes",
  CHARGES_PERSONNEL: "chargesPersonnel",
  IMPOTS_TAXES: "impotsTaxes",
  DOTATIONS_AMORTISSEMENTS: "dotationsAmortissements",
  AUTRES_PRODUITS_CHARGES_EXPLOITATION: "autresProduitsChargesExploitation",
  CHARGES_FINANCIERES: "chargesFinancieres",
  PRODUITS_FINANCIERS: "produitsFinanciers",
  RESULTAT_EXCEPTIONNEL: "resultatExceptionnel",
  RESULTAT_CESSIONS: "resultatCessions",
  IMPOT_SOCIETES: "impotSocietes",
  STOCKS: "stocks",
  CREANCES_CLIENTS: "creancesClients",
  AUTRES_CREANCES: "autresCreances",
  DISPONIBILITES: "disponibilites",
  CAPITAUX_PROPRES: "capitauxPropres",
  DETTES_FINANCIERES: "dettesFinancieres",
  DETTES_FOURNISSEURS: "dettesFournisseurs",
  AUTRES_DETTES: "autresDettes",
  IMMOBILISATIONS: "immobilisations",
};

function couleurEcart(poste: LinePoste, ecart: number): string {
  if (Math.round(ecart) === 0) return "text-ink-3";
  if (CHARGES.has(poste)) return ecart > 0 ? "text-critical" : "text-success";
  if (PRODUITS.has(poste)) return ecart > 0 ? "text-success" : "text-critical";
  return "text-ink-3";
}

const signe = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

export function BudgetPage() {
  const { data: entities } = useEntities();
  const [entityId] = useDossierCourant(entities);
  const { data: periods } = usePeriods(entityId || undefined);
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (!periods || periods.length === 0) {
      setPeriodId(null);
      return;
    }
    if (!periods.some((p) => p.id === periodId)) setPeriodId(periods[periods.length - 1].id);
  }, [periods, periodId]);

  // La période précédente de même durée : le point de départ naturel d'un budget.
  const precedente = useMemo(() => {
    const comparables = periodesComparables(periods ?? [], periodId);
    return comparables.length > 1 ? comparables[comparables.length - 2] : null;
  }, [periods, periodId]);
  const periode = periods?.find((p) => p.id === periodId);

  const { data: reference } = useImportReference();
  const { data: variance, isLoading, error: erreurChargement, refetch } = useBudgetVariance(periodId);
  const { data: ratiosPrecedents } = useRatios(precedente?.id ?? null);
  const submitBudget = useSubmitBudget();

  const [brouillon, setBrouillon] = useState<Record<string, number>>({});
  const [croissance, setCroissance] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    if (!variance) return;
    const suivant: Record<string, number> = {};
    variance.rows.forEach((row) => {
      suivant[row.poste] = row.budgeted;
    });
    setBrouillon(suivant);
    setEnregistre(false);
  }, [variance]);

  const reel = useMemo(() => {
    const carte = new Map<LinePoste, number>();
    variance?.rows.forEach((row) => carte.set(row.poste, row.actual));
    return carte;
  }, [variance]);

  const reelPrecedent = (poste: LinePoste): number | null =>
    ratiosPrecedents ? (ratiosPrecedents.aggregates[AGREGAT[poste]] ?? null) : null;

  const budgetEnBase = variance?.rows.some((row) => row.budgeted !== 0) ?? false;
  const brouillonVide = Object.values(brouillon).every((v) => !v);
  const modifie = variance ? variance.rows.some((row) => (brouillon[row.poste] ?? 0) !== row.budgeted) : false;

  function preRemplir() {
    if (!ratiosPrecedents) return;
    const suivant: Record<string, number> = { ...brouillon };
    for (const poste of COMPTE_DE_RESULTAT) {
      const v = ratiosPrecedents.aggregates[AGREGAT[poste]] ?? 0;
      suivant[poste] = Math.round(VARIABLES.has(poste) ? v * (1 + croissance / 100) : v);
    }
    setBrouillon(suivant);
    setEnregistre(false);
  }

  async function enregistrer() {
    if (!periodId) return;
    setErreur(null);
    setEnregistre(false);
    const items = Object.entries(brouillon)
      .filter(([, montant]) => montant !== 0)
      .map(([poste, amountBudgeted]) => ({ poste: poste as LinePoste, amountBudgeted }));
    try {
      await submitBudget.mutateAsync({ periodId, items });
      setEnregistre(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    }
  }

  const devise = variance?.currency ?? "EUR";
  const lignes = (filtre: (poste: LinePoste) => boolean) =>
    reference?.postes
      .filter(({ poste }) => filtre(poste))
      .map(({ poste, label }) => {
        const realise = reel.get(poste) ?? 0;
        const budget = brouillon[poste] ?? 0;
        const ecart = realise - budget;
        const precedent = reelPrecedent(poste);
        return (
          <tr key={poste} className="border-t border-rule/[0.06]">
            <th scope="row" className="py-2 pr-3 text-left font-normal">
              {label}
            </th>
            {precedente && (
              <td className="py-2 pr-3 text-right tabular-nums text-ink-3 whitespace-nowrap">
                {precedent === null ? "—" : formatCurrency(precedent, devise)}
              </td>
            )}
            <td className="py-2 pr-3 text-right">
              <input
                type="number"
                className="input py-1 w-32 text-right tabular-nums"
                aria-label={`Budget : ${label}`}
                value={budget || ""}
                placeholder="—"
                onChange={(e) => {
                  setBrouillon({ ...brouillon, [poste]: Number(e.target.value) || 0 });
                  setEnregistre(false);
                }}
              />
            </td>
            <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(realise, devise)}</td>
            <td className={`py-2 text-right tabular-nums whitespace-nowrap ${budget ? couleurEcart(poste, ecart) : "text-ink-3"}`}>
              {budget
                ? `${signe(ecart)}${formatCurrency(Math.abs(ecart), devise)}${
                    budget > 0 ? ` · ${signe(ecart)}${(Math.abs(ecart / budget) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : ""
                  }`
                : "—"}
            </td>
          </tr>
        );
      });

  const entete = (
    <thead>
      <tr className="text-xs uppercase tracking-wide text-ink-3">
        <th className="py-2 pr-3 text-left font-semibold">Poste</th>
        {precedente && <th className="py-2 pr-3 text-right font-semibold whitespace-nowrap">Réalisé {precedente.label}</th>}
        <th className="py-2 pr-3 text-right font-semibold">Budget</th>
        <th className="py-2 pr-3 text-right font-semibold whitespace-nowrap">Réalisé {periode?.label}</th>
        <th className="py-2 text-right font-semibold">Écart</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-6">
      <EntetePage titre="Budget" sousTitre="Le budget de la période, et l'écart au réalisé poste par poste.">
        {periods && periods.length > 0 && (
          <select className="input w-44" value={periodId ?? ""} aria-label="Période" onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </EntetePage>

      {periods && periods.length === 0 && (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Un budget se compare à un réalisé : il faut d&apos;abord une période importée.
        </EtatVide>
      )}

      <Zone
        chargement={isLoading}
        erreur={erreurChargement}
        onReessayer={() => void refetch()}
        quoi="le budget"
        squelette={<SqueletteTableau lignes={8} colonnes={5} />}
      >
        {variance && (
          <div className="space-y-6">
            {budgetEnBase ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(
                  [
                    ["chiffreAffaires", "Chiffre d'affaires"],
                    ["ebitda", "EBITDA"],
                    ["resultatNet", "Résultat net"],
                  ] as const
                ).map(([cle, libelle]) => {
                  const s = variance.summary[cle];
                  return (
                    <div className="card" key={cle}>
                      <div className="text-sm font-semibold text-ink-2">{libelle}</div>
                      <div className="text-[1.6rem] font-bold tabular-nums leading-tight mt-1">{formatCurrency(s.actual, devise)}</div>
                      <div className="text-sm text-ink-3">budget {formatCurrency(s.budgeted, devise)}</div>
                      <div className={`text-sm font-semibold mt-1 ${s.ecart >= 0 ? "text-success" : "text-critical"}`}>
                        {signe(s.ecart)}
                        {formatCurrency(Math.abs(s.ecart), devise)} {s.ecart >= 0 ? "au-dessus" : "en dessous"} du budget
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              brouillonVide && (
                <section className="card flex flex-wrap items-center gap-4">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary-soft text-primary">
                    <Wand2 size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold">Aucun budget saisi pour {periode?.label}</h2>
                    <p className="text-sm text-ink-2">
                      {precedente
                        ? `Partez du réalisé de ${precedente.label} : le chiffre d'affaires et les achats prennent la croissance choisie, les autres charges sont reconduites. Ajustez ensuite ligne à ligne.`
                        : "Saisissez le montant prévu de chaque poste du compte de résultat."}
                    </p>
                  </div>
                  {precedente && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-sm">
                        Croissance
                        <input
                          type="number"
                          step={0.5}
                          className="input w-20 py-1.5 text-right tabular-nums"
                          value={croissance}
                          onChange={(e) => setCroissance(Number(e.target.value) || 0)}
                        />
                        %
                      </label>
                      <button type="button" className="btn-primary" onClick={preRemplir} disabled={!ratiosPrecedents}>
                        Pré-remplir depuis {precedente.label}
                      </button>
                    </div>
                  )}
                </section>
              )
            )}

            <section className="card" aria-labelledby="titre-budget-cr">
              <h2 id="titre-budget-cr" className="text-lg font-bold mb-2">
                Compte de résultat
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  {entete}
                  <tbody>{lignes((poste) => COMPTE_DE_RESULTAT.has(poste))}</tbody>
                </table>
              </div>

              <details className="mt-5 border-t border-rule/10 pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink-2">Postes de bilan (facultatif)</summary>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm min-w-[640px]">
                    {entete}
                    <tbody>{lignes((poste) => !COMPTE_DE_RESULTAT.has(poste))}</tbody>
                  </table>
                </div>
              </details>

              {erreur && <p className="text-critical text-sm mt-3">{erreur}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button className="btn-primary" disabled={submitBudget.isPending || !modifie} onClick={enregistrer}>
                  {submitBudget.isPending ? "Enregistrement…" : "Enregistrer le budget"}
                </button>
                {enregistre && <span className="text-success text-sm">Budget enregistré.</span>}
                {modifie && !enregistre && <span className="text-sm text-ink-3">Modifications non enregistrées.</span>}
              </div>
            </section>
          </div>
        )}
      </Zone>
    </div>
  );
}
