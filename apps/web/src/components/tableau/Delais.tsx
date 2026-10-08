import type { RatioValue } from "../../api/types";
import { StatusBadge } from "../StatusBadge";
import { useMonte } from "../../lib/animation";

/**
 * Le cycle d'exploitation en jours : combien de temps l'argent reste dehors.
 *
 * Trois barres à la même échelle — le stock qui attend d'être vendu, le
 * client qui tarde à payer, le fournisseur qu'on paie plus tard — puis leur
 * bilan : DIO + DSO − DPO, le nombre de jours que l'entreprise doit financer
 * elle-même. Une seule couleur pour les trois : ce sont des durées, pas des
 * séries à distinguer.
 */
export function Delais({ ratios }: { ratios: RatioValue[] }) {
  const monte = useMonte();
  const trouver = (id: string) => ratios.find((r) => r.id === id);
  const lignes = [
    { ratio: trouver("dio"), libelle: "Le stock attend", phrase: "jours avant d'être vendu" },
    { ratio: trouver("dso"), libelle: "Les clients paient en", phrase: "jours après facturation" },
    { ratio: trouver("dpo"), libelle: "Les fournisseurs sont payés en", phrase: "jours" },
  ].filter((l): l is { ratio: RatioValue; libelle: string; phrase: string } => Boolean(l.ratio && l.ratio.value !== null));
  const cycle = trouver("cycle_conversion_cash");

  if (lignes.length === 0) {
    return <p className="text-sm text-ink-3">Les délais demandent un bilan et un compte de résultat sur la même période.</p>;
  }

  const echelle = Math.max(...lignes.map((l) => Math.abs(l.ratio.value!)), 1);

  return (
    <div className="space-y-4">
      {lignes.map(({ ratio, libelle, phrase }) => (
        <div key={ratio.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-2">{libelle}</span>
            <span>
              <span className="text-base font-bold tabular-nums">{Math.round(ratio.value!)}</span>{" "}
              <span className="text-ink-3">{phrase}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden="true">
            <div
              className="h-full rounded-full bg-serie-1 transition-[width] duration-700 ease-out"
              style={{ width: monte ? `${(Math.abs(ratio.value!) / echelle) * 100}%` : 0 }}
            />
          </div>
        </div>
      ))}

      {cycle && cycle.value !== null && (
        <div className="rounded-xl bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Jours à financer soi-même</span>
            <StatusBadge status={cycle.status} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{Math.round(cycle.value)} j</span>
            <span className="text-xs text-ink-3">stock + clients − fournisseurs</span>
          </div>
          <p className="text-xs text-ink-2 mt-1">
            Entre le paiement d&apos;un fournisseur et l&apos;encaissement du client, autant de jours où la trésorerie
            avance l&apos;argent.
          </p>
        </div>
      )}
    </div>
  );
}
