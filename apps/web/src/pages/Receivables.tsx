import { useEffect, useState } from "react";
import { useBalanceAgee, useConcentration, useEntities } from "../api/hooks";
import { EntitySelector } from "../components/EntitySelector";
import { formatCurrency } from "../lib/format";
import type { SensTiers } from "../api/types";

const DELAIS = [
  { valeur: 30, label: "30 jours (délai légal supplétif)" },
  { valeur: 45, label: "45 jours" },
  { valeur: 60, label: "60 jours" },
];

/**
 * Au-delà de 25 % du chiffre d'affaires, la défaillance d'un seul client
 * met en cause la continuité d'exploitation. Ce n'est pas une performance
 * commerciale, c'est un risque — et aucun des dix-neuf ratios ne le voit.
 */
const SEUIL_DEPENDANCE = 0.25;
/** Au-delà, l'indice de Herfindahl signale un portefeuille concentré. */
const SEUIL_HERFINDAHL = 0.25;

function formatPart(part: number | null): string {
  return part === null ? "—" : `${(part * 100).toFixed(1)} %`;
}

function Jauge({ part }: { part: number | null }) {
  const largeur = Math.min(100, Math.max(0, (part ?? 0) * 100));
  return (
    <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
      <div className="h-full rounded-full bg-primary" style={{ width: `${largeur}%` }} />
    </div>
  );
}

export function ReceivablesPage() {
  const { data: entities } = useEntities();
  const [entityId, setEntityId] = useState("");
  const [sens, setSens] = useState<SensTiers>("CLIENT");
  const [delai, setDelai] = useState(30);

  useEffect(() => {
    if (!entityId && entities && entities.length > 0) setEntityId(entities[0].id);
  }, [entities, entityId]);

  const { data: balance, isLoading } = useBalanceAgee(entityId || null, sens, delai);
  const { data: concentration } = useConcentration(entityId || null, sens);

  const estClient = sens === "CLIENT";
  const motTiers = estClient ? "client" : "fournisseur";
  const currency = balance?.currency ?? "EUR";

  const partRetard =
    balance && balance.encoursTotal > 0 ? balance.encoursEnRetard / balance.encoursTotal : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Encours</h1>
          <p className="text-sm text-ink/50">
            Qui doit quoi, depuis quand, et quel poids il pèse.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <EntitySelector value={entityId} onChange={setEntityId} />
          <select
            className="input w-40"
            value={sens}
            onChange={(e) => setSens(e.target.value as SensTiers)}
          >
            <option value="CLIENT">Clients</option>
            <option value="FOURNISSEUR">Fournisseurs</option>
          </select>
          <select className="input w-56" value={delai} onChange={(e) => setDelai(Number(e.target.value))}>
            {DELAIS.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isLoading && balance && balance.ecrituresAnalysees === 0 && (
        <div className="card text-sm text-ink/50">
          Cette entité n&apos;a aucune écriture comptable. La balance âgée se lit sur le détail des
          écritures : importez un FEC depuis la page Import pour la faire apparaître. Une balance de
          postes agrégés ne suffit pas — elle ne porte ni le tiers, ni le lettrage.
        </div>
      )}

      {balance && balance.ecrituresAnalysees > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">
                Encours {estClient ? "client" : "fournisseur"}
              </div>
              <div className="font-mono text-2xl font-semibold">
                {formatCurrency(balance.encoursTotal, currency)}
              </div>
              <div className="text-xs text-ink/40 mt-1">
                au {new Date(balance.dateReference).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Âge moyen pondéré</div>
              <div className="font-mono text-2xl font-semibold">
                {balance.ageMoyenPondere === null ? "n/d" : `${balance.ageMoyenPondere.toFixed(0)} j`}
              </div>
              <div className="text-xs text-ink/40 mt-1">Sans le biais de TVA du DSO</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">Au-delà de {delai} j</div>
              <div
                className={`font-mono text-2xl font-semibold ${
                  partRetard !== null && partRetard > 0.3 ? "text-critical" : ""
                }`}
              >
                {formatCurrency(balance.encoursEnRetard, currency)}
              </div>
              <div className="text-xs text-ink/40 mt-1">{formatPart(partRetard)} de l&apos;encours</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">
                Premier {motTiers}
              </div>
              <div
                className={`font-mono text-2xl font-semibold ${
                  concentration?.partPremier !== null &&
                  concentration?.partPremier !== undefined &&
                  concentration.partPremier > SEUIL_DEPENDANCE
                    ? "text-critical"
                    : ""
                }`}
              >
                {formatPart(concentration?.partPremier ?? null)}
              </div>
              <div className="text-xs text-ink/40 mt-1">
                de la facturation · {concentration?.tiers[0]?.label ?? "—"}
              </div>
            </div>
          </div>

          {concentration?.partPremier !== null &&
            concentration?.partPremier !== undefined &&
            concentration.partPremier > SEUIL_DEPENDANCE && (
              <div className="card border-critical/30 bg-critical/5">
                <p className="text-sm">
                  <span className="font-semibold text-critical">Dépendance {motTiers}.</span>{" "}
                  {concentration.tiers[0].label} pèse {formatPart(concentration.partPremier)} de la
                  facturation {estClient ? "" : "d'achat "}de la période. Au-delà d&apos;un quart,
                  la perte de ce seul {motTiers} met en cause la continuité d&apos;exploitation —
                  c&apos;est un risque, pas une performance commerciale.
                </p>
              </div>
            )}

          <div className="card">
            <h2 className="font-display text-lg font-semibold mb-1">Ancienneté de l&apos;encours</h2>
            <p className="text-sm text-ink/50 mb-4">
              Calculée sur les seules écritures non lettrées, à partir de la date de pièce.
            </p>
            <div className="space-y-3">
              {balance.tranches.map((tranche) => (
                <div key={tranche.id}>
                  <div className="flex items-baseline justify-between gap-4 mb-1">
                    <span className="text-sm">{tranche.label}</span>
                    <span className="font-mono text-sm">
                      {formatCurrency(tranche.montant, currency)}
                      <span className="text-ink/40 ml-2">{formatPart(tranche.part)}</span>
                    </span>
                  </div>
                  <Jauge part={tranche.part} />
                </div>
              ))}
            </div>
            {balance.sansTiers !== 0 && (
              <p className="text-xs text-ink/40 mt-4">
                Dont {formatCurrency(balance.sansTiers, currency)} sur des écritures sans compte
                auxiliaire, donc non rattachables à un {motTiers}.
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold mb-3">
              Encours par {motTiers}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
                    <th className="py-2">Tiers</th>
                    <th className="py-2 text-right">Encours</th>
                    <th className="py-2 text-right">Part</th>
                    <th className="py-2 text-right">Âge moyen</th>
                    <th className="py-2 text-right">Plus ancienne</th>
                    <th className="py-2 text-right">Au-delà de {delai} j</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.tiers.map((tiers) => (
                    <tr key={tiers.code} className="border-b border-black/5 last:border-0">
                      <td className="py-2 font-medium">
                        {tiers.label}
                        <span className="text-ink/40 font-mono text-xs ml-2">{tiers.code}</span>
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(tiers.encours, currency)}
                      </td>
                      <td className="py-2 text-right font-mono text-ink/50">
                        {formatPart(tiers.part)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {tiers.ageMoyen === null ? "—" : `${tiers.ageMoyen.toFixed(0)} j`}
                      </td>
                      <td className="py-2 text-right font-mono text-ink/50">
                        {tiers.ageMaximal === null ? "—" : `${tiers.ageMaximal} j`}
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${
                          tiers.enRetard > 0 ? "text-critical" : "text-ink/30"
                        }`}
                      >
                        {tiers.enRetard > 0 ? formatCurrency(tiers.enRetard, currency) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {concentration && concentration.tiers.length > 0 && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold mb-1">
                Concentration de la facturation
              </h2>
              <p className="text-sm text-ink/50 mb-4">
                Montants hors taxes, reconstitués en rapprochant la ligne de tiers et les lignes de{" "}
                {estClient ? "produit" : "charge"} de chaque écriture.
              </p>

              <div className="flex gap-6 flex-wrap mb-4 text-sm">
                <div>
                  <span className="text-ink/50">Trois premiers : </span>
                  <span className="font-mono font-semibold">
                    {formatPart(concentration.partTroisPremiers)}
                  </span>
                </div>
                <div>
                  <span className="text-ink/50">Dix premiers : </span>
                  <span className="font-mono font-semibold">
                    {formatPart(concentration.partDixPremiers)}
                  </span>
                </div>
                <div>
                  <span className="text-ink/50">Indice de Herfindahl : </span>
                  <span
                    className={`font-mono font-semibold ${
                      (concentration.herfindahl ?? 0) > SEUIL_HERFINDAHL ? "text-critical" : ""
                    }`}
                  >
                    {concentration.herfindahl === null ? "—" : concentration.herfindahl.toFixed(3)}
                  </span>
                  <span className="text-ink/40 text-xs ml-1">
                    (concentré au-delà de {SEUIL_HERFINDAHL.toFixed(2).replace(".", ",")})
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {concentration.tiers.slice(0, 10).map((tiers) => (
                  <div key={tiers.code}>
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <span className="text-sm">{tiers.label}</span>
                      <span className="font-mono text-sm">
                        {formatCurrency(tiers.montant, currency)}
                        <span className="text-ink/40 ml-2">{formatPart(tiers.part)}</span>
                      </span>
                    </div>
                    <Jauge part={tiers.part} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
